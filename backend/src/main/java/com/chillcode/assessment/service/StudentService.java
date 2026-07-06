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

        List<StudentTest> myTests = studentTestRepository.findByStudentId(studentId);
        
        long unattendedCount = myTests.stream()
                .filter(st -> "ASSIGNED".equals(st.getStatus()) || "STARTED".equals(st.getStatus()))
                .count();

        long completedCount = myTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))
                .count();

        double totalScore = myTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))
                .mapToInt(st -> st.getScore() != null ? st.getScore() : 0)
                .average()
                .orElse(0.0);

        Map<String, Object> stats = new HashMap<>();
        stats.put("unattendedTests", unattendedCount);
        stats.put("completedTests", completedCount);
        stats.put("averageScore", Math.round(totalScore * 100.0) / 100.0);
        
        // Group myTests by Subject
        Map<com.chillcode.assessment.entity.Subject, List<StudentTest>> testsBySubject = myTests.stream()
                .filter(st -> st.getTest() != null && st.getTest().getSubject() != null)
                .collect(Collectors.groupingBy(st -> st.getTest().getSubject()));

        List<Map<String, Object>> subjectStatsList = new java.util.ArrayList<>();
        for (Map.Entry<com.chillcode.assessment.entity.Subject, List<StudentTest>> entry : testsBySubject.entrySet()) {
            com.chillcode.assessment.entity.Subject subject = entry.getKey();
            List<StudentTest> subjectTests = entry.getValue();

            long completed = subjectTests.stream()
                    .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))
                    .count();

            long incomplete = subjectTests.stream()
                    .filter(st -> "ASSIGNED".equals(st.getStatus()) || "STARTED".equals(st.getStatus()))
                    .count();

            Map<String, Object> subMap = new HashMap<>();
            subMap.put("subjectId", subject.getId());
            subMap.put("subjectName", subject.getName());
            subMap.put("subjectColor", subject.getColor());
            subMap.put("completedCount", completed);
            subMap.put("incompleteCount", incomplete);
            subMap.put("totalCount", subjectTests.size());
            subMap.put("status", incomplete == 0 && subjectTests.size() > 0 ? "COMPLETED" : "INCOMPLETE");

            subjectStatsList.add(subMap);
        }
        stats.put("subjectStats", subjectStatsList);

        stats.put("recentActivities", myTests.stream()
                .map(st -> "Test '" + st.getTest().getName() + "' status: " + st.getStatus())
                .limit(5)
                .collect(Collectors.toList()));
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
