package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.QuestionDto;
import com.chillcode.assessment.service.QuestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
public class QuestionController {

    private static final Logger log = LoggerFactory.getLogger(QuestionController.class);

    @Autowired
    private QuestionService questionService;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Autowired
    private com.chillcode.assessment.service.CodeExecutionService codeExecutionService;

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

    // Both Admin and Student can get questions list of a subject
    @GetMapping({"/admin/subjects/{subjectId}/questions", "/student/subjects/{subjectId}/questions"})
    public ResponseEntity<List<QuestionDto>> getQuestionsBySubject(@PathVariable("subjectId") Long subjectId) {
        log.info("API Request: Load questions for subject ID: {}", subjectId);
        return ResponseEntity.ok(questionService.getQuestionsBySubject(subjectId));
    }

    @GetMapping({"/admin/questions", "/student/questions"})
    public ResponseEntity<List<QuestionDto>> getAllQuestions() {
        log.info("API Request: Load all questions");
        return ResponseEntity.ok(questionService.getAllQuestions());
    }

    @GetMapping({"/admin/questions/{id}", "/student/questions/{id}"})
    public ResponseEntity<QuestionDto> getQuestionById(@PathVariable("id") Long id) {
        log.info("API Request: Load question by ID: {}", id);
        return ResponseEntity.ok(questionService.getQuestionById(id));
    }

    @PostMapping("/admin/questions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<QuestionDto> createQuestion(@RequestBody QuestionDto questionDto) {
        log.info("API Request: Create question with title: {}", questionDto.getTitle());
        return ResponseEntity.ok(questionService.createQuestion(questionDto));
    }

    @PutMapping("/admin/questions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<QuestionDto> updateQuestion(@PathVariable("id") Long id, @RequestBody QuestionDto questionDto) {
        log.info("API Request: Update question ID: {} with title: {}", id, questionDto.getTitle());
        return ResponseEntity.ok(questionService.updateQuestion(id, questionDto));
    }

    @DeleteMapping("/admin/questions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteQuestion(@PathVariable("id") Long id) {
        log.info("API Request: Delete question ID: {}", id);
        questionService.deleteQuestion(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/student/question/{id}/status")
    public ResponseEntity<com.chillcode.assessment.entity.StudentQuestionStatus> getQuestionStatus(@PathVariable("id") Long questionId) {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        com.chillcode.assessment.entity.StudentQuestionStatus status = studentQuestionStatusRepository
                .findByStudentIdAndQuestionId(student.getId(), questionId)
                .orElse(null);
        if (status == null) {
            status = new com.chillcode.assessment.entity.StudentQuestionStatus();
            status.setStudentId(student.getId());
            status.setQuestionId(questionId);
            status.setStatus("IN_PROGRESS");
            status.setAttemptCount(0);
            status = studentQuestionStatusRepository.save(status);
        } else if ("NOT_STARTED".equals(status.getStatus()) || "NOT_COMPLETED".equals(status.getStatus())) {
            status.setStatus("IN_PROGRESS");
            status = studentQuestionStatusRepository.save(status);
        }
        return ResponseEntity.ok(status);
    }

    @PostMapping("/student/question/{id}/submit")
    public ResponseEntity<com.chillcode.assessment.dto.SubmissionResponseDto> submitCodeForQuestion(
            @PathVariable("id") Long questionId,
            @RequestBody com.chillcode.assessment.dto.SubmitRequest submitRequest) {
        submitRequest.setQuestionId(questionId);
        com.chillcode.assessment.dto.SubmissionResultDto result = codeExecutionService.submitCode(submitRequest);
        
        com.chillcode.assessment.dto.SubmissionResponseDto response = new com.chillcode.assessment.dto.SubmissionResponseDto();
        response.setStatus(result.getStatus());
        response.setCompilerOutput(result.getCompileError());
        
        if ("COMPILATION_ERROR".equals(result.getStatus())) {
            response.setRuntimeOutput(null);
        } else if ("RUNTIME_ERROR".equals(result.getStatus())) {
            response.setRuntimeOutput(result.getStderr());
        } else if ("WRONG_ANSWER".equals(result.getStatus())) {
            if (result.getTestCaseResults() != null) {
                java.util.Optional<com.chillcode.assessment.dto.TestCaseResultDto> failedTcOpt = result.getTestCaseResults().stream()
                        .filter(tc -> !"PASSED".equals(tc.getStatus()))
                        .findFirst();
                if (failedTcOpt.isPresent()) {
                    response.setRuntimeOutput(failedTcOpt.get().getMessage());
                } else {
                    response.setRuntimeOutput("Output doesn't match expected output.");
                }
            } else {
                response.setRuntimeOutput("Output doesn't match expected output.");
            }
        } else if ("ACCEPTED".equals(result.getStatus())) {
            response.setRuntimeOutput(result.getStdout());
        } else {
            response.setRuntimeOutput(result.getStderr() != null ? result.getStderr() : result.getStdout());
        }
        
        response.setAiHint(result.getAiExplanation());
        response.setExecutionTimeMs(result.getRunTimeMs());
        response.setMemoryUsedKb(result.getMemoryUsedKb());
        response.setPassedTests(result.getPassedTests());
        response.setTotalTests(result.getTotalTests());
        response.setExpectedOutput(result.getExpectedOutput());
        response.setActualOutput(result.getActualOutput());
        response.setFailedTestCaseNumber(result.getFailedTestCaseNumber());
        response.setJudge0Status(result.getJudge0Status());
        response.setTestCaseResults(result.getTestCaseResults());
        response.setSubmissionId(result.getSubmissionId());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/student/question/{id}/another-attempt")
    public ResponseEntity<Void> anotherAttempt(@PathVariable("id") Long questionId) {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        com.chillcode.assessment.entity.StudentQuestionStatus status = studentQuestionStatusRepository
                .findByStudentIdAndQuestionId(student.getId(), questionId)
                .orElse(null);
        if (status != null) {
            status.setStatus("NOT_STARTED");
            status.setCompletedAt(null);
            studentQuestionStatusRepository.save(status);
        }
        return ResponseEntity.ok().build();
    }

    @GetMapping("/student/completed")
    public ResponseEntity<List<QuestionDto>> getCompletedQuestions() {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        List<QuestionDto> all = questionService.getAllQuestions();
        List<QuestionDto> completed = all.stream()
                .filter(q -> "COMPLETED".equals(q.getStatus()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(completed);
    }

    @GetMapping("/student/not-completed")
    public ResponseEntity<List<QuestionDto>> getNotCompletedQuestions() {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        List<QuestionDto> all = questionService.getAllQuestions();
        List<QuestionDto> notCompleted = all.stream()
                .filter(q -> !"COMPLETED".equals(q.getStatus()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(notCompleted);
    }
}
