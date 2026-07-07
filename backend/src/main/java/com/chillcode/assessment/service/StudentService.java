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

    @Transactional
    public Map<String, Object> getStudentDashboardStats(Long studentId) {
        com.chillcode.assessment.entity.User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        List<com.chillcode.assessment.entity.Test> allTests = testRepository.findAll();
        for (com.chillcode.assessment.entity.Test test : allTests) {
            if (studentTestRepository.findByStudentIdAndTestId(studentId, test.getId()).isEmpty()) {
                com.chillcode.assessment.entity.StudentTest st = com.chillcode.assessment.entity.StudentTest.builder()
                        .student(student)
                        .test(test)
                        .status("ASSIGNED")
                        .score(0)
                        .warningsCount(0)
                        .isSuspended(false)
                        .build();
                studentTestRepository.save(st);
            }
        }

        // Calculate statistics based on questions and question statuses
        List<com.chillcode.assessment.entity.Question> allQuestions = questionRepository.findAll();
        List<com.chillcode.assessment.entity.StudentQuestionStatus> allStatuses = studentQuestionStatusRepository.findByStudentId(studentId);
        
        java.util.Map<Long, com.chillcode.assessment.entity.StudentQuestionStatus> statusMap = allStatuses.stream()
                .collect(Collectors.toMap(com.chillcode.assessment.entity.StudentQuestionStatus::getQuestionId, s -> s, (a, b) -> a));

        long completedQuestionsCount = allStatuses.stream()
                .filter(s -> "COMPLETED".equals(s.getStatus()))
                .count();

        long incompleteQuestionsCount = allQuestions.size() - completedQuestionsCount;

        // Calculate average score of all student tests
        List<StudentTest> myTests = studentTestRepository.findByStudentId(studentId);
        double totalScore = myTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()) || "PENDING".equals(st.getStatus()))
                .mapToInt(st -> st.getScore() != null ? st.getScore() : 0)
                .average()
                .orElse(0.0);

        long completedTestsCount = myTests.stream()
                .filter(st -> "COMPLETED".equals(st.getStatus()))
                .count();

        long unattendedTestsCount = myTests.stream()
                .filter(st -> "ASSIGNED".equals(st.getStatus()))
                .count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("unattendedTests", unattendedTestsCount);
        stats.put("completedTests", completedTestsCount);
        stats.put("averageScore", Math.round(totalScore * 100.0) / 100.0);

        // Group questions by Subject
        List<com.chillcode.assessment.entity.Subject> subjects = subjectRepository.findAll();
        List<Map<String, Object>> subjectStatsList = new java.util.ArrayList<>();
        
        for (com.chillcode.assessment.entity.Subject subject : subjects) {
            List<com.chillcode.assessment.entity.Question> subjectQuestions = allQuestions.stream()
                    .filter(q -> q.getSubject() != null && q.getSubject().getId().equals(subject.getId()))
                    .collect(Collectors.toList());

            if (subjectQuestions.isEmpty()) continue;

            long completed = subjectQuestions.stream()
                    .filter(q -> {
                        com.chillcode.assessment.entity.StudentQuestionStatus sqs = statusMap.get(q.getId());
                        return sqs != null && "COMPLETED".equals(sqs.getStatus());
                    })
                    .count();

            long incomplete = subjectQuestions.size() - completed;

            Map<String, Object> subMap = new HashMap<>();
            subMap.put("subjectId", subject.getId());
            subMap.put("subjectName", subject.getName());
            subMap.put("subjectColor", subject.getColor());
            subMap.put("completedCount", completed);
            subMap.put("incompleteCount", incomplete);
            subMap.put("totalCount", subjectQuestions.size());
            subMap.put("status", incomplete == 0 ? "COMPLETED" : "INCOMPLETE");

            subjectStatsList.add(subMap);
        }
        stats.put("subjectStats", subjectStatsList);

        // Recent activity logs: fetch latest 5 submissions made by the student
        List<com.chillcode.assessment.entity.Submission> latestSubmissions = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(studentId);
        List<String> activities = latestSubmissions.stream()
                .map(sub -> String.format("Submitted solution for '%s' - Verdict: %s",
                        sub.getQuestion() != null ? sub.getQuestion().getTitle() : "Unknown",
                        sub.getStatus()))
                .limit(5)
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
