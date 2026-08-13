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
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.chillcode.assessment.security.CustomUserDetails) {
            return ((com.chillcode.assessment.security.CustomUserDetails) principal).getUser();
        }
        String identifier = SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
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
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> startTest(
            @PathVariable("id") Long id,
            @RequestParam(value = "questionId", required = false) Long questionId) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.startTestDto(id, student.getId(), questionId));
    }

    @PostMapping("/student/tests/{id}/submit")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> submitTest(
            @PathVariable("id") Long id,
            @RequestParam(value = "isAutoSubmitted", required = false, defaultValue = "false") boolean isAutoSubmitted,
            @RequestBody(required = false) java.util.Map<String, java.util.Map<String, String>> questionCodes) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.submitTestDto(id, student.getId(), questionCodes, isAutoSubmitted));
    }

    @PostMapping("/student/tests/{id}/exit")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> exitTest(
            @PathVariable("id") Long id,
            @RequestParam(value = "questionId", required = false) Long questionId) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.exitTestDto(id, student.getId(), questionId));
    }

    @PostMapping("/student/tests/{id}/warning")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> logWarning(
            @PathVariable("id") Long id, 
            @RequestParam("type") String type, 
            @RequestParam("reason") String reason,
            @RequestParam(value = "questionId", required = false) Long questionId) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.recordWarningDto(id, student.getId(), type, reason, questionId));
    }

    @PostMapping("/student/tests/{id}/request-reattempt")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> requestReattempt(
            @PathVariable("id") Long id,
            @RequestParam("questionId") Long questionId) {
        User student = getCurrentUser();
        return ResponseEntity.ok(testService.requestReattempt(id, student.getId(), questionId));
    }

    @GetMapping("/admin/tests/reattempt-requests")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<com.chillcode.assessment.dto.StudentTestDto>> getPendingReattempts() {
        return ResponseEntity.ok(testService.getPendingReattempts());
    }

    @PostMapping("/admin/tests/reattempt-requests/{studentTestId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> approveReattempt(
            @PathVariable("studentTestId") Long studentTestId,
            @RequestParam(value = "questionId", required = false) Long questionId) {
        return ResponseEntity.ok(testService.approveReattempt(studentTestId, questionId));
    }

    @PostMapping("/admin/tests/reattempt-requests/{studentTestId}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.chillcode.assessment.dto.StudentTestDto> rejectReattempt(
            @PathVariable("studentTestId") Long studentTestId,
            @RequestParam(value = "questionId", required = false) Long questionId) {
        return ResponseEntity.ok(testService.rejectReattempt(studentTestId, questionId));
    }
}
