package com.chillcode.assessment.service;

import com.chillcode.assessment.entity.Achievement;
import com.chillcode.assessment.entity.Notification;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.repository.AchievementRepository;
import com.chillcode.assessment.repository.NotificationRepository;
import com.chillcode.assessment.repository.StudentTestRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@lombok.extern.slf4j.Slf4j
@Service
public class StudentService {

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private AchievementRepository achievementRepository;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Autowired
    private com.chillcode.assessment.repository.QuestionRepository questionRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubmissionRepository submissionRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubjectRepository subjectRepository;

    @Autowired
    private QuestionService questionService;

    @Transactional
    public Map<String, Object> getStudentDashboardStats(Long studentId) {
        questionService.cleanupOrphanedRecordsAndEmptyTests();

        com.chillcode.assessment.entity.User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        List<StudentTest> myTests = studentTestRepository.findByStudentId(studentId);
        java.util.Set<Long> existingTestIds = myTests.stream()
                .map(st -> st.getTest().getId())
                .collect(Collectors.toSet());

        List<com.chillcode.assessment.entity.Test> allTests = testRepository.findAll();
        boolean savedAny = false;
        for (com.chillcode.assessment.entity.Test test : allTests) {
            if (!existingTestIds.contains(test.getId()) && !studentTestRepository.existsByStudentIdAndTestId(studentId, test.getId())) {
                try {
                    com.chillcode.assessment.entity.StudentTest st = com.chillcode.assessment.entity.StudentTest.builder()
                            .student(student)
                            .test(test)
                            .status("ASSIGNED")
                            .score(0)
                            .warningsCount(0)
                            .isSuspended(false)
                            .build();
                    studentTestRepository.save(st);
                    savedAny = true;
                } catch (Exception e) {
                    log.warn("StudentTest for studentId={} and testId={} already created concurrently: {}", studentId, test.getId(), e.getMessage());
                }
            }
        }

        if (savedAny) {
            myTests = studentTestRepository.findByStudentId(studentId);
        }

        // Filter out tests that have 0 questions (e.g. after question deletion)
        List<StudentTest> validMyTests = myTests.stream()
                .filter(st -> st.getTest() != null && st.getTest().getQuestions() != null && !st.getTest().getQuestions().isEmpty())
                .collect(Collectors.toList());

        // Group questions by Subject using optimized native query
        List<Object[]> dbSubjectStats = subjectRepository.getSubjectStatsForStudent(studentId);
        List<Map<String, Object>> subjectStatsList = new java.util.ArrayList<>();
        
        long sumTotalQuestions = 0;
        long sumCompletedQuestions = 0;

        for (Object[] row : dbSubjectStats) {
            Long subjectId = ((Number) row[0]).longValue();
            String name = (String) row[1];
            String color = (String) row[2];
            long total = ((Number) row[3]).longValue();
            long completed = ((Number) row[4]).longValue();
            long incomplete = total - completed;

            sumTotalQuestions += total;
            sumCompletedQuestions += completed;

            Map<String, Object> subMap = new HashMap<>();
            subMap.put("subjectId", subjectId);
            subMap.put("subjectName", name);
            subMap.put("subjectColor", color);
            subMap.put("completedCount", completed);
            subMap.put("incompleteCount", incomplete);
            subMap.put("totalCount", total);
            subMap.put("status", incomplete == 0 && total > 0 ? "COMPLETED" : "INCOMPLETE");

            subjectStatsList.add(subMap);
        }

        // Calculate test counts based on valid student tests
        long unattendedTestsCount = validMyTests.stream()
                .filter(st -> "ASSIGNED".equals(st.getStatus()))
                .count();

        long inProgressTestsCount = validMyTests.stream()
                .filter(st -> "STARTED".equals(st.getStatus()) || "IN_PROGRESS".equals(st.getStatus()) || "SUSPENDED".equals(st.getStatus()))
                .count();

        long completedTestsCount = validMyTests.stream()
                .filter(st -> "COMPLETED".equals(st.getStatus()) || "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "PENDING".equals(st.getStatus()))
                .count();

        // Question counts matched with subject stats
        long totalQuestionsCount = !subjectStatsList.isEmpty() ? sumTotalQuestions : questionRepository.count();
        long completedQuestionsCount = !subjectStatsList.isEmpty() ? sumCompletedQuestions : 0;

        // Calculate average score of all valid student tests
        double totalScore = validMyTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()) || "PENDING".equals(st.getStatus()))
                .mapToInt(st -> st.getScore() != null ? st.getScore() : 0)
                .average()
                .orElse(0.0);

        Map<String, Object> stats = new HashMap<>();
        stats.put("unattendedTests", unattendedTestsCount);
        stats.put("completedTests", completedTestsCount);
        stats.put("inProgressTests", inProgressTestsCount);
        stats.put("totalTests", validMyTests.size());
        stats.put("averageScore", Math.round(totalScore * 100.0) / 100.0);
        stats.put("totalQuestions", totalQuestionsCount);
        stats.put("completedQuestions", completedQuestionsCount);
        stats.put("subjectStats", subjectStatsList);

        // Recent activity logs: fetch latest 5 submissions made by the student for existing questions
        List<com.chillcode.assessment.entity.Submission> latestSubmissions = submissionRepository.findTop5ByStudentIdOrderByCreatedAtDesc(
                studentId, org.springframework.data.domain.PageRequest.of(0, 5));
        List<String> activities = latestSubmissions.stream()
                .filter(sub -> sub.getQuestion() != null)
                .map(sub -> String.format("Submitted solution for '%s' - Verdict: %s",
                        sub.getQuestion().getTitle(),
                        sub.getStatus()))
                .collect(Collectors.toList());
        
        if (activities.isEmpty()) {
            activities.add("No recent submission activity recorded yet.");
        }
        stats.put("recentActivities", activities);

        return stats;
    }

    public List<Notification> getNotificationsForUser(Long userId) {
        return notificationRepository.findByUserIdAndTypeOrderByCreatedAtDesc(userId, "GENERAL");
    }

    @Transactional
    public void markNotificationAsRead(Long notificationId, Long userId) {
        Optional<Notification> notificationOpt = notificationRepository.findById(notificationId);
        if (notificationOpt.isPresent()) {
            Notification notification = notificationOpt.get();
            if (notification.getUser().getId().equals(userId)) {
                notification.setIsRead(true);
                notificationRepository.save(notification);
            }
        }
    }

    public List<Achievement> getAchievementsForUser(Long studentId) {
        return achievementRepository.findByStudentId(studentId);
    }

    @Transactional
    public void broadcastNotification(String title, String message) {
        List<com.chillcode.assessment.entity.User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                .collect(Collectors.toList());
        
        for (com.chillcode.assessment.entity.User student : students) {
            Notification notification = Notification.builder()
                    .user(student)
                    .title(title)
                    .message(message)
                    .type("GENERAL")
                    .isRead(false)
                    .build();
            notificationRepository.save(notification);
        }
    }
}
