package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/super-admin/staff")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class StaffController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.chillcode.assessment.security.UserDetailsServiceImpl userDetailsService;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllStaff() {
        List<User> staff = userRepository.findByRole(Role.ADMIN);
        List<Map<String, Object>> result = new ArrayList<>();
        for (User s : staff) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", s.getId());
            item.put("staffId", s.getUsername());
            item.put("name", s.getName());
            item.put("email", s.getEmail());
            item.put("phone", s.getPhone());
            item.put("department", s.getDepartment());
            item.put("status", s.getStatus() != null ? s.getStatus().name() : "ACTIVE");
            item.put("dateJoined", s.getCreatedAt());
            item.put("lastActive", s.getUpdatedAt());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getStaffById(@PathVariable Long id) {
        User staff = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Staff not found"));
        Map<String, Object> item = new HashMap<>();
        item.put("id", staff.getId());
        item.put("staffId", staff.getUsername());
        item.put("name", staff.getName());
        item.put("email", staff.getEmail());
        item.put("phone", staff.getPhone());
        item.put("department", staff.getDepartment());
        item.put("status", staff.getStatus() != null ? staff.getStatus().name() : "ACTIVE");
        item.put("dateJoined", staff.getCreatedAt());
        item.put("lastActive", staff.getUpdatedAt());
        return ResponseEntity.ok(item);
    }

    @PostMapping
    public ResponseEntity<?> createStaff(@RequestBody Map<String, Object> payload) {
        String name = (String) payload.get("name");
        String email = (String) payload.get("email");
        String username = (String) payload.get("username");
        String password = (String) payload.get("password");
        String department = (String) payload.get("department");
        String phone = (String) payload.get("phone");

        if (name == null || email == null || username == null) {
            return ResponseEntity.badRequest().body("Name, email, and username are required.");
        }
        if (userRepository.existsByEmail(email)) {
            return ResponseEntity.badRequest().body("Email already registered.");
        }
        if (userRepository.existsByUsername(username)) {
            return ResponseEntity.badRequest().body("Username already taken.");
        }

        User staff = new User();
        staff.setName(name);
        staff.setEmail(email);
        staff.setUsername(username);
        staff.setPassword(passwordEncoder.encode(password != null && !password.isBlank() ? password : "ChillCode@2024"));
        staff.setDepartment(department);
        staff.setPhone(phone);
        staff.setRole(Role.ADMIN);
        staff.setStatus(UserStatus.ACTIVE);
        User saved = userRepository.save(staff);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateStaff(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        User staff = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Staff not found"));
        if (payload.containsKey("name")) staff.setName((String) payload.get("name"));
        if (payload.containsKey("email")) staff.setEmail((String) payload.get("email"));
        if (payload.containsKey("department")) staff.setDepartment((String) payload.get("department"));
        if (payload.containsKey("phone")) staff.setPhone((String) payload.get("phone"));
        if (payload.containsKey("username")) staff.setUsername((String) payload.get("username"));
        if (payload.containsKey("status")) {
            try {
                staff.setStatus(UserStatus.valueOf((String) payload.get("status")));
            } catch (IllegalArgumentException e) {
                return ResponseEntity.badRequest().body("Invalid status value.");
            }
        }
        userRepository.save(staff);
        userDetailsService.evict(staff.getUsername());
        if (staff.getEmail() != null) userDetailsService.evict(staff.getEmail());
        return ResponseEntity.ok(staff);
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<?> toggleStaffStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        User staff = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Staff not found"));
        String newStatus = payload.get("status");
        try {
            staff.setStatus(UserStatus.valueOf(newStatus));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid status value.");
        }
        userRepository.save(staff);
        userDetailsService.evict(staff.getUsername());
        if (staff.getEmail() != null) userDetailsService.evict(staff.getEmail());
        return ResponseEntity.ok("Staff status updated to " + newStatus);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStaff(@PathVariable Long id) {
        userRepository.findById(id).ifPresent(st -> {
            userDetailsService.evict(st.getUsername());
            if (st.getEmail() != null) userDetailsService.evict(st.getEmail());
        });
        userRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }
}
