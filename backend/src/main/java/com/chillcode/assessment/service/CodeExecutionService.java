package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.SubmissionResultDto;
import com.chillcode.assessment.dto.SubmitRequest;
import com.chillcode.assessment.dto.TestCaseResultDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;


@Service
public class CodeExecutionService {

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private SubmissionTestCaseRepository submissionTestCaseRepository;

    @Autowired
    private TestCaseRepository testCaseRepository;

    @Autowired
    private AchievementRepository achievementRepository;

    @Autowired
    private AiHintCacheRepository aiHintCacheRepository;

    @Value("${judge0.api.url}")
    private String judge0ApiUrl;

    @Value("${xai.api.key}")
    private String xaiApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .build();

    @Transactional
    public SubmissionResultDto submitCode(SubmitRequest request) {
        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new RuntimeException("Question not found"));

        StudentTest studentTest = null;
        if (request.getStudentTestId() != null) {
            studentTest = studentTestRepository.findById(request.getStudentTestId()).orElse(null);
        }

        List<TestCase> testCases = testCaseRepository.findByQuestionId(question.getId());
        String lang = request.getLanguage().toLowerCase();
        int languageId = getJudge0LanguageId(lang);

        SubmissionResultDto resultDto = new SubmissionResultDto();
        resultDto.setTestCaseResults(new ArrayList<>());
        resultDto.setRunTimeMs(0);
        resultDto.setMemoryUsedKb(0);

        // Run Code workflow (LeetCode/HackerRank Run Code with custom stdin input)
        if (request.getRunOnly() != null && request.getRunOnly()) {
            try {
                JsonNode res = executeOnJudge0(request.getCode(), languageId, request.getCustomInput(), null);
                int statusId = res.path("status").path("id").asInt();
                String verdict = mapStatusIdToVerdict(statusId);
                
                resultDto.setStatus(verdict);
                
                double time = res.path("time").asDouble();
                resultDto.setRunTimeMs((int)(time * 1000));
                
                int memory = res.path("memory").asInt();
                resultDto.setMemoryUsedKb(memory);
                
                resultDto.setStdout(decodeBase64(res.path("stdout").asText()));
                resultDto.setStderr(decodeBase64(res.path("stderr").asText()));
                
                String compileOutput = decodeBase64(res.path("compile_output").asText());
                if (!compileOutput.isBlank()) {
                    resultDto.setCompileError(compileOutput);
                }
                
                resultDto.setExitCode(verdict.equals("ACCEPTED") ? 0 : -1);

                if (!"ACCEPTED".equals(verdict)) {
                    String explanation = getGrokExplanation(verdict, request.getCode(), resultDto.getCompileError(), resultDto.getStderr(), lang, request.getCustomInput(), null, resultDto.getStdout(), studentTest, question);
                    resultDto.setAiExplanation(explanation);
                }
            } catch (Exception e) {
                resultDto.setStatus("RUNTIME_ERROR");
                resultDto.setStderr("Execution failed: " + e.getMessage());
            }
            return resultDto;
        }

        // Run Test Cases
        String overallVerdict = "ACCEPTED";
        int maxRunTimeMs = 0;
        int maxMemoryUsedKb = 0;

        if (testCases.isEmpty()) {
            overallVerdict = "WRONG_ANSWER";
            TestCaseResultDto tcResult = new TestCaseResultDto();
            tcResult.setStatus("FAILED");
            tcResult.setMessage("No test case has been set up for this question by the administrator. Please contact your coordinator.");
            resultDto.getTestCaseResults().add(tcResult);
        } else {
            for (TestCase tc : testCases) {
                TestCaseResultDto tcResult = new TestCaseResultDto();
                tcResult.setTestCaseId(tc.getId());

                try {
                    JsonNode res = executeOnJudge0(request.getCode(), languageId, tc.getInputData(), tc.getExpectedOutput());
                    int statusId = res.path("status").path("id").asInt();
                    
                    double time = res.path("time").asDouble();
                    int timeMs = (int)(time * 1000);
                    tcResult.setRunTimeMs(timeMs);
                    if (timeMs > maxRunTimeMs) maxRunTimeMs = timeMs;
                    
                    int memory = res.path("memory").asInt();
                    tcResult.setMemoryUsedKb(memory);
                    if (memory > maxMemoryUsedKb) maxMemoryUsedKb = memory;

                    String stdout = decodeBase64(res.path("stdout").asText());
                    String stderr = decodeBase64(res.path("stderr").asText());
                    String compileOutput = decodeBase64(res.path("compile_output").asText());

                    if (statusId == 3) {
                        tcResult.setStatus("PASSED");
                        tcResult.setMessage("Test Case Passed");
                    } else if (statusId == 5) {
                        tcResult.setStatus("TLE");
                        tcResult.setMessage("Time Limit Exceeded");
                        overallVerdict = updateVerdict(overallVerdict, "TIME_LIMIT_EXCEEDED");
                    } else if (statusId == 6) {
                        tcResult.setStatus("COMPILATION_ERROR");
                        resultDto.setCompileError(compileOutput);
                        tcResult.setMessage("Compilation Error: " + compileOutput);
                        overallVerdict = "COMPILATION_ERROR";
                    } else if (statusId == 7 || statusId == 8 || statusId == 9 || statusId == 10 || statusId == 11) {
                        tcResult.setStatus("RTE");
                        tcResult.setMessage("Runtime Error: " + stderr);
                        overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
                    } else {
                        tcResult.setStatus("FAILED");
                        if (!tc.getIsHidden()) {
                            tcResult.setMessage("Expected:\n" + tc.getExpectedOutput().trim() + "\nYour Output:\n" + stdout.trim());
                        } else {
                            tcResult.setMessage("Hidden testcase failed.");
                        }
                        overallVerdict = updateVerdict(overallVerdict, "WRONG_ANSWER");
                    }
                } catch (Exception e) {
                    tcResult.setStatus("FAILED");
                    tcResult.setMessage("Execution error: " + e.getMessage());
                    overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
                }

                resultDto.getTestCaseResults().add(tcResult);
            }
        }

        resultDto.setStatus(overallVerdict);
        resultDto.setRunTimeMs(maxRunTimeMs);
        resultDto.setMemoryUsedKb(maxMemoryUsedKb);
        resultDto.setExitCode(overallVerdict.equals("ACCEPTED") ? 0 : -1);

        // Fetch Grok explanation if not ACCEPTED
        if (!"ACCEPTED".equals(overallVerdict)) {
            TestCaseResultDto failedTc = resultDto.getTestCaseResults().stream()
                    .filter(tc -> !"PASSED".equals(tc.getStatus()))
                    .findFirst()
                    .orElse(null);
            
            String expected = "";
            String actual = "";
            String runStderr = "";
            if (failedTc != null) {
                TestCase tcObj = testCaseRepository.findById(failedTc.getTestCaseId()).orElse(null);
                if (tcObj != null) {
                    if (tcObj.getIsHidden()) {
                        expected = null;
                        actual = "Hidden testcase failed.";
                    } else {
                        expected = tcObj.getExpectedOutput();
                    }
                }
                if ("RTE".equals(failedTc.getStatus())) {
                    runStderr = failedTc.getMessage();
                } else if ("FAILED".equals(failedTc.getStatus()) && (tcObj == null || !tcObj.getIsHidden())) {
                    actual = failedTc.getMessage();
                }
            }
            String explanation = getGrokExplanation(overallVerdict, request.getCode(), resultDto.getCompileError(), runStderr, lang, "", expected, actual, studentTest, question);
            resultDto.setAiExplanation(explanation);
        }

        
        // Calculate score
        int totalTestCases = testCases.size();
        long passedCount = resultDto.getTestCaseResults().stream()
                .filter(tc -> "PASSED".equals(tc.getStatus()))
                .count();
        int finalScore = 0;
        if (totalTestCases > 0) {
            finalScore = (int) Math.round((double) passedCount / totalTestCases * question.getMarks());
        }
        
        if ("ACCEPTED".equals(overallVerdict) && question.getNegativeMarks() > 0) {
            // Apply positive marks
        } else if (!"ACCEPTED".equals(overallVerdict)) {
            finalScore -= question.getNegativeMarks();
        }

        // Save submission and individual test case runs
        Submission sub = saveSubmissionRecord(studentTest, question, request, resultDto);
        sub.setScore(finalScore);
        submissionRepository.save(sub);

        // Update overall StudentTest score
        if (studentTest != null) {
            updateStudentTestScore(studentTest, question, finalScore);
        }

        return resultDto;
    }

    private JsonNode executeOnJudge0(String code, int languageId, String stdin, String expectedOutput) {
        try {
            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> payload = new HashMap<>();
            
            String base64Source = Base64.getEncoder().encodeToString(code.getBytes(StandardCharsets.UTF_8));
            payload.put("source_code", base64Source);
            payload.put("language_id", languageId);
            
            if (stdin != null) {
                payload.put("stdin", Base64.getEncoder().encodeToString(stdin.getBytes(StandardCharsets.UTF_8)));
            }
            if (expectedOutput != null) {
                payload.put("expected_output", Base64.getEncoder().encodeToString(expectedOutput.getBytes(StandardCharsets.UTF_8)));
            }
            
            String jsonPayload = mapper.writeValueAsString(payload);
            
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(judge0ApiUrl + "/submissions?base64_encoded=true&wait=true"))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();
                    
            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            if (httpResponse.statusCode() != 201 && httpResponse.statusCode() != 200) {
                throw new RuntimeException("Judge0 API returned status code " + httpResponse.statusCode() + ": " + httpResponse.body());
            }
            
            return mapper.readTree(httpResponse.body());
        } catch (Exception e) {
            throw new RuntimeException("Failed to execute code on Judge0: " + e.getMessage(), e);
        }
    }

    private String decodeBase64(String val) {
        if (val == null || val.isBlank()) return "";
        try {
            byte[] bytes = Base64.getDecoder().decode(val.trim());
            return new String(bytes, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return val;
        }
    }

    private String mapStatusIdToVerdict(int statusId) {
        switch (statusId) {
            case 3: return "ACCEPTED";
            case 4: return "WRONG_ANSWER";
            case 5: return "TIME_LIMIT_EXCEEDED";
            case 6: return "COMPILATION_ERROR";
            case 7: case 8: case 9: case 10: case 11: case 12: return "RUNTIME_ERROR";
            default: return "WRONG_ANSWER";
        }
    }

    private int getJudge0LanguageId(String lang) {
        switch (lang.toLowerCase()) {
            case "c": return 50;
            case "cpp": case "c++": return 54;
            case "java": return 62;
            case "javascript": case "js": return 63;
            case "python": case "py": return 71;
            default: throw new RuntimeException("Unsupported language: " + lang);
        }
    }

    private void updateStudentTestScore(StudentTest studentTest, Question question, int questionScore) {
        // Fetch all latest submissions for this student test
        List<Submission> submissions = submissionRepository.findByStudentTestId(studentTest.getId());
        
        // Group by question and take the max score
        Map<Long, Integer> maxScores = new HashMap<>();
        for (Submission sub : submissions) {
            maxScores.put(
                sub.getQuestion().getId(),
                Math.max(maxScores.getOrDefault(sub.getQuestion().getId(), 0), sub.getScore())
            );
        }

        int totalScore = maxScores.values().stream().mapToInt(Integer::intValue).sum();
        studentTest.setScore(totalScore);
        studentTestRepository.save(studentTest);

        // Check if student earned achievement (e.g. solve 1 problem successfully)
        long acceptedCount = submissions.stream()
                .filter(s -> "ACCEPTED".equals(s.getStatus()))
                .map(s -> s.getQuestion().getId())
                .distinct()
                .count();

        if (acceptedCount >= 1 && achievementRepository.findByStudentId(studentTest.getStudent().getId()).isEmpty()) {
            Achievement badge = Achievement.builder()
                    .student(studentTest.getStudent())
                    .title("First Success Badge")
                    .type("GOLD")
                    .badgeIcon("Award")
                    .build();
            achievementRepository.save(badge);
        }
    }

    private Submission saveSubmissionRecord(StudentTest studentTest, Question question, SubmitRequest request, SubmissionResultDto result) {
        Submission sub = Submission.builder()
                .studentTest(studentTest)
                .question(question)
                .code(request.getCode())
                .language(request.getLanguage())
                .status(result.getStatus())
                .runTimeMs(result.getRunTimeMs())
                .memoryUsedKb(result.getMemoryUsedKb())
                .compileError(result.getCompileError())
                .build();

        Submission savedSub = submissionRepository.save(sub);

        if (result.getTestCaseResults() != null) {
            for (TestCaseResultDto tcRes : result.getTestCaseResults()) {
                TestCase tc = testCaseRepository.findById(tcRes.getTestCaseId()).orElse(null);
                if (tc != null) {
                    SubmissionTestCase subTc = SubmissionTestCase.builder()
                            .submission(savedSub)
                            .testCase(tc)
                            .status(tcRes.getStatus())
                            .runTimeMs(tcRes.getRunTimeMs())
                            .memoryUsedKb(tcRes.getMemoryUsedKb())
                            .message(tcRes.getMessage())
                            .build();
                    submissionTestCaseRepository.save(subTc);
                }
            }
        }

        return savedSub;
    }

    private String updateVerdict(String current, String challenger) {
        if ("TIME_LIMIT_EXCEEDED".equals(current) || "TIME_LIMIT_EXCEEDED".equals(challenger)) {
            return "TIME_LIMIT_EXCEEDED";
        }
        if ("MEMORY_LIMIT_EXCEEDED".equals(current) || "MEMORY_LIMIT_EXCEEDED".equals(challenger)) {
            return "MEMORY_LIMIT_EXCEEDED";
        }
        if ("RUNTIME_ERROR".equals(current) || "RUNTIME_ERROR".equals(challenger)) {
            return "RUNTIME_ERROR";
        }
        if ("WRONG_ANSWER".equals(current) || "WRONG_ANSWER".equals(challenger)) {
            return "WRONG_ANSWER";
        }
        return challenger;
    }


    private String calculateSHA256(String input) {
        try {
            java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            throw new RuntimeException("SHA-256 computation failed", ex);
        }
    }

    private String getGrokExplanation(String status, String code, String compileError, String stderr, String language, String customInput, String expectedOutput, String actualOutput, StudentTest studentTest, Question question) {
        try {
            String errorContext = "";
            if ("COMPILATION_ERROR".equals(status)) {
                errorContext = compileError;
            } else if ("RUNTIME_ERROR".equals(status)) {
                errorContext = stderr;
            } else if ("WRONG_ANSWER".equals(status)) {
                errorContext = "expected:" + expectedOutput + "|actual:" + actualOutput;
            } else {
                errorContext = status;
            }
            String hashInput = code + "|" + (errorContext != null ? errorContext : "");
            String hash = calculateSHA256(hashInput);

            Optional<AiHintCache> cachedHintOpt = aiHintCacheRepository.findByHash(hash);
            if (cachedHintOpt.isPresent()) {
                return cachedHintOpt.get().getAiHint();
            }

            if (studentTest != null) {
                if (studentTest.getAiRequestsCount() == null) {
                    studentTest.setAiRequestsCount(0);
                }
                if (studentTest.getAiRequestsCount() >= 5) {
                    return "AI hint limit reached for this test (Maximum 5 requests allowed).";
                }
            }

            String prompt = "";
            if ("COMPILATION_ERROR".equals(status)) {
                prompt = "You are an expert programming mentor.\n\n" +
                         "Never reveal the complete solution.\n" +
                         "Explain the compiler error in simple English.\n" +
                         "Mention:\n" +
                         "• Which line contains the error.\n" +
                         "• What caused it.\n" +
                         "• How the student can fix it.\n" +
                         "• Give one small hint.\n" +
                         "• Never generate the full solution.\n" +
                         "• Never reveal hidden test cases.\n" +
                         "• Never modify the student's code.\n\n" +
                         "Context:\n" +
                         "Programming Language: " + language + "\n" +
                         "Problem Statement: " + (question != null ? question.getProblemStatement() : "") + "\n" +
                         "Input Format: " + (question != null ? question.getInputFormat() : "") + "\n" +
                         "Output Format: " + (question != null ? question.getOutputFormat() : "") + "\n" +
                         "Compiler Error:\n" + compileError + "\n\n" +
                         "Source Code:\n" + code;
            } else if ("RUNTIME_ERROR".equals(status)) {
                prompt = "You are an expert programming mentor.\n\n" +
                         "Never reveal the complete solution.\n" +
                         "Do NOT provide corrected code.\n" +
                         "Never reveal hidden test cases.\n" +
                         "Never modify the student's code.\n\n" +
                         "For Runtime Error:\n" +
                         "Explain why it occurred based on the error message and the source code. Specifically identify if it was Array Index Out of Bounds, Null Pointer, Division by Zero, Stack Overflow, or Input mismatch if applicable.\n" +
                         "Suggest what concept to check.\n\n" +
                         "Error Message:\n" + stderr + "\n\n" +
                         "Context:\n" +
                         "Programming Language: " + language + "\n" +
                         "Problem Statement: " + (question != null ? question.getProblemStatement() : "") + "\n" +
                         "Input Format: " + (question != null ? question.getInputFormat() : "") + "\n" +
                         "Output Format: " + (question != null ? question.getOutputFormat() : "") + "\n\n" +
                         "Source Code:\n" + code;
            } else if ("WRONG_ANSWER".equals(status)) {
                boolean isHidden = (expectedOutput == null || expectedOutput.isBlank() || "Hidden testcase failed.".equals(actualOutput));
                
                prompt = "You are an expert programming mentor.\n\n" +
                         "Never reveal the complete solution.\n" +
                         "Do NOT provide corrected code.\n" +
                         "Never reveal hidden test cases.\n" +
                         "Never modify the student's code.\n\n" +
                         "For Wrong Answer:\n" +
                         "Identify the logical mistake in the student's source code.\n";
                
                if (isHidden) {
                    prompt += "A hidden test case failed. Explain to the student what potential logical flaws, boundary conditions, or edge cases they should check, without referencing any specific test case input or output.\n\n";
                } else {
                    prompt += "Compare Expected Output and Actual Output to diagnose the error.\n" +
                              "Expected Output:\n" + expectedOutput + "\n" +
                              "Actual Output:\n" + actualOutput + "\n\n";
                }
                
                prompt += "Return exactly in this format:\n" +
                          "Wrong Answer\n" +
                          "Explanation:\n" +
                          "[Explain the logical mistake in simple English]\n" +
                          "Hint:\n" +
                          "[Provide one small hint]\n\n" +
                          "Context:\n" +
                          "Programming Language: " + language + "\n" +
                          "Problem Statement: " + (question != null ? question.getProblemStatement() : "") + "\n" +
                          "Input Format: " + (question != null ? question.getInputFormat() : "") + "\n" +
                          "Output Format: " + (question != null ? question.getOutputFormat() : "") + "\n\n" +
                          "Source Code:\n" + code;
            } else {
                return null;
            }

            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> requestMap = new HashMap<>();
            requestMap.put("model", "llama-3.3-70b-versatile");
            
            List<Map<String, String>> messages = new ArrayList<>();
            Map<String, String> systemMsg = new HashMap<>();
            systemMsg.put("role", "system");
            systemMsg.put("content", "You are a helpful coding mentor. Keep answers clear, structured, and under 5 sentences. Never provide code blocks or the full solution.");
            messages.add(systemMsg);
            
            Map<String, String> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", prompt);
            messages.add(userMsg);
            
            requestMap.put("messages", messages);
            requestMap.put("temperature", 0.2);

            String requestBody = mapper.writeValueAsString(requestMap);

            java.net.http.HttpClient client = java.net.http.HttpClient.newBuilder()
                .connectTimeout(java.time.Duration.ofSeconds(10))
                .build();
            java.net.http.HttpRequest httpRequest = java.net.http.HttpRequest.newBuilder()
                .uri(java.net.URI.create("https://api.groq.com/openai/v1/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + xaiApiKey)
                .POST(java.net.http.HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();

            java.net.http.HttpResponse<String> response = client.send(httpRequest, java.net.http.HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                System.err.println("Primary Grok request in CodeExecutionService failed with status: " + response.statusCode() + ", Body: " + response.body());
                requestMap.put("model", "llama-3.1-8b-instant");
                requestBody = mapper.writeValueAsString(requestMap);
                httpRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create("https://api.groq.com/openai/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + xaiApiKey)
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();
                response = client.send(httpRequest, java.net.http.HttpResponse.BodyHandlers.ofString());
            }

            String aiExplanation = null;
            if (response.statusCode() == 200) {
                JsonNode rootNode = mapper.readTree(response.body());
                JsonNode contentNode = rootNode.path("choices").path(0).path("message").path("content");
                if (!contentNode.isMissingNode()) {
                    aiExplanation = contentNode.asText();
                }
            } else {
                System.err.println("Grok API request failed with status: " + response.statusCode() + ", Body: " + response.body());
            }

            if (aiExplanation == null) {
                aiExplanation = getLocalFallbackExplanation(status, compileError, stderr);
            }

            AiHintCache newCache = AiHintCache.builder()
                    .hash(hash)
                    .aiHint(aiExplanation)
                    .build();
            try {
                aiHintCacheRepository.save(newCache);
            } catch (Exception e) {
                System.err.println("Cache save failed: " + e.getMessage());
            }

            if (studentTest != null) {
                studentTest.setAiRequestsCount(studentTest.getAiRequestsCount() + 1);
                studentTestRepository.save(studentTest);
            }

            return aiExplanation;
        } catch (Exception e) {
            System.err.println("Failed to fetch Grok explanation: " + e.getMessage());
            return getLocalFallbackExplanation(status, compileError, stderr);
        }
    }

    private String getLocalFallbackExplanation(String status, String compileError, String stderr) {
        if ("COMPILATION_ERROR".equals(status)) {
            String err = compileError != null ? compileError : "";
            if (err.contains("';' expected")) {
                return "You forgot a semicolon at the end of the statement.";
            } else if (err.contains("cannot find symbol")) {
                return "The compiler cannot find the variable or class you referenced. Double check your variable names, spelling, and library imports.";
            } else if (err.contains("class") && err.contains("should be declared in a file named")) {
                return "Your Java class name must be declared as 'public class Solution' to match the online judge workspace execution files.";
            } else if (err.contains("SyntaxError") || err.contains("invalid syntax")) {
                return "Your code contains a syntax error. Verify your parentheses, colons, indentation alignment, and keyword spelling.";
            }
            return "Compilation failed. Review the compiler log details to resolve syntax errors or missing declaration identifiers.";
        } else if ("RUNTIME_ERROR".equals(status)) {
            String err = stderr != null ? stderr : "";
            if (err.contains("NullPointerException") || err.contains("NoneType")) {
                return "You are trying to access or manipulate an object reference that is null (NoneType).";
            } else if (err.contains("/ by zero") || err.contains("ZeroDivisionError")) {
                return "Your code attempted to divide a number by zero. Ensure your denominator variables are correctly verified before division.";
            } else if (err.contains("IndexOutOfBoundsException") || err.contains("IndexError") || err.contains("out of bounds")) {
                return "An index was accessed that is outside the bounds of the array, vector, or list. Double check your loop termination conditions.";
            }
            return "Your code threw an unhandled runtime exception. Check the execution stack trace for exceptions, segmentation faults, or non-zero exits.";
        } else if ("WRONG_ANSWER".equals(status)) {
            return "Your logic fails for some test cases. Consider checking boundary constraints, edge cases (empty inputs, negative values), or extreme numbers.";
        } else if ("TIME_LIMIT_EXCEEDED".equals(status)) {
            return "Your code took too long to execute and exceeded the maximum allowed limit. Check for infinite loops or optimize your algorithm's time complexity.";
        } else if ("MEMORY_LIMIT_EXCEEDED".equals(status)) {
            return "Your code allocated more memory than allowed by the platform limits. Optimize your data structure allocations and check for memory leaks.";
        }
        return "An issue occurred during evaluation. Please inspect the logs to diagnose.";
    }

    private boolean compareOutputs(String expected, String actual) {
        if (expected == null && actual == null) return true;
        if (expected == null || actual == null) return false;
        
        String expClean = expected.replaceAll("\\r\\n", "\n").replaceAll("\\r", "\n").trim();
        String actClean = actual.replaceAll("\\r\\n", "\n").replaceAll("\\r", "\n").trim();
        
        String[] expLines = expClean.split("\n");
        String[] actLines = actClean.split("\n");
        
        if (expLines.length != actLines.length) return false;
        
        for (int i = 0; i < expLines.length; i++) {
            if (!expLines[i].stripTrailing().equals(actLines[i].stripTrailing())) {
                return false;
            }
        }
        return true;
    }
}

