package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/super-admin/permissions")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class RolePermissionController {

    private static final List<String> AVAILABLE_PERMISSIONS = Arrays.asList(
            "VIEW_STUDENTS", "MANAGE_STUDENTS", "CREATE_QUESTIONS", "EDIT_QUESTIONS",
            "CREATE_TESTS", "VIEW_RESULTS", "MANAGE_BADGES", "VIEW_ANALYTICS"
    );

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/available")
    public ResponseEntity<List<String>> getAvailablePermissions() {
        return ResponseEntity.ok(AVAILABLE_PERMISSIONS);
    }

    @GetMapping("/staff/{staffId}")
    public ResponseEntity<Map<String, Object>> getStaffPermissions(@PathVariable Long staffId) {
        User staff = userRepository.findById(staffId)
                .orElseThrow(() -> new RuntimeException("Staff not found"));
        Map<String, Object> result = new HashMap<>();
        result.put("staffId", staff.getId());
        result.put("staffName", staff.getName());
        result.put("role", staff.getRole().name());
        result.put("permissions", AVAILABLE_PERMISSIONS);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/all-staff")
    public ResponseEntity<List<Map<String, Object>>> getAllStaffPermissions() {
        List<User> staff = userRepository.findByRole(Role.ADMIN);
        List<Map<String, Object>> result = new ArrayList<>();
        for (User s : staff) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", s.getId());
            item.put("name", s.getName());
            item.put("username", s.getUsername());
            item.put("role", s.getRole().name());
            item.put("status", s.getStatus() != null ? s.getStatus().name() : "ACTIVE");
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }
}
