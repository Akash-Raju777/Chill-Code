package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.DashboardMetricsDto;
import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.service.AdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.chillcode.assessment.repository.StudentTestRepository studentTestRepository;

    @Autowired
    private com.chillcode.assessment.repository.WarningRepository warningRepository;

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardMetricsDto> getDashboardMetrics() {
        return ResponseEntity.ok(adminService.getDashboardMetrics());
    }

    @GetMapping("/students")
    public ResponseEntity<List<User>> getAllStudents() {
        List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .collect(Collectors.toList());
        return ResponseEntity.ok(students);
    }

    @PostMapping("/students")
    public ResponseEntity<?> createStudent(@RequestBody User studentRequest) {
        if (studentRequest.getEmail() != null && userRepository.existsByEmail(studentRequest.getEmail())) {
            return ResponseEntity.badRequest().body("Email is already registered.");
        }
        if (studentRequest.getRegisterNumber() != null && userRepository.existsByRegisterNumber(studentRequest.getRegisterNumber())) {
            return ResponseEntity.badRequest().body("Register number is already taken.");
        }

        studentRequest.setRole(Role.STUDENT);
        if (studentRequest.getPassword() != null && !studentRequest.getPassword().isBlank()) {
            studentRequest.setPassword(passwordEncoder.encode(studentRequest.getPassword()));
        } else {
            studentRequest.setPassword(passwordEncoder.encode("password"));
        }

        User savedStudent = userRepository.save(studentRequest);
        return ResponseEntity.ok(savedStudent);
    }

    @PutMapping("/students/{id}")
    public ResponseEntity<?> updateStudent(@PathVariable Long id, @RequestBody User studentRequest) {
        return userRepository.findById(id).map(existingUser -> {
            if (studentRequest.getEmail() != null && !studentRequest.getEmail().equalsIgnoreCase(existingUser.getEmail())) {
                if (userRepository.existsByEmail(studentRequest.getEmail())) {
                    return ResponseEntity.badRequest().body("Email is already registered.");
                }
                existingUser.setEmail(studentRequest.getEmail());
            }

            if (studentRequest.getRegisterNumber() != null && !studentRequest.getRegisterNumber().equalsIgnoreCase(existingUser.getRegisterNumber())) {
                if (userRepository.existsByRegisterNumber(studentRequest.getRegisterNumber())) {
                    return ResponseEntity.badRequest().body("Register number is already taken.");
                }
                existingUser.setRegisterNumber(studentRequest.getRegisterNumber());
            }

            if (studentRequest.getName() != null) {
                existingUser.setName(studentRequest.getName());
            }
            if (studentRequest.getDepartment() != null) {
                existingUser.setDepartment(studentRequest.getDepartment());
            }
            if (studentRequest.getStatus() != null) {
                existingUser.setStatus(studentRequest.getStatus());
            }
            if (studentRequest.getPassword() != null && !studentRequest.getPassword().isBlank()) {
                if (!studentRequest.getPassword().startsWith("$2a$")) {
                    existingUser.setPassword(passwordEncoder.encode(studentRequest.getPassword()));
                }
            }

            User savedUser = userRepository.save(existingUser);
            return ResponseEntity.ok(savedUser);
        }).orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/student/forgive")
    public ResponseEntity<?> forgiveStudent(@RequestParam String registerNumber) {
        java.util.Optional<User> studentOpt = userRepository.findByRegisterNumber(registerNumber);
        if (studentOpt.isEmpty()) {
            studentOpt = userRepository.findByUsername(registerNumber);
        }
        if (studentOpt.isEmpty()) {
            studentOpt = userRepository.findAll().stream()
                    .filter(u -> u.getName().equalsIgnoreCase(registerNumber))
                    .findFirst();
        }
        if (studentOpt.isEmpty()) {
            return ResponseEntity.badRequest().body("Student not found with register number/name: " + registerNumber);
        }

        User student = studentOpt.get();
        student.setStatus(com.chillcode.assessment.entity.UserStatus.ACTIVE);
        student.setSuspensionEndTime(null);
        userRepository.save(student);

        // Find all student tests for this student, delete their warnings, and reset their suspension state
        java.util.List<com.chillcode.assessment.entity.StudentTest> studentTests = studentTestRepository.findByStudentId(student.getId());
        for (com.chillcode.assessment.entity.StudentTest st : studentTests) {
            // Delete warnings from Warning table so they disappear from the admin dashboard activities feed
            java.util.List<com.chillcode.assessment.entity.Warning> warnings = warningRepository.findByStudentTestId(st.getId());
            if (warnings != null && !warnings.isEmpty()) {
                warningRepository.deleteAll(warnings);
            }

            st.setWarningsCount(0);
            st.setIsSuspended(false);
            if ("SUSPENDED".equals(st.getStatus())) {
                st.setStatus("STARTED");
            }
            studentTestRepository.save(st);
        }

        return ResponseEntity.ok("Student suspension has been lifted.");
    }
}
