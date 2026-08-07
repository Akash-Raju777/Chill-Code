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

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @GetMapping("/dashboard")
    public ResponseEntity<DashboardMetricsDto> getDashboardMetrics() {
        return ResponseEntity.ok(adminService.getDashboardMetrics());
    }

    @GetMapping("/students")
    public ResponseEntity<List<User>> getAllStudents() {
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        List<User> students = userRepository.findByRoleAndAdminId(Role.STUDENT, adminId);
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
        studentRequest.setAdmin(com.chillcode.assessment.security.SecurityUtils.getCurrentUser());
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
            Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
            if (existingUser.getAdmin() == null || !existingUser.getAdmin().getId().equals(adminId)) {
                return ResponseEntity.status(403).body("Access Denied");
            }

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
                if (studentRequest.getStatus() == com.chillcode.assessment.entity.UserStatus.ACTIVE || studentRequest.getStatus() == com.chillcode.assessment.entity.UserStatus.NO_SECURITY || studentRequest.getStatus() == com.chillcode.assessment.entity.UserStatus.INACTIVE) {
                    existingUser.setSuspensionEndTime(null);
                    java.util.List<com.chillcode.assessment.entity.StudentTest> studentTests = studentTestRepository.findByStudentId(existingUser.getId());
                    for (com.chillcode.assessment.entity.StudentTest st : studentTests) {
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

                    // Reset suspended question statuses to IN_PROGRESS so they can be re-attempted
                    java.util.List<com.chillcode.assessment.entity.StudentQuestionStatus> questionStatuses = studentQuestionStatusRepository.findByStudentId(existingUser.getId());
                    for (com.chillcode.assessment.entity.StudentQuestionStatus sqs : questionStatuses) {
                        if ("SUSPENDED".equals(sqs.getStatus())) {
                            sqs.setStatus("IN_PROGRESS");
                            studentQuestionStatusRepository.save(sqs);
                        }
                    }
                }
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
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> forgiveStudent(@RequestParam String registerNumber) {
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        java.util.Optional<User> studentOpt = userRepository.findByRoleAndAdminId(Role.STUDENT, adminId).stream()
                .filter(u -> registerNumber.equals(u.getRegisterNumber()) || registerNumber.equals(u.getUsername()) || registerNumber.equalsIgnoreCase(u.getName()))
                .findFirst();
        if (studentOpt.isEmpty()) {
            return ResponseEntity.ok("No student security logs found to forgive for: " + registerNumber);
        }

        User student = studentOpt.get();
        if (student.getStatus() != com.chillcode.assessment.entity.UserStatus.NO_SECURITY) {
            student.setStatus(com.chillcode.assessment.entity.UserStatus.ACTIVE);
        }
        student.setSuspensionEndTime(null);
        userRepository.save(student);

        // Delete all warnings permanently from database for this student
        entityManager.createQuery("DELETE FROM Warning w WHERE w.studentTest.student.id = :stuId")
                .setParameter("stuId", student.getId())
                .executeUpdate();

        // Reset student tests suspension flags
        java.util.List<com.chillcode.assessment.entity.StudentTest> studentTests = studentTestRepository.findByStudentId(student.getId());
        for (com.chillcode.assessment.entity.StudentTest st : studentTests) {
            st.setWarningsCount(0);
            st.setIsSuspended(false);
            if ("SUSPENDED".equals(st.getStatus())) {
                st.setStatus("STARTED");
            }
            studentTestRepository.save(st);
        }

        // Reset suspended question statuses to IN_PROGRESS so they can be re-attempted
        java.util.List<com.chillcode.assessment.entity.StudentQuestionStatus> questionStatuses = studentQuestionStatusRepository.findByStudentId(student.getId());
        for (com.chillcode.assessment.entity.StudentQuestionStatus sqs : questionStatuses) {
            if ("SUSPENDED".equals(sqs.getStatus())) {
                sqs.setStatus("IN_PROGRESS");
                studentQuestionStatusRepository.save(sqs);
            }
        }

        return ResponseEntity.ok("Student suspension has been lifted.");
    }

    @DeleteMapping("/students/{id}")
    public ResponseEntity<Void> deleteStudent(@PathVariable Long id) {
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        java.util.Optional<User> existingUser = userRepository.findById(id);
        if (existingUser.isPresent() && existingUser.get().getAdmin() != null && existingUser.get().getAdmin().getId().equals(adminId)) {
            adminService.deleteStudent(id);
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(403).build();
    }
}
