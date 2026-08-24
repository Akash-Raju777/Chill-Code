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
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.chillcode.assessment.security.CustomUserDetails) {
            return ((com.chillcode.assessment.security.CustomUserDetails) principal).getUser();
        }
        String identifier = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    @Autowired
    private com.chillcode.assessment.repository.QuestionRepository questionRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentTestRepository studentTestRepository;

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
        log.info("API Request: Get question ID: {}", id);
        return ResponseEntity.ok(questionService.getQuestionById(id));
    }

    @PostMapping("/admin/questions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<QuestionDto> createQuestion(@RequestBody QuestionDto questionDto) {
        log.info("API Request: Create question: {}", questionDto.getTitle());
        return ResponseEntity.ok(questionService.createQuestion(questionDto));
    }

    @PutMapping("/admin/questions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<QuestionDto> updateQuestion(@PathVariable("id") Long id, @RequestBody QuestionDto questionDto) {
        log.info("API Request: Update question ID: {}", id);
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
            
            // Resolve adminId robustly through StudentTest/Test relationships first
            Long adminId = null;
            Long studentTestId = null;
            Long testId = null;

            List<com.chillcode.assessment.entity.StudentTest> studentTests = studentTestRepository.findByStudentIdWithTestAndQuestions(student.getId());
            com.chillcode.assessment.entity.StudentTest matchingStudentTest = studentTests.stream()
                .filter(st -> st.getTest() != null && st.getTest().getQuestions().stream().anyMatch(q -> q.getId().equals(questionId)))
                .findFirst()
                .orElse(null);

            if (matchingStudentTest != null) {
                studentTestId = matchingStudentTest.getId();
                if (matchingStudentTest.getTest() != null) {
                    testId = matchingStudentTest.getTest().getId();
                    if (matchingStudentTest.getTest().getAdmin() != null) {
                        adminId = matchingStudentTest.getTest().getAdmin().getId();
                    }
                }
                if (adminId == null && matchingStudentTest.getAdmin() != null) {
                    adminId = matchingStudentTest.getAdmin().getId();
                }
                if (adminId == null && matchingStudentTest.getStudent() != null && matchingStudentTest.getStudent().getAdmin() != null) {
                    adminId = matchingStudentTest.getStudent().getAdmin().getId();
                }
            }

            // Fallback to Current Admin ID or Question Admin
            if (adminId == null) {
                adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
            }
            if (adminId == null) {
                com.chillcode.assessment.entity.Question q = questionRepository.findById(questionId).orElse(null);
                if (q != null && q.getAdmin() != null) {
                    adminId = q.getAdmin().getId();
                }
            }

            if (adminId == null) {
                String diag = String.format("studentTestId=%s, testId=%s, questionId=%s",
                    studentTestId != null ? studentTestId : "null",
                    testId != null ? testId : "null",
                    questionId);
                log.error("Cannot determine admin ownership for student question status creation. Diagnostics: {}", diag);
                throw new RuntimeException("Cannot determine admin ownership for student question status. Diagnostics: " + diag);
            }

            status.setAdminId(adminId);
            status.setStudentId(student.getId());
            status.setQuestionId(questionId);
            status.setStatus("IN_PROGRESS");
            status.setAttemptCount(0);
            try {
                status = studentQuestionStatusRepository.save(status);
            } catch (org.springframework.dao.DataIntegrityViolationException e) {
                status = studentQuestionStatusRepository
                        .findByStudentIdAndQuestionId(student.getId(), questionId)
                        .orElse(status);
            }
            
            log.info("[QuestionStatus] Created new status entry for studentId={}, questionId={}, adminId={}", 
                student.getId(), questionId, adminId);
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

        // Reset the timer for the Practice Arena test so it starts fresh
        List<com.chillcode.assessment.entity.StudentTest> tests = studentTestRepository.findByStudentIdWithTestAndQuestions(student.getId());
        for (com.chillcode.assessment.entity.StudentTest st : tests) {
            if (st.getTest() != null && st.getTest().getName() != null && st.getTest().getName().startsWith("Practice Arena: ")) {
                if (st.getTest().getQuestions() != null && st.getTest().getQuestions().stream().anyMatch(q -> q.getId().equals(questionId))) {
                    st.setStartedAt(null);
                    st.setTimeTakenSeconds(0L);
                    studentTestRepository.save(st);
                    break;
                }
            }
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
