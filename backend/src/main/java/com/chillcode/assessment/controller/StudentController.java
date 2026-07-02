package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Achievement;
import com.chillcode.assessment.entity.Notification;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.service.StudentService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/student")
public class StudentController {

    @Autowired
    private StudentService studentService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser() {
        String identifier = SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByRegisterNumber(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(identifier);
        }
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(identifier);
        }
        return userOpt.orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    @GetMapping("/dashboard/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        User student = getCurrentUser();
        return ResponseEntity.ok(studentService.getStudentDashboardStats(student.getId()));
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<Notification>> getNotifications() {
        User student = getCurrentUser();
        return ResponseEntity.ok(studentService.getNotificationsForUser(student.getId()));
    }

    @PostMapping("/notifications/{id}/read")
    public ResponseEntity<String> markRead(@PathVariable Long id) {
        User student = getCurrentUser();
        studentService.markNotificationAsRead(id, student.getId());
        return ResponseEntity.ok("Notification marked as read");
    }

    @PostMapping("/notifications")
    public ResponseEntity<?> broadcastInstruction(@RequestBody Map<String, String> payload) {
        String title = payload.get("title");
        String message = payload.get("message");
        if (title == null || message == null) {
            return ResponseEntity.badRequest().body("Title and message are required.");
        }
        studentService.broadcastNotification(title, message);
        return ResponseEntity.ok("Instruction broadcasted successfully to all students.");
    }

    @GetMapping("/achievements")
    public ResponseEntity<List<Achievement>> getAchievements() {
        User student = getCurrentUser();
        return ResponseEntity.ok(studentService.getAchievementsForUser(student.getId()));
    }
}
