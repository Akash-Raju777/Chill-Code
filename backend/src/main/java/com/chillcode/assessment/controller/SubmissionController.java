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

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    private com.chillcode.assessment.entity.User getCurrentUser() {
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.chillcode.assessment.security.CustomUserDetails) {
            return ((com.chillcode.assessment.security.CustomUserDetails) principal).getUser();
        }
        String identifier = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    @PostMapping("/submissions")
    public ResponseEntity<com.chillcode.assessment.dto.SubmissionResponseDto> submitCode(@RequestBody SubmitRequest submitRequest) {
        SubmissionResultDto result = codeExecutionService.submitCode(submitRequest);
        
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
                    response.setRuntimeOutput("Output mismatch.");
                }
            } else {
                response.setRuntimeOutput("Output mismatch.");
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

        // Evaluation metrics
        response.setScore(result.getScore());
        response.setTotalMarks(result.getTotalMarks());
        response.setPassingMarks(result.getPassingMarks());
        response.setPercentage(result.getPercentage());
        response.setOverallResult(result.getOverallResult());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/submissions")
    public ResponseEntity<List<java.util.Map<String, Object>>> getMySubmissions() {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        List<Submission> submissions = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(student.getId());
        
        List<com.chillcode.assessment.entity.StudentQuestionStatus> sqsList = studentQuestionStatusRepository.findByStudentId(student.getId());
        java.util.Map<Long, com.chillcode.assessment.entity.StudentQuestionStatus> sqsMap = sqsList.stream()
                .collect(java.util.stream.Collectors.toMap(com.chillcode.assessment.entity.StudentQuestionStatus::getQuestionId, s -> s, (s1, s2) -> s1));

        List<java.util.Map<String, Object>> result = new java.util.ArrayList<>();
        for (Submission sub : submissions) {
            if (sub.getQuestion() == null) {
                continue; // Exclude deleted questions
            }
            java.util.Map<String, Object> map = new java.util.HashMap<>();
            map.put("id", sub.getId());
            map.put("language", sub.getLanguage());
            map.put("code", sub.getCode());
            map.put("status", sub.getStatus());
            map.put("runTimeMs", sub.getRunTimeMs());
            map.put("memoryUsedKb", sub.getMemoryUsedKb());
            map.put("compileError", sub.getCompileError());
            map.put("stdout", sub.getStdout());
            map.put("stderr", sub.getStderr());
            map.put("expectedOutput", sub.getExpectedOutput());
            map.put("actualOutput", sub.getActualOutput());
            map.put("failedTestCaseNumber", sub.getFailedTestCaseNumber());
            map.put("passedTests", sub.getPassedTests());
            map.put("totalTests", sub.getTotalTests());
            map.put("score", sub.getScore());
            map.put("totalMarks", sub.getTotalMarks());
            map.put("passingMarks", sub.getPassingMarks());
            map.put("percentage", sub.getPercentage());
            map.put("overallResult", sub.getOverallResult() != null ? sub.getOverallResult() : ("ACCEPTED".equals(sub.getStatus()) ? "PASS" : "FAIL"));
            map.put("createdAt", sub.getCreatedAt());
            
            map.put("questionId", sub.getQuestion().getId());
            map.put("questionName", sub.getQuestion().getTitle());
            if (sub.getQuestion().getSubject() != null) {
                map.put("subjectName", sub.getQuestion().getSubject().getName());
            }
            com.chillcode.assessment.entity.StudentQuestionStatus sqs = sqsMap.get(sub.getQuestion().getId());
            int rawAttempts = sqs != null && sqs.getAttemptCount() != null ? sqs.getAttemptCount() : 1;
            boolean isComp = "COMPLETED".equals(sqs != null ? sqs.getStatus() : "") || "ACCEPTED".equals(sub.getStatus()) || "PASS".equals(sub.getOverallResult());
            int displayAttempts = isComp ? Math.max(0, rawAttempts - 1) : rawAttempts;
            map.put("attempts", displayAttempts);

            if (sub.getStudentTest() != null && sub.getStudentTest().getTest() != null) {
                map.put("testId", sub.getStudentTest().getTest().getId());
            }
            result.add(map);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/submissions/solved")
    public ResponseEntity<List<String>> getSolvedQuestionIds() {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        List<String> solvedPairs = submissionRepository.findSolvedTestQuestionPairsByStudentId(student.getId());
        return ResponseEntity.ok(solvedPairs);
    }

    @GetMapping("/submissions/test/{studentTestId}/question/{questionId}")
    public ResponseEntity<List<Submission>> getSubmissions(
            @PathVariable Long studentTestId, 
            @PathVariable Long questionId) {
        List<Submission> history = submissionRepository.findByStudentTestIdAndQuestionId(studentTestId, questionId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/submissions/question/{questionId}")
    public ResponseEntity<List<Submission>> getSubmissionsForQuestion(@PathVariable Long questionId) {
        com.chillcode.assessment.entity.User student = getCurrentUser();
        List<Submission> history = submissionRepository.findByStudentIdAndQuestionIdOrderByCreatedAtDesc(student.getId(), questionId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/submissions/{id}")
    public ResponseEntity<java.util.Map<String, Object>> getSubmissionById(@PathVariable Long id) {
        Submission sub = submissionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Submission not found"));
        
        java.util.Map<String, Object> res = new java.util.HashMap<>();
        res.put("id", sub.getId());
        res.put("language", sub.getLanguage());
        res.put("code", sub.getCode());
        res.put("status", sub.getStatus());
        res.put("runTimeMs", sub.getRunTimeMs());
        res.put("memoryUsedKb", sub.getMemoryUsedKb());
        res.put("compileError", sub.getCompileError());
        res.put("stdout", sub.getStdout());
        res.put("stderr", sub.getStderr());
        res.put("expectedOutput", sub.getExpectedOutput());
        res.put("actualOutput", sub.getActualOutput());
        res.put("failedTestCaseNumber", sub.getFailedTestCaseNumber());
        res.put("passedTests", sub.getPassedTests());
        res.put("totalTests", sub.getTotalTests());
        res.put("judge0Token", sub.getJudge0Token());
        res.put("createdAt", sub.getCreatedAt());
        
        // Detailed evaluation metrics
        int qTotal = sub.getTotalMarks() != null && sub.getTotalMarks() > 0 ? sub.getTotalMarks() : 
                     (sub.getQuestion() != null && sub.getQuestion().getTotalMarks() != null ? sub.getQuestion().getTotalMarks() : 20);
        int qPassing = sub.getPassingMarks() != null && sub.getPassingMarks() > 0 ? sub.getPassingMarks() :
                       (sub.getQuestion() != null && sub.getQuestion().getPassingMarks() != null ? sub.getQuestion().getPassingMarks() : 10);
        int obtainedScore = sub.getScore() != null ? sub.getScore() : 0;
        double pct = sub.getPercentage() != null ? sub.getPercentage() : (qTotal > 0 ? Math.round(((double) obtainedScore * 100.0 / qTotal) * 100.0) / 100.0 : 0.0);
        String overall = sub.getOverallResult() != null ? sub.getOverallResult() : (obtainedScore >= qPassing ? "PASS" : "FAIL");

        res.put("score", obtainedScore);
        res.put("totalMarks", qTotal);
        res.put("passingMarks", qPassing);
        res.put("percentage", pct);
        res.put("overallResult", overall);

        // Build detailed test case breakdown list
        List<java.util.Map<String, Object>> tcDetails = new java.util.ArrayList<>();
        if (sub.getSubmissionTestCases() != null && !sub.getSubmissionTestCases().isEmpty()) {
            for (com.chillcode.assessment.entity.SubmissionTestCase stc : sub.getSubmissionTestCases()) {
                java.util.Map<String, Object> tcMap = new java.util.HashMap<>();
                tcMap.put("id", stc.getId());
                tcMap.put("status", stc.getStatus());
                tcMap.put("runTimeMs", stc.getRunTimeMs());
                tcMap.put("memoryUsedKb", stc.getMemoryUsedKb());
                tcMap.put("message", stc.getMessage());
                tcMap.put("marksAwarded", stc.getMarksAwarded() != null ? stc.getMarksAwarded() : 0);
                if (stc.getTestCase() != null) {
                    tcMap.put("testCaseId", stc.getTestCase().getId());
                    tcMap.put("inputData", stc.getTestCase().getInputData());
                    tcMap.put("expectedOutput", stc.getTestCase().getExpectedOutput());
                    tcMap.put("isHidden", stc.getTestCase().getIsHidden());
                    tcMap.put("marks", stc.getTestCase().getMarks() != null ? stc.getTestCase().getMarks() : 5);
                }
                tcDetails.add(tcMap);
            }
        }
        res.put("testCaseResults", tcDetails);
        
        if (sub.getQuestion() != null) {
            res.put("questionId", sub.getQuestion().getId());
            res.put("questionName", sub.getQuestion().getTitle());
            if (sub.getQuestion().getSubject() != null) {
                res.put("subjectName", sub.getQuestion().getSubject().getName());
            }
        }
        
        if (sub.getStudentTest() != null && sub.getStudentTest().getTest() != null) {
            res.put("testId", sub.getStudentTest().getTest().getId());
        }
        
        return ResponseEntity.ok(res);
    }
}
