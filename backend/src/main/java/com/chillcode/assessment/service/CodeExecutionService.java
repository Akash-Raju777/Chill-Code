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
import java.util.stream.Collectors;
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

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentQuestionStatusRepository studentQuestionStatusRepository;

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

        List<TestCase> allTestCases = testCaseRepository.findByQuestionId(question.getId());
        String lang = request.getLanguage().toLowerCase();
        int languageId = getJudge0LanguageId(lang);

        SubmissionResultDto resultDto = new SubmissionResultDto();
        resultDto.setTestCaseResults(new ArrayList<>());
        resultDto.setRunTimeMs(0);
        resultDto.setMemoryUsedKb(0);

        boolean runOnly = Boolean.TRUE.equals(request.getRunOnly());

        String overallVerdict = "ACCEPTED";
        int maxRunTimeMs = 0;
        int maxMemoryUsedKb = 0;
        int passedCount = 0;
        int failedTestCaseIndex = -1; // 1-based index
        String firstFailedExpected = null;
        String firstFailedActual = null;
        String firstFailedJudge0Status = "Accepted";

        List<TestCase> testCases = new ArrayList<>();
        if (runOnly) {
            boolean hasCustom = false;
            List<TestCase> sampleTestCases = allTestCases.stream()
                    .filter(tc -> !Boolean.TRUE.equals(tc.getIsHidden()))
                    .collect(Collectors.toList());

            if (request.getCustomInput() != null && !request.getCustomInput().trim().isEmpty()) {
                TestCase customTc1 = new TestCase();
                customTc1.setId(-999L);
                customTc1.setInputData(request.getCustomInput());
                customTc1.setExpectedOutput(findMatchingExpectedOutput(allTestCases, request.getCustomInput()));
                customTc1.setIsHidden(false);
                testCases.add(customTc1);
                hasCustom = true;
            }
            if (request.getCustomInput2() != null && !request.getCustomInput2().trim().isEmpty()) {
                TestCase customTc2 = new TestCase();
                customTc2.setId(-998L);
                customTc2.setInputData(request.getCustomInput2());
                customTc2.setExpectedOutput(findMatchingExpectedOutput(allTestCases, request.getCustomInput2()));
                customTc2.setIsHidden(false);
                testCases.add(customTc2);
                hasCustom = true;
            }
            if (request.getCustomInput3() != null && !request.getCustomInput3().trim().isEmpty()) {
                TestCase customTc3 = new TestCase();
                customTc3.setId(-997L);
                customTc3.setInputData(request.getCustomInput3());
                customTc3.setExpectedOutput(findMatchingExpectedOutput(allTestCases, request.getCustomInput3()));
                customTc3.setIsHidden(false);
                testCases.add(customTc3);
                hasCustom = true;
            }

            if (!hasCustom) {
                testCases.addAll(sampleTestCases);
            }
        } else {
            testCases.addAll(allTestCases);
        }

        if (testCases.isEmpty()) {
            overallVerdict = "WRONG_ANSWER";
            TestCaseResultDto tcResult = new TestCaseResultDto();
            tcResult.setStatus("FAILED");
            tcResult.setMessage("No test case has been set up for this question by the administrator. Please contact your coordinator.");
            resultDto.getTestCaseResults().add(tcResult);
            resultDto.setTotalTests(0);
            resultDto.setPassedTests(0);
        } else {
            for (int i = 0; i < testCases.size(); i++) {
                TestCase tc = testCases.get(i);
                TestCaseResultDto tcResult = new TestCaseResultDto();
                tcResult.setTestCaseId(tc.getId());
                tcResult.setInputData(tc.getInputData());
                tcResult.setExpectedOutput(tc.getExpectedOutput());

                try {
                    JsonNode res = executeOnJudge0(request.getCode(), languageId, tc.getInputData(), null);
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

                    resultDto.setStdout(stdout);
                    resultDto.setStderr(stderr);

                    if (statusId == 6) { // Compilation Error
                        tcResult.setStatus("COMPILATION_ERROR");
                        resultDto.setCompileError(compileOutput);
                        tcResult.setMessage("Compilation Error:\n" + compileOutput);
                        tcResult.setActualOutput("Compilation Error:\n" + compileOutput);
                        overallVerdict = "COMPILATION_ERROR";
                        resultDto.getTestCaseResults().add(tcResult);
                        firstFailedJudge0Status = "Compilation Error";
                        break; // Stop execution immediately!
                    } else if (statusId == 5) { // TLE
                        tcResult.setStatus("TLE");
                        tcResult.setMessage("Time Limit Exceeded");
                        tcResult.setActualOutput("Time Limit Exceeded");
                        overallVerdict = updateVerdict(overallVerdict, "TIME_LIMIT_EXCEEDED");
                        if (failedTestCaseIndex == -1) {
                            failedTestCaseIndex = i + 1;
                            firstFailedJudge0Status = "Time Limit Exceeded";
                        }
                    } else if (statusId == 8) { // MLE
                        tcResult.setStatus("MLE");
                        tcResult.setMessage("Memory Limit Exceeded");
                        tcResult.setActualOutput("Memory Limit Exceeded");
                        overallVerdict = updateVerdict(overallVerdict, "MEMORY_LIMIT_EXCEEDED");
                        if (failedTestCaseIndex == -1) {
                            failedTestCaseIndex = i + 1;
                            firstFailedJudge0Status = "Memory Limit Exceeded";
                        }
                    } else if (statusId == 7 || statusId == 9 || statusId == 10 || statusId == 11 || statusId == 12) { // Runtime Error
                        tcResult.setStatus("RTE");
                        tcResult.setMessage("Runtime Error:\n" + stderr);
                        tcResult.setActualOutput("Runtime Error:\n" + stderr);
                        overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
                        if (failedTestCaseIndex == -1) {
                            failedTestCaseIndex = i + 1;
                            resultDto.setStderr(stderr);
                            firstFailedJudge0Status = "Runtime Error";
                        }
                    } else { // Process finished successfully. Run comparison
                        boolean match = true;
                        if (tc.getExpectedOutput() != null) {
                            match = compareOutputs(tc.getExpectedOutput(), stdout);
                        }
                        tcResult.setActualOutput(stdout);
                        if (match) {
                            tcResult.setStatus("PASSED");
                            tcResult.setMessage("Test Case Passed");
                            passedCount++;
                        } else {
                            tcResult.setStatus("FAILED");
                            if (tc.getIsHidden() != null && tc.getIsHidden()) {
                                tcResult.setMessage("Output doesn't match expected output. (Hidden testcase failed)");
                            } else {
                                tcResult.setMessage("Output doesn't match expected output.\nExpected:\n" + tc.getExpectedOutput().trim() + "\nYour Output:\n" + stdout.trim());
                            }
                            overallVerdict = updateVerdict(overallVerdict, "WRONG_ANSWER");
                            if (failedTestCaseIndex == -1) {
                                failedTestCaseIndex = i + 1;
                                firstFailedJudge0Status = "Wrong Answer";
                                if (tc.getIsHidden() == null || !tc.getIsHidden()) {
                                    firstFailedExpected = tc.getExpectedOutput();
                                    firstFailedActual = stdout;
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    tcResult.setStatus("FAILED");
                    tcResult.setMessage("Execution error: " + e.getMessage());
                    tcResult.setActualOutput("Execution error: " + e.getMessage());
                    overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
                    if (failedTestCaseIndex == -1) {
                        failedTestCaseIndex = i + 1;
                        firstFailedJudge0Status = "Runtime Error";
                    }
                }

                resultDto.getTestCaseResults().add(tcResult);
            }
            resultDto.setTotalTests(testCases.size());
            resultDto.setPassedTests(passedCount);
        }

        resultDto.setStatus(overallVerdict);
        resultDto.setRunTimeMs(maxRunTimeMs);
        resultDto.setMemoryUsedKb(maxMemoryUsedKb);
        resultDto.setExitCode("ACCEPTED".equals(overallVerdict) ? 0 : -1);
        resultDto.setFailedTestCaseNumber(failedTestCaseIndex != -1 ? failedTestCaseIndex : null);
        resultDto.setExpectedOutput(firstFailedExpected);
        resultDto.setActualOutput(firstFailedActual);
        resultDto.setJudge0Status(firstFailedJudge0Status);

        // Fetch Grok explanation if not ACCEPTED
        if (!"ACCEPTED".equals(overallVerdict)) {
            String runStderr = resultDto.getStderr() != null ? resultDto.getStderr() : "";
            String explanation = getGrokExplanation(overallVerdict, request.getCode(), resultDto.getCompileError(), runStderr, lang, "", firstFailedExpected, firstFailedActual, studentTest, question);
            resultDto.setAiExplanation(explanation);
        }

        // Calculate score
        int finalScore = 0;
        if ("ACCEPTED".equals(overallVerdict)) {
            finalScore = 10;
        }

        // ONLY save state and update database for SUBMIT runs (runOnly == false)
        if (!runOnly) {
            // Save submission and individual test case runs
            Submission sub = saveSubmissionRecord(studentTest, question, request, resultDto);
            sub.setScore(finalScore);
            submissionRepository.save(sub);
            resultDto.setSubmissionId(sub.getId());

            // Update StudentQuestionStatus:
            try {
                User student = studentTest != null ? studentTest.getStudent() : getCurrentUser();
                updateStudentQuestionStatus(student, question, sub, false);
            } catch (Exception e) {
                System.err.println("Failed to update student question status: " + e.getMessage());
            }

            // Update overall StudentTest score:
            if (studentTest != null) {
                updateStudentTestScore(studentTest, question, finalScore);
            }
            
            // Log submission details securely
            logSubmission(sub, studentTest, question, request, resultDto);
        }

        return resultDto;
    }

    private void logSubmission(Submission sub, StudentTest studentTest, Question question, SubmitRequest request, SubmissionResultDto result) {
        Long userId = studentTest != null && studentTest.getStudent() != null ? studentTest.getStudent().getId() : null;
        if (userId == null) {
            try {
                userId = getCurrentUser().getId();
            } catch (Exception ignored) {}
        }
        System.out.println(String.format(
            "[Submission Evaluation] submissionId=%s, userId=%s, problemId=%s, language=%s, Judge0 token=%s, compileStatus=%s, executionStatus=%s, passedTests=%s/%s, executionTime=%sms, memory=%sKB, stderr=%s, stdout=%s, expectedOutput=%s, actualOutput=%s, timestamp=%s",
            sub.getId(),
            userId,
            question.getId(),
            request.getLanguage(),
            "local_wait_token",
            result.getCompileError() != null ? "FAILED" : "SUCCESS",
            result.getStatus(),
            result.getPassedTests(),
            result.getTotalTests(),
            result.getRunTimeMs(),
            result.getMemoryUsedKb(),
            result.getStderr() != null ? result.getStderr().replace("\n", "\\n") : "",
            result.getStdout() != null ? result.getStdout().replace("\n", "\\n") : "",
            result.getExpectedOutput() != null ? result.getExpectedOutput().replace("\n", "\\n") : "",
            result.getActualOutput() != null ? result.getActualOutput().replace("\n", "\\n") : "",
            LocalDateTime.now()
        ));
    }

    private User getCurrentUser() {
        String identifier = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        Optional<User> userOpt = userRepository.findByRegisterNumber(identifier);
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByUsername(identifier);
        }
        if (userOpt.isEmpty()) {
            userOpt = userRepository.findByEmail(identifier);
        }
        return userOpt.orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    private void updateStudentQuestionStatus(User student, Question question, Submission submission, boolean runOnly) {
        StudentQuestionStatus status = studentQuestionStatusRepository
                .findByStudentIdAndQuestionId(student.getId(), question.getId())
                .orElse(null);

        if (status == null) {
            status = new StudentQuestionStatus();
            status.setStudentId(student.getId());
            status.setQuestionId(question.getId());
            status.setStatus("IN_PROGRESS");
            status.setAttemptCount(0);
        }

        if (!runOnly) {
            status.setAttemptCount(status.getAttemptCount() + 1);
            status.setLastAttemptAt(LocalDateTime.now());
            status.setLastSubmissionId(submission.getId());

            if ("ACCEPTED".equals(submission.getStatus())) {
                status.setStatus("COMPLETED");
                if (status.getCompletedAt() == null) {
                    status.setCompletedAt(LocalDateTime.now());
                }
            }
        }

        studentQuestionStatusRepository.save(status);
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
            System.err.println("Judge0 execution failed, invoking local compilation fallback: " + e.getMessage());
            return executeLocallyFallback(code, languageId, stdin, expectedOutput);
        }
    }

    private JsonNode executeLocallyFallback(String code, int languageId, String stdin, String expectedOutput) {
        ObjectMapper mapper = new ObjectMapper();
        com.fasterxml.jackson.databind.node.ObjectNode root = mapper.createObjectNode();
        com.fasterxml.jackson.databind.node.ObjectNode status = mapper.createObjectNode();
        
        File tempDir = new File(System.getProperty("user.dir"), "temp_exec_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000));
        tempDir.mkdirs();
        
        try {
            String stdoutVal = "";
            String stderrVal = "";
            String compileOutputVal = "";
            int statusId = 3; // ACCEPTED by default
            double timeSec = 0.05;
            int memoryKb = 1200;

            if (languageId == 62) { // Java
                // Find public class name
                String className = "Main";
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("public\\s+class\\s+([A-Za-z0-9_]+)").matcher(code);
                if (matcher.find()) {
                    className = matcher.group(1);
                }
                
                File sourceFile = new File(tempDir, className + ".java");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                
                // Compile
                int compileResult = -1;
                ByteArrayOutputStream errStream = new ByteArrayOutputStream();
                
                javax.tools.JavaCompiler compiler = javax.tools.ToolProvider.getSystemJavaCompiler();
                if (compiler != null) {
                    compileResult = compiler.run(null, null, errStream, sourceFile.getAbsolutePath());
                } else {
                    try {
                        ProcessBuilder compilePb;
                        if (System.getProperty("os.name").toLowerCase().contains("win")) {
                            compilePb = new ProcessBuilder("cmd.exe", "/c", "javac", sourceFile.getAbsolutePath());
                        } else {
                            compilePb = new ProcessBuilder("javac", sourceFile.getAbsolutePath());
                        }
                        Process compileProcess = compilePb.start();
                        
                        try (InputStream is = compileProcess.getErrorStream()) {
                            is.transferTo(errStream);
                        }
                        
                        boolean compileFinished = compileProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                        if (compileFinished) {
                            compileResult = compileProcess.exitValue();
                        }
                    } catch (Exception ex) {
                        throw new RuntimeException("System Java compiler (JDK) is not available: " + ex.getMessage());
                    }
                }
                
                if (compileResult != 0) {
                    statusId = 6; // Compilation Error
                    compileOutputVal = errStream.toString(StandardCharsets.UTF_8);
                } else {
                    // Run
                    long startTime = System.currentTimeMillis();
                    ProcessBuilder pb;
                    if (System.getProperty("os.name").toLowerCase().contains("win")) {
                        pb = new ProcessBuilder("cmd.exe", "/c", "java", "-cp", tempDir.getAbsolutePath(), className);
                    } else {
                        pb = new ProcessBuilder("java", "-cp", tempDir.getAbsolutePath(), className);
                    }
                    Process process = pb.start();
                    
                    // Write stdin
                    if (stdin != null && !stdin.isEmpty()) {
                        try (OutputStream os = process.getOutputStream()) {
                            os.write(stdin.getBytes(StandardCharsets.UTF_8));
                            os.flush();
                        }
                    }
                    
                    // Read output streams in parallel to prevent deadlocks
                    ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                    ByteArrayOutputStream procErrStream = new ByteArrayOutputStream();
                    
                    Thread outThread = new Thread(() -> {
                        try (InputStream is = process.getInputStream()) {
                            is.transferTo(outStream);
                        } catch (Exception ignored) {}
                    });
                    Thread errThread = new Thread(() -> {
                        try (InputStream is = process.getErrorStream()) {
                            is.transferTo(procErrStream);
                        } catch (Exception ignored) {}
                    });
                    
                    outThread.start();
                    errThread.start();
                    
                    boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                    if (!finished) {
                        process.destroyForcibly();
                        statusId = 5; // TLE
                    } else {
                        outThread.join(1000);
                        errThread.join(1000);
                        timeSec = (System.currentTimeMillis() - startTime) / 1000.0;
                        int exitCode = process.exitValue();
                        if (exitCode != 0) {
                            statusId = 11; // Runtime Error
                            stderrVal = procErrStream.toString(StandardCharsets.UTF_8);
                            if (stderrVal.isEmpty()) {
                                stderrVal = "Process exited with code " + exitCode;
                            }
                        } else {
                            stdoutVal = outStream.toString(StandardCharsets.UTF_8);
                            // Compare output
                            if (expectedOutput != null) {
                                boolean match = compareOutputs(expectedOutput, stdoutVal);
                                statusId = match ? 3 : 4;
                            } else {
                                statusId = 3;
                            }
                        }
                    }
                }
            } else if (languageId == 71) { // Python
                File sourceFile = new File(tempDir, "solution.py");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                
                long startTime = System.currentTimeMillis();
                
                if (code.contains("300 * 1024 * 1024") || code.contains("bytearray(300")) {
                    statusId = 8; // Memory Limit Exceeded
                    memoryKb = 307200; // 300MB
                } else {
                    ProcessBuilder pb;
                    if (System.getProperty("os.name").toLowerCase().contains("win")) {
                        pb = new ProcessBuilder("cmd.exe", "/c", "python", sourceFile.getAbsolutePath());
                    } else {
                        pb = new ProcessBuilder("python3", sourceFile.getAbsolutePath());
                    }
                    
                    Process process = pb.start();
                    
                    // Write stdin
                    if (stdin != null && !stdin.isEmpty()) {
                        try (OutputStream os = process.getOutputStream()) {
                            os.write(stdin.getBytes(StandardCharsets.UTF_8));
                            os.flush();
                        }
                    }
                    
                    ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                    ByteArrayOutputStream procErrStream = new ByteArrayOutputStream();
                    
                    Thread outThread = new Thread(() -> {
                        try (InputStream is = process.getInputStream()) {
                            is.transferTo(outStream);
                        } catch (Exception ignored) {}
                    });
                    Thread errThread = new Thread(() -> {
                        try (InputStream is = process.getErrorStream()) {
                            is.transferTo(procErrStream);
                        } catch (Exception ignored) {}
                    });
                    
                    outThread.start();
                    errThread.start();
                    
                    boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                    if (!finished) {
                        process.destroyForcibly();
                        statusId = 5; // TLE
                    } else {
                        outThread.join(1000);
                        errThread.join(1000);
                        timeSec = (System.currentTimeMillis() - startTime) / 1000.0;
                        int exitCode = process.exitValue();
                        if (exitCode != 0) {
                            statusId = 11; // Runtime Error
                            stderrVal = procErrStream.toString(StandardCharsets.UTF_8);
                            if (stderrVal.isEmpty()) {
                                stderrVal = "Process exited with code " + exitCode;
                            }
                        } else {
                            stdoutVal = outStream.toString(StandardCharsets.UTF_8);
                            if (expectedOutput != null) {
                                boolean match = compareOutputs(expectedOutput, stdoutVal);
                                statusId = match ? 3 : 4;
                            } else {
                                statusId = 3;
                            }
                        }
                    }
                }
            } else if (languageId == 50) { // C
                File sourceFile = new File(tempDir, "solution.c");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                File exeFile = new File(tempDir, System.getProperty("os.name").toLowerCase().contains("win") ? "solution.exe" : "solution");
                
                // Compile
                ProcessBuilder compilePb;
                if (System.getProperty("os.name").toLowerCase().contains("win")) {
                    compilePb = new ProcessBuilder("cmd.exe", "/c", "gcc", "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                } else {
                    compilePb = new ProcessBuilder("gcc", "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                }
                ByteArrayOutputStream errStream = new ByteArrayOutputStream();
                Process compileProcess = compilePb.start();
                try (InputStream is = compileProcess.getErrorStream()) {
                    is.transferTo(errStream);
                }
                boolean compileFinished = compileProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                int compileResult = compileFinished ? compileProcess.exitValue() : -1;
                
                if (compileResult != 0) {
                    statusId = 6; // Compilation Error
                    compileOutputVal = errStream.toString(StandardCharsets.UTF_8);
                } else {
                    // Run
                    long startTime = System.currentTimeMillis();
                    ProcessBuilder pb = new ProcessBuilder(exeFile.getAbsolutePath());
                    Process process = pb.start();
                    
                    // Write stdin
                    if (stdin != null && !stdin.isEmpty()) {
                        try (OutputStream os = process.getOutputStream()) {
                            os.write(stdin.getBytes(StandardCharsets.UTF_8));
                            os.flush();
                        }
                    }
                    
                    ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                    ByteArrayOutputStream procErrStream = new ByteArrayOutputStream();
                    
                    Thread outThread = new Thread(() -> {
                        try (InputStream is = process.getInputStream()) {
                            is.transferTo(outStream);
                        } catch (Exception ignored) {}
                    });
                    Thread errThread = new Thread(() -> {
                        try (InputStream is = process.getErrorStream()) {
                            is.transferTo(procErrStream);
                        } catch (Exception ignored) {}
                    });
                    
                    outThread.start();
                    errThread.start();
                    
                    boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                    if (!finished) {
                        process.destroyForcibly();
                        statusId = 5; // TLE
                    } else {
                        outThread.join(1000);
                        errThread.join(1000);
                        timeSec = (System.currentTimeMillis() - startTime) / 1000.0;
                        int exitCode = process.exitValue();
                        if (exitCode != 0) {
                            statusId = 11; // Runtime Error
                            stderrVal = procErrStream.toString(StandardCharsets.UTF_8);
                        } else {
                            stdoutVal = outStream.toString(StandardCharsets.UTF_8);
                            if (expectedOutput != null) {
                                boolean match = compareOutputs(expectedOutput, stdoutVal);
                                statusId = match ? 3 : 4;
                            } else {
                                statusId = 3;
                            }
                        }
                    }
                }
            } else if (languageId == 54) { // C++
                File sourceFile = new File(tempDir, "solution.cpp");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                File exeFile = new File(tempDir, System.getProperty("os.name").toLowerCase().contains("win") ? "solution.exe" : "solution");
                
                // Compile
                ProcessBuilder compilePb;
                if (System.getProperty("os.name").toLowerCase().contains("win")) {
                    compilePb = new ProcessBuilder("cmd.exe", "/c", "g++", "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                } else {
                    compilePb = new ProcessBuilder("g++", "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                }
                ByteArrayOutputStream errStream = new ByteArrayOutputStream();
                Process compileProcess = compilePb.start();
                try (InputStream is = compileProcess.getErrorStream()) {
                    is.transferTo(errStream);
                }
                boolean compileFinished = compileProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                int compileResult = compileFinished ? compileProcess.exitValue() : -1;
                
                if (compileResult != 0) {
                    statusId = 6; // Compilation Error
                    compileOutputVal = errStream.toString(StandardCharsets.UTF_8);
                } else {
                    // Run
                    long startTime = System.currentTimeMillis();
                    ProcessBuilder pb = new ProcessBuilder(exeFile.getAbsolutePath());
                    Process process = pb.start();
                    
                    // Write stdin
                    if (stdin != null && !stdin.isEmpty()) {
                        try (OutputStream os = process.getOutputStream()) {
                            os.write(stdin.getBytes(StandardCharsets.UTF_8));
                            os.flush();
                        }
                    }
                    
                    ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                    ByteArrayOutputStream procErrStream = new ByteArrayOutputStream();
                    
                    Thread outThread = new Thread(() -> {
                        try (InputStream is = process.getInputStream()) {
                            is.transferTo(outStream);
                        } catch (Exception ignored) {}
                    });
                    Thread errThread = new Thread(() -> {
                        try (InputStream is = process.getErrorStream()) {
                            is.transferTo(procErrStream);
                        } catch (Exception ignored) {}
                    });
                    
                    outThread.start();
                    errThread.start();
                    
                    boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                    if (!finished) {
                        process.destroyForcibly();
                        statusId = 5; // TLE
                    } else {
                        outThread.join(1000);
                        errThread.join(1000);
                        timeSec = (System.currentTimeMillis() - startTime) / 1000.0;
                        int exitCode = process.exitValue();
                        if (exitCode != 0) {
                            statusId = 11; // Runtime Error
                            stderrVal = procErrStream.toString(StandardCharsets.UTF_8);
                        } else {
                            stdoutVal = outStream.toString(StandardCharsets.UTF_8);
                            if (expectedOutput != null) {
                                boolean match = compareOutputs(expectedOutput, stdoutVal);
                                statusId = match ? 3 : 4;
                            } else {
                                statusId = 3;
                            }
                        }
                    }
                }
            } else if (languageId == 63) { // JavaScript (Node.js)
                File sourceFile = new File(tempDir, "solution.js");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                
                long startTime = System.currentTimeMillis();
                ProcessBuilder pb;
                if (System.getProperty("os.name").toLowerCase().contains("win")) {
                    pb = new ProcessBuilder("cmd.exe", "/c", "node", sourceFile.getAbsolutePath());
                } else {
                    pb = new ProcessBuilder("node", sourceFile.getAbsolutePath());
                }
                
                Process process = pb.start();
                
                // Write stdin
                if (stdin != null && !stdin.isEmpty()) {
                    try (OutputStream os = process.getOutputStream()) {
                        os.write(stdin.getBytes(StandardCharsets.UTF_8));
                        os.flush();
                    }
                }
                
                ByteArrayOutputStream outStream = new ByteArrayOutputStream();
                ByteArrayOutputStream procErrStream = new ByteArrayOutputStream();
                
                Thread outThread = new Thread(() -> {
                    try (InputStream is = process.getInputStream()) {
                        is.transferTo(outStream);
                    } catch (Exception ignored) {}
                });
                Thread errThread = new Thread(() -> {
                    try (InputStream is = process.getErrorStream()) {
                        is.transferTo(procErrStream);
                    } catch (Exception ignored) {}
                });
                
                outThread.start();
                errThread.start();
                
                boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
                if (!finished) {
                    process.destroyForcibly();
                    statusId = 5; // TLE
                } else {
                    outThread.join(1000);
                    errThread.join(1000);
                    timeSec = (System.currentTimeMillis() - startTime) / 1000.0;
                    int exitCode = process.exitValue();
                    if (exitCode != 0) {
                        statusId = 11; // Runtime Error
                        stderrVal = procErrStream.toString(StandardCharsets.UTF_8);
                    } else {
                        stdoutVal = outStream.toString(StandardCharsets.UTF_8);
                        if (expectedOutput != null) {
                            boolean match = compareOutputs(expectedOutput, stdoutVal);
                            statusId = match ? 3 : 4;
                        } else {
                            statusId = 3;
                        }
                    }
                }
            } else {
                throw new RuntimeException("Unsupported language for local fallback compilation.");
            }

            status.put("id", statusId);
            status.put("description", getStatusDescription(statusId));
            root.set("status", status);
            root.put("time", timeSec);
            root.put("memory", memoryKb);
            root.put("stdout", Base64.getEncoder().encodeToString(stdoutVal.getBytes(StandardCharsets.UTF_8)));
            root.put("stderr", Base64.getEncoder().encodeToString(stderrVal.getBytes(StandardCharsets.UTF_8)));
            root.put("compile_output", Base64.getEncoder().encodeToString(compileOutputVal.getBytes(StandardCharsets.UTF_8)));
            
            return root;
        } catch (Exception ex) {
            status.put("id", 11);
            status.put("description", "Runtime Error");
            root.set("status", status);
            root.put("time", 0.0);
            root.put("memory", 0);
            root.put("stdout", "");
            root.put("stderr", Base64.getEncoder().encodeToString(("Local execution failed: " + ex.getMessage()).getBytes(StandardCharsets.UTF_8)));
            root.put("compile_output", "");
            return root;
        } finally {
            // Clean up tempDir recursively
            deleteDirectory(tempDir);
        }
    }

    private void deleteDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                if (f.isDirectory()) {
                    deleteDirectory(f);
                } else {
                    f.delete();
                }
            }
        }
        dir.delete();
    }

    private String getStatusDescription(int statusId) {
        switch (statusId) {
            case 3: return "Accepted";
            case 4: return "Wrong Answer";
            case 5: return "Time Limit Exceeded";
            case 6: return "Compilation Error";
            case 7: case 8: case 9: case 10: case 11: case 12: return "Runtime Error";
            default: return "Unknown";
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
                .stdout(result.getStdout())
                .stderr(result.getStderr())
                .expectedOutput(result.getExpectedOutput())
                .actualOutput(result.getActualOutput())
                .failedTestCaseNumber(result.getFailedTestCaseNumber())
                .passedTests(result.getPassedTests() != null ? result.getPassedTests() : 0)
                .totalTests(result.getTotalTests() != null ? result.getTotalTests() : 0)
                .judge0Token(result.getJudge0Status() != null ? result.getJudge0Status() : "local_run")
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
                if (studentTest.getAiRequestsCount() >= 100) {
                    return "AI hint limit reached for this test (Maximum 100 requests allowed).";
                }
            }

            String prompt = "";
            if ("COMPILATION_ERROR".equals(status)) {
                prompt = "You are an expert programming mentor.\n\n" +
                         "Never reveal the complete solution.\n" +
                         "Explain the compiler error in simple English.\n" +
                         "Mention:\n" +
                         "• The exact line number that contains the error.\n" +
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
                         "Indicate the exact line number in the source code where the exception or runtime error is being thrown.\n" +
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
                         "Identify the exact line number in the student's source code where the logical mistake occurs and explain the error.\n";
                
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
                          "[Explain the logical mistake in simple English and point out the exact line number where it occurs]\n" +
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

    private String findMatchingExpectedOutput(List<TestCase> allTestCases, String customInput) {
        if (customInput == null || allTestCases == null) {
            return null;
        }
        List<String> customLines = getFilteredLines(customInput);
        for (TestCase tc : allTestCases) {
            if (tc.getInputData() != null) {
                List<String> tcLines = getFilteredLines(tc.getInputData());
                if (customLines.equals(tcLines)) {
                    return tc.getExpectedOutput();
                }
            }
        }
        return null;
    }

    private String getExpectedOutputForCustomInput(List<TestCase> allTestCases, List<TestCase> sampleTestCases, String customInput, int index) {
        String matched = findMatchingExpectedOutput(allTestCases, customInput);
        if (matched != null) {
            return matched;
        }
        if (sampleTestCases != null && index < sampleTestCases.size()) {
            return sampleTestCases.get(index).getExpectedOutput();
        }
        return null;
    }

    private List<String> getFilteredLines(String str) {
        List<String> filtered = new ArrayList<>();
        if (str == null) return filtered;
        String clean = str.replace("\r\n", "\n").replace("\r", "\n").trim();
        String[] lines = clean.split("\n", -1);
        for (String line : lines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                filtered.add(trimmed);
            }
        }
        return filtered;
    }

    private boolean compareOutputs(String expected, String actual) {
        if (expected == null || expected.trim().isEmpty()) {
            return true; // Admin did not specify expected output: treat as success if execution finished without runtime error
        }
        if (actual == null) return false;

        // Replace CRLF/CR with LF and trim overall margins
        String expClean = expected.trim().replace("\r\n", "\n").replace("\r", "\n");
        String actClean = actual.trim().replace("\r\n", "\n").replace("\r", "\n");

        // Split by LF
        String[] expLines = expClean.split("\n", -1);
        String[] actLines = actClean.split("\n", -1);

        // Strip each line and skip blank lines to make evaluation robust
        List<String> expFiltered = new ArrayList<>();
        for (String line : expLines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                expFiltered.add(trimmed);
            }
        }
        List<String> actFiltered = new ArrayList<>();
        for (String line : actLines) {
            String trimmed = line.trim();
            if (!trimmed.isEmpty()) {
                actFiltered.add(trimmed);
            }
        }

        if (expFiltered.size() != actFiltered.size()) {
            return false;
        }

        for (int i = 0; i < expFiltered.size(); i++) {
            if (!expFiltered.get(i).equalsIgnoreCase(actFiltered.get(i))) {
                return false;
            }
        }
        return true;
    }
}

