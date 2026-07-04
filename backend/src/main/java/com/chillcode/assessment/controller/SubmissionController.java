package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.SubmissionResultDto;
import com.chillcode.assessment.dto.SubmitRequest;
import com.chillcode.assessment.entity.Submission;
import com.chillcode.assessment.repository.SubmissionRepository;
import com.chillcode.assessment.service.CodeExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/student")
public class SubmissionController {

    @Autowired
    private CodeExecutionService codeExecutionService;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    private com.chillcode.assessment.entity.User getCurrentUser() {
        String identifier = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        java.util.Optional<com.chillcode.assessment.entity.User> userOpt = userRepository.findByRegisterNumber(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(identifier);
        }
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(identifier);
        }
        return userOpt.orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    @PostMapping("/submissions")
    public ResponseEntity<SubmissionResultDto> submitCode(@RequestBody SubmitRequest submitRequest) {
        SubmissionResultDto result = codeExecutionService.submitCode(submitRequest);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/submissions/solved")
    public ResponseEntity<List<Long>> getSolvedQuestionIds() {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        List<Long> solvedIds = submissionRepository.findSolvedQuestionIdsByStudentId(student.getId());
        return ResponseEntity.ok(solvedIds);
    }

    @GetMapping("/submissions/test/{studentTestId}/question/{questionId}")
    public ResponseEntity<List<Submission>> getSubmissions(
            @PathVariable Long studentTestId, 
            @PathVariable Long questionId) {
        List<Submission> history = submissionRepository.findByStudentTestIdAndQuestionId(studentTestId, questionId);
        return ResponseEntity.ok(history);
    }
}
