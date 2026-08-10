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
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
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

    @Autowired
    private com.chillcode.assessment.repository.StudentAchievementRepository studentAchievementRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentBadgeRepository studentBadgeRepository;

    @Autowired
    private com.chillcode.assessment.repository.LanguageMasterBadgeRepository languageMasterBadgeRepository;

    @Transactional
    public Map<String, Object> getStudentDashboardStats(Long studentId) {
        // Fast one-pass native insert for any newly added tests
        try {
            studentTestRepository.assignMissingTestsForStudent(studentId);
        } catch (Exception e) {
            log.warn("Auto-assignment query skipped or already executed concurrently: {}", e.getMessage());
        }

        // Fetch student tests with eagerness for tests and questions
        List<StudentTest> myTests = studentTestRepository.findByStudentIdWithTestAndQuestions(studentId);

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
            long incomplete = Math.max(0, total - completed);

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

        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        long totalQuestionsCount = sumTotalQuestions > 0 ? sumTotalQuestions : (adminId != null ? questionRepository.countByAdminId(adminId) : questionRepository.count());
        long completedQuestionsCount = sumCompletedQuestions;

        // Fetch completed question IDs to exclude them from pending/unattended
        List<Long> completedQIdsFromSqs = studentQuestionStatusRepository.findByStudentIdAndStatus(studentId, "COMPLETED")
                .stream().map(com.chillcode.assessment.entity.StudentQuestionStatus::getQuestionId).collect(Collectors.toList());
        List<Long> completedQIdsFromSub = submissionRepository.findSolvedQuestionIdsByStudentId(studentId);
        
        Set<Long> completedQIds = new HashSet<>();
        if (completedQIdsFromSqs != null) completedQIds.addAll(completedQIdsFromSqs);
        if (completedQIdsFromSub != null) completedQIds.addAll(completedQIdsFromSub);
        if (completedQuestionsCount < completedQIds.size()) {
            completedQuestionsCount = completedQIds.size();
        }

        // Pending = questions attempted but not yet completed
        List<com.chillcode.assessment.entity.StudentQuestionStatus> allStudentStatuses = studentQuestionStatusRepository.findByStudentId(studentId);
        Set<Long> pendingQIds = new HashSet<>();
        for (com.chillcode.assessment.entity.StudentQuestionStatus sqs : allStudentStatuses) {
            if (!completedQIds.contains(sqs.getQuestionId())) {
                boolean hasAttempted = (sqs.getAttemptCount() != null && sqs.getAttemptCount() > 0) ||
                        ("IN_PROGRESS".equals(sqs.getStatus()) || "FAILED".equals(sqs.getStatus()) ||
                         "SUSPENDED".equals(sqs.getStatus()) || "PENDING".equals(sqs.getStatus()) ||
                         "PENDING_REATTEMPT".equals(sqs.getStatus()));
                if (hasAttempted && !"NOT_STARTED".equals(sqs.getStatus())) {
                    pendingQIds.add(sqs.getQuestionId());
                }
            }
        }
        long pendingQuestionsCount = pendingQIds.size();

        // Unattended = remaining unattempted questions
        long unattendedQuestionsCount = Math.max(0, totalQuestionsCount - (completedQuestionsCount + pendingQuestionsCount));

        // Calculate average score of all valid student tests
        double totalScore = validMyTests.stream()
                .filter(st -> st.getSubmittedAt() != null || "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()))
                .mapToInt(st -> st.getScore() != null ? st.getScore() : 0)
                .average()
                .orElse(0.0);

        int totalBadges = 0;
        try {
            int achievementsCount = (int) studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(studentId).stream()
                    .filter(sa -> "ACTIVE".equalsIgnoreCase(sa.getStatus()))
                    .count();
            int manualBadgesCount = (int) studentBadgeRepository.findByStudentId(studentId).stream()
                    .filter(sb -> "ACTIVE".equalsIgnoreCase(sb.getStatus()))
                    .count();
            int languageBadgesCount = languageMasterBadgeRepository.findByStudentIdOrderByAwardedDateDesc(studentId).size();
            totalBadges = achievementsCount + manualBadgesCount + languageBadgesCount;
        } catch (Exception ignored) {}

        Map<String, Object> stats = new HashMap<>();
        stats.put("unattendedTests", unattendedQuestionsCount);
        stats.put("completedTests", completedQuestionsCount);
        stats.put("inProgressTests", pendingQuestionsCount);
        stats.put("pendingTests", pendingQuestionsCount);
        stats.put("totalTests", validMyTests.size());
        stats.put("averageScore", Math.round(totalScore * 100.0) / 100.0);
        stats.put("totalQuestions", totalQuestionsCount);
        stats.put("completedQuestions", completedQuestionsCount);
        stats.put("subjectStats", subjectStatsList);
        stats.put("totalBadges", totalBadges);

        // Recent activity logs: fetch latest 5 submissions made by the student
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
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        List<com.chillcode.assessment.entity.User> students = adminId != null ? 
                userRepository.findByRoleAndAdminId(com.chillcode.assessment.entity.Role.STUDENT, adminId) :
                userRepository.findAll().stream()
                        .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                        .collect(Collectors.toList());
        
        for (com.chillcode.assessment.entity.User student : students) {
            Notification notification = Notification.builder()
                    .user(student)
                    .admin(student.getAdmin() != null ? student.getAdmin() : com.chillcode.assessment.security.SecurityUtils.getCurrentUser())
                    .title(title)
                    .message(message)
                    .type("GENERAL")
                    .isRead(false)
                    .build();
            notificationRepository.save(notification);
        }
    }
}
