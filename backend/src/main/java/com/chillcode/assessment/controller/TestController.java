package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.TestDto;
import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.entity.Test;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.service.TestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class TestController {

    @Autowired
    private TestService testService;

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

    // Admin endpoints
    @PostMapping("/admin/tests")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Test> createTest(@RequestBody TestDto testDto) {
        return ResponseEntity.ok(testService.createTest(testDto));
    }

    @GetMapping("/admin/tests")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Test>> getAllTests() {
        return ResponseEntity.ok(testService.getAllTests());
    }

    @GetMapping("/admin/tests/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Test> getTestById(@PathVariable Long id) {
        return testService.getTestById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    // Student endpoints
    @GetMapping("/student/tests")
    public ResponseEntity<List<com.chillcode.assessment.dto.StudentTestDto>> getMyTests() {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.getTestsForStudentDto(student.getId()));
    }

    @PostMapping("/student/tests/{id}/start")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> startTest(@PathVariable("id") Long id) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.startTestDto(id, student.getId()));
    }

    @PostMapping("/student/tests/{id}/submit")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> submitTest(@PathVariable("id") Long id) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.submitTestDto(id, student.getId()));
    }

    @PostMapping("/student/tests/{id}/warning")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> logWarning(
            @PathVariable("id") Long id, 
            @RequestParam("type") String type, 
            @RequestParam("reason") String reason) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.recordWarningDto(id, student.getId(), type, reason));
    }
}
