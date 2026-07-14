package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Achievement;
import com.chillcode.assessment.entity.Notification;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.service.StudentService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(StudentController.class);

    @Autowired
    private StudentService studentService;

    @Autowired
    private UserRepository userRepository;

    private User getCurrentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.chillcode.assessment.security.CustomUserDetails) {
            return ((com.chillcode.assessment.security.CustomUserDetails) principal).getUser();
        }
        String identifier = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    @GetMapping("/dashboard/stats")
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        User student = getCurrentUser();
        log.info("API Request: Load dashboard stats for student ID: {}", student.getId());
        return ResponseEntity.ok(studentService.getStudentDashboardStats(student.getId()));
    }

    @GetMapping("/notifications")
    public ResponseEntity<List<Notification>> getNotifications() {
        User student = getCurrentUser();
        log.info("API Request: Load notifications for student ID: {}", student.getId());
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
        log.info("API Request: Load achievements for student ID: {}", student.getId());
        return ResponseEntity.ok(studentService.getAchievementsForUser(student.getId()));
    }

    @GetMapping("/profile")
    public ResponseEntity<Map<String, Object>> getProfile() {
        User student = getCurrentUser();
        return ResponseEntity.ok(Map.of(
            "id", student.getId(),
            "name", student.getName(),
            "email", student.getEmail(),
            "role", student.getRole().name(),
            "registerNumber", student.getRegisterNumber() != null ? student.getRegisterNumber() : "",
            "username", student.getUsername() != null ? student.getUsername() : "",
            "status", student.getStatus().name(),
            "department", student.getDepartment() != null ? student.getDepartment() : ""
        ));
    }
}
