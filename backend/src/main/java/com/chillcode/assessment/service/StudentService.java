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

    public Map<String, Object> getStudentDashboardStats(Long studentId) {
        List<StudentTest> myTests = studentTestRepository.findByStudentId(studentId);
        
        long upcomingCount = myTests.stream()
                .filter(st -> "ASSIGNED".equals(st.getStatus()) && st.getTest().getStartTime().isAfter(LocalDateTime.now()))
                .count();

        long completedCount = myTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))
                .count();

        double totalScore = myTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))
                .mapToInt(StudentTest::getScore)
                .average()
                .orElse(0.0);

        Map<String, Object> stats = new HashMap<>();
        stats.put("upcomingTests", upcomingCount);
        stats.put("completedTests", completedCount);
        stats.put("averageScore", Math.round(totalScore * 100.0) / 100.0);
        stats.put("rank", 5); // Default rank for demo
        stats.put("recentActivities", myTests.stream()
                .map(st -> "Test '" + st.getTest().getName() + "' status: " + st.getStatus())
                .limit(5)
                .collect(Collectors.toList()));
        return stats;
    }

    public List<Notification> getNotificationsForUser(Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
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
