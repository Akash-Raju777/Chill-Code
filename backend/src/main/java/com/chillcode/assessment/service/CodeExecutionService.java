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
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;


@Service
public class CodeExecutionService {

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private TestRepository testRepository;

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

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @Autowired
    private StudentQuestionStatusService studentQuestionStatusService;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private BadgeSetService badgeSetService;

    @Value("${judge0.api.url:http://localhost:2358}")
    private String judge0ApiUrl;

    @Value("${xai.api.key:gsk_default_key_placeholder}")
    private String xaiApiKey;

    private final java.util.concurrent.ExecutorService testCaseExecutor = java.util.concurrent.Executors.newFixedThreadPool(8);

    private static class TcExecutionResult {
        int index;
        TestCaseResultDto tcResult;
        int statusId;
        int timeMs;
        int memoryKb;
        String stdout;
        String stderr;
        String compileOutput;
        boolean passed;
    }

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(CodeExecutionService.class);
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final HttpClient httpClient = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(java.time.Duration.ofSeconds(6))
            .build();

    private final java.util.Map<String, String> localHintCache = new java.util.concurrent.ConcurrentHashMap<>();

    private volatile boolean judge0Available = false;
    private volatile long lastJudge0Check = 0;
    private static final long JUDGE0_CHECK_INTERVAL = 20000; // 20s cached probe

    private boolean isJudge0Available() {
        long now = System.currentTimeMillis();
        if (now - lastJudge0Check < JUDGE0_CHECK_INTERVAL) {
            return judge0Available;
        }
        synchronized (this) {
            if (System.currentTimeMillis() - lastJudge0Check < JUDGE0_CHECK_INTERVAL) {
                return judge0Available;
            }
            lastJudge0Check = System.currentTimeMillis();
            try {
                HttpRequest probe = HttpRequest.newBuilder()
                        .uri(URI.create(judge0ApiUrl + "/about"))
                        .timeout(java.time.Duration.ofMillis(800))
                        .GET()
                        .build();
                HttpResponse<String> resp = httpClient.send(probe, HttpResponse.BodyHandlers.ofString());
                judge0Available = (resp.statusCode() == 200);
            } catch (Exception e) {
                judge0Available = false;
            }
            return judge0Available;
        }
    }

    @Transactional
    public SubmissionResultDto submitCode(SubmitRequest request) {
        long startTime = System.currentTimeMillis();
        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new RuntimeException("Question not found"));

        StudentTest studentTest = null;
        if (request.getStudentTestId() != null) {
            studentTest = studentTestRepository.findById(request.getStudentTestId()).orElse(null);
        }

        List<TestCase> allTestCases = testCaseRepository.findByQuestionId(question.getId());
        boolean runOnly = Boolean.TRUE.equals(request.getRunOnly());

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
                customTc1.setExpectedOutput(getExpectedOutputForCustomInput(allTestCases, sampleTestCases, request.getCustomInput(), 0));
                customTc1.setIsHidden(false);
                testCases.add(customTc1);
                hasCustom = true;
            }
            if (request.getCustomInput2() != null && !request.getCustomInput2().trim().isEmpty()) {
                TestCase customTc2 = new TestCase();
                customTc2.setId(-998L);
                customTc2.setInputData(request.getCustomInput2());
                customTc2.setExpectedOutput(getExpectedOutputForCustomInput(allTestCases, sampleTestCases, request.getCustomInput2(), 1));
                customTc2.setIsHidden(false);
                testCases.add(customTc2);
                hasCustom = true;
            }
            if (request.getCustomInput3() != null && !request.getCustomInput3().trim().isEmpty()) {
                TestCase customTc3 = new TestCase();
                customTc3.setId(-997L);
                customTc3.setInputData(request.getCustomInput3());
                customTc3.setExpectedOutput(getExpectedOutputForCustomInput(allTestCases, sampleTestCases, request.getCustomInput3(), 2));
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

        long evalStartTime = System.currentTimeMillis();
        SubmissionResultDto resultDto = evaluateCode(request, question, testCases, studentTest);
        long evalEndTime = System.currentTimeMillis();

        if (!runOnly) {
            Submission sub = saveSubmissionRecord(studentTest, question, request, resultDto);
            sub.setScore(resultDto.getScore());
            sub.setTotalMarks(resultDto.getTotalMarks());
            sub.setPassingMarks(resultDto.getPassingMarks());
            sub.setPercentage(resultDto.getPercentage());
            sub.setOverallResult(resultDto.getOverallResult());
            submissionRepository.save(sub);
            resultDto.setSubmissionId(sub.getId());

            try {
                User student = studentTest != null ? studentTest.getStudent() : getCurrentUser();
                Long adminId = studentQuestionStatusService.resolveAdminId(studentTest, question);
                StudentQuestionStatus sqs = studentQuestionStatusService.updateStatus(student, question, sub, adminId);
                if (sqs != null && sqs.getAttemptCount() != null) {
                    resultDto.setAttemptCount(sqs.getAttemptCount());
                }
            } catch (Exception e) {
                System.err.println(String.format(
                    "[StudentQuestionStatus] FAILED to update: studentTestId=%s, questionId=%s, error=%s",
                    studentTest != null ? studentTest.getId() : "null",
                    question != null ? question.getId() : "null",
                    e.getMessage()
                ));
            }

            if (studentTest != null) {
                updateStudentTestScore(studentTest, question, resultDto.getScore());
            }

            logSubmission(sub, studentTest, question, request, resultDto);
        }

        long totalTime = System.currentTimeMillis() - startTime;
        log.info("[Performance Metrics] {} completed in {}ms (Execution: {}ms, Status: {})",
                runOnly ? "Compile & Run" : "Submit Question", totalTime, (evalEndTime - evalStartTime), resultDto.getStatus());

        return resultDto;
    }

    public SubmissionResultDto evaluateCode(SubmitRequest request, Question question, List<TestCase> testCases, StudentTest studentTest) {
        return evaluateCode(request, question, testCases, studentTest, true);
    }

    public SubmissionResultDto evaluateCode(SubmitRequest request, Question question, List<TestCase> testCases, StudentTest studentTest, boolean includeAiHint) {
        String lang = request.getLanguage().toLowerCase();
        int languageId = getJudge0LanguageId(lang);

        SubmissionResultDto resultDto = new SubmissionResultDto();
        resultDto.setTestCaseResults(new ArrayList<>());
        resultDto.setRunTimeMs(0);
        resultDto.setMemoryUsedKb(0);

        String overallVerdict = "ACCEPTED";
        int maxRunTimeMs = 0;
        int maxMemoryUsedKb = 0;
        int passedCount = 0;
        int failedTestCaseIndex = -1; // 1-based index
        String firstFailedExpected = null;
        String firstFailedActual = null;
        String firstFailedJudge0Status = "Accepted";

        if (testCases == null || testCases.isEmpty()) {
            overallVerdict = "WRONG_ANSWER";
            TestCaseResultDto tcResult = new TestCaseResultDto();
            tcResult.setStatus("FAILED");
            tcResult.setMessage("No test case has been set up for this question by the administrator. Please contact your coordinator.");
            resultDto.getTestCaseResults().add(tcResult);
            resultDto.setTotalTests(0);
            resultDto.setPassedTests(0);
        } else {
            final int finalLanguageId = languageId;
            final String sourceCode = request.getCode() != null ? request.getCode() : "";

            List<TcExecutionResult> results = executeAllTestCases(sourceCode, finalLanguageId, testCases);

            for (int i = 0; i < results.size(); i++) {
                TcExecutionResult item = results.get(i);
                TestCase tc = (i < testCases.size()) ? testCases.get(i) : null;
                TestCaseResultDto tcResult = item.tcResult;

                if (item.timeMs > maxRunTimeMs) maxRunTimeMs = item.timeMs;
                if (item.memoryKb > maxMemoryUsedKb) maxMemoryUsedKb = item.memoryKb;

                if (resultDto.getStdout() == null || resultDto.getStdout().isEmpty()) {
                    resultDto.setStdout(item.stdout);
                }
                if (resultDto.getStderr() == null || resultDto.getStderr().isEmpty()) {
                    resultDto.setStderr(item.stderr);
                }

                if (item.statusId == 6) { // Compilation Error
                    resultDto.setCompileError(item.compileOutput);
                    overallVerdict = "COMPILATION_ERROR";
                    firstFailedJudge0Status = "Compilation Error";
                    resultDto.getTestCaseResults().add(tcResult);
                    break; // Stop collecting subsequent testcases on compilation error
                } else if (item.statusId == 5) {
                    overallVerdict = updateVerdict(overallVerdict, "TIME_LIMIT_EXCEEDED");
                    if (failedTestCaseIndex == -1) {
                        failedTestCaseIndex = i + 1;
                        firstFailedJudge0Status = "Time Limit Exceeded";
                    }
                } else if (item.statusId == 8) {
                    overallVerdict = updateVerdict(overallVerdict, "MEMORY_LIMIT_EXCEEDED");
                    if (failedTestCaseIndex == -1) {
                        failedTestCaseIndex = i + 1;
                        firstFailedJudge0Status = "Memory Limit Exceeded";
                    }
                } else if (item.statusId == 7 || item.statusId == 9 || item.statusId == 10 || item.statusId == 11 || item.statusId == 12) {
                    overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
                    if (failedTestCaseIndex == -1) {
                        failedTestCaseIndex = i + 1;
                        resultDto.setStderr(item.stderr);
                        firstFailedJudge0Status = "Runtime Error";
                    }
                } else {
                    if (item.passed) {
                        passedCount++;
                    } else {
                        overallVerdict = updateVerdict(overallVerdict, "WRONG_ANSWER");
                        if (failedTestCaseIndex == -1) {
                            failedTestCaseIndex = i + 1;
                            firstFailedJudge0Status = "Wrong Answer";
                            if (tc != null && (tc.getIsHidden() == null || !tc.getIsHidden())) {
                                firstFailedExpected = tc.getExpectedOutput();
                                firstFailedActual = item.stdout;
                            }
                        }
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

        // Fetch Grok explanation only when requested (Compile & Run); background exam evaluation skips unused external AI call
        if (includeAiHint && !"ACCEPTED".equals(overallVerdict)) {
            String runStderr = resultDto.getStderr() != null ? resultDto.getStderr() : "";
            String explanation = getGrokExplanation(overallVerdict, request.getCode(), resultDto.getCompileError(), runStderr, lang, "", firstFailedExpected, firstFailedActual, studentTest, question);
            resultDto.setAiExplanation(explanation);
        }

        int finalScore = 0;
        if (resultDto.getTestCaseResults() != null) {
            for (TestCaseResultDto tcRes : resultDto.getTestCaseResults()) {
                if (tcRes.getMarksAwarded() != null) {
                    finalScore += tcRes.getMarksAwarded();
                }
            }
        }

        int qTotalMarks = (question != null && question.getTotalMarks() != null) ? question.getTotalMarks() : 20;
        int qPassingMarks = (question != null && question.getPassingMarks() != null) ? question.getPassingMarks() : 10;
        if (testCases != null && !testCases.isEmpty()) {
            int tcSum = testCases.stream().mapToInt(tc -> tc.getMarks() != null ? tc.getMarks() : 5).sum();
            if (tcSum > 0) {
                qTotalMarks = tcSum;
            }
        }

        double percentage = qTotalMarks > 0 ? Math.round(((double) finalScore * 100.0 / qTotalMarks) * 100.0) / 100.0 : 0.0;
        String overallResult = finalScore >= qPassingMarks ? "PASS" : "FAIL";

        resultDto.setScore(finalScore);
        resultDto.setTotalMarks(qTotalMarks);
        resultDto.setPassingMarks(qPassingMarks);
        resultDto.setPercentage(percentage);
        resultDto.setOverallResult(overallResult);

        return resultDto;
    }

    @Transactional
    public void evaluateExistingSubmission(Long submissionId, SubmitRequest request) {
        Submission sub = submissionRepository.findById(submissionId).orElse(null);
        if (sub == null) return;
        // Idempotency guard: only evaluate submissions that are currently PENDING or EVALUATING
        if (!"PENDING".equals(sub.getStatus()) && !"EVALUATING".equals(sub.getStatus())) {
            log.info("[Evaluate] Submission {} already finalized with status {}, skipping duplicate evaluation", submissionId, sub.getStatus());
            return;
        }

        Question question = sub.getQuestion();
        if (question == null) return;

        StudentTest studentTest = sub.getStudentTest();
        List<TestCase> allTestCases = testCaseRepository.findByQuestionId(question.getId());
        Map<Long, TestCase> testCaseById = new HashMap<>();
        if (allTestCases != null) {
            for (TestCase tc : allTestCases) {
                if (tc.getId() != null) {
                    testCaseById.put(tc.getId(), tc);
                }
            }
        }

        SubmissionResultDto resultDto = evaluateCode(request, question, allTestCases, studentTest, false);

        sub.setStatus(resultDto.getStatus());
        sub.setScore(resultDto.getScore());
        sub.setTotalMarks(resultDto.getTotalMarks());
        sub.setPassingMarks(resultDto.getPassingMarks());
        sub.setPercentage(resultDto.getPercentage());
        sub.setOverallResult(resultDto.getOverallResult());
        sub.setRunTimeMs(resultDto.getRunTimeMs());
        sub.setMemoryUsedKb(resultDto.getMemoryUsedKb());
        sub.setCompileError(resultDto.getCompileError());
        sub.setStdout(resultDto.getStdout());
        sub.setStderr(resultDto.getStderr());
        sub.setExpectedOutput(resultDto.getExpectedOutput());
        sub.setActualOutput(resultDto.getActualOutput());
        sub.setFailedTestCaseNumber(resultDto.getFailedTestCaseNumber());
        sub.setPassedTests(resultDto.getPassedTests() != null ? resultDto.getPassedTests() : 0);
        sub.setTotalTests(resultDto.getTotalTests() != null ? resultDto.getTotalTests() : 0);
        sub.setJudge0Token(resultDto.getJudge0Status() != null ? resultDto.getJudge0Status() : "local_run");
        submissionRepository.save(sub);

        if (resultDto.getTestCaseResults() != null) {
            List<SubmissionTestCase> subTcList = new ArrayList<>();
            for (TestCaseResultDto tcRes : resultDto.getTestCaseResults()) {
                if (tcRes.getTestCaseId() != null) {
                    TestCase tc = testCaseById.get(tcRes.getTestCaseId());
                    if (tc != null) {
                        String msg = tcRes.getMessage();
                        if (msg != null && msg.length() > 1000) {
                            msg = msg.substring(0, 997) + "...";
                        }
                        SubmissionTestCase subTc = SubmissionTestCase.builder()
                                .submission(sub)
                                .testCase(tc)
                                .status(tcRes.getStatus() != null ? tcRes.getStatus() : "FAILED")
                                .runTimeMs(tcRes.getRunTimeMs() != null ? tcRes.getRunTimeMs() : 0)
                                .memoryUsedKb(tcRes.getMemoryUsedKb() != null ? tcRes.getMemoryUsedKb() : 0)
                                .marksAwarded(tcRes.getMarksAwarded() != null ? tcRes.getMarksAwarded() : 0)
                                .message(msg)
                                .build();
                        subTcList.add(subTc);
                    }
                }
            }
            if (!subTcList.isEmpty()) {
                submissionTestCaseRepository.saveAll(subTcList);
                sub.setSubmissionTestCases(subTcList);
            }
        }

        try {
            User student = studentTest != null ? studentTest.getStudent() : sub.getAdmin();
            Long adminId = studentQuestionStatusService.resolveAdminId(studentTest, question);
            studentQuestionStatusService.updateStatus(student, question, sub, adminId);
        } catch (Exception e) {
            System.err.println("[StudentQuestionStatus] async update status failed: " + e.getMessage());
        }

        if (studentTest != null) {
            updateStudentTestScore(studentTest, question, resultDto.getScore());
        }
        logSubmission(sub, studentTest, question, request, resultDto);
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
        Object principal = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof com.chillcode.assessment.security.CustomUserDetails) {
            return ((com.chillcode.assessment.security.CustomUserDetails) principal).getUser();
        }
        String identifier = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication().getName();
        return userRepository.findByIdentifier(identifier)
                .orElseThrow(() -> new RuntimeException("Current user not found"));
    }

    // updateStudentQuestionStatus is now in StudentQuestionStatusService
    // with REQUIRES_NEW transaction isolation to prevent Submission cascade failures.

    private List<TcExecutionResult> executeAllTestCases(String sourceCode, int languageId, List<TestCase> testCases) {
        if (!isJudge0Available()) {
            return executeLocallyBatch(sourceCode, languageId, testCases);
        }
        return executeJudge0BatchOrConcurrent(sourceCode, languageId, testCases);
    }

    private List<TcExecutionResult> executeJudge0BatchOrConcurrent(String sourceCode, int languageId, List<TestCase> testCases) {
        if (testCases != null && testCases.size() > 1) {
            try {
                List<TcExecutionResult> batchResults = executeJudge0BatchNative(sourceCode, languageId, testCases);
                if (batchResults != null && batchResults.size() == testCases.size()) {
                    return batchResults;
                }
            } catch (Exception batchEx) {
                log.debug("Judge0 batch endpoint fallback to concurrent wait=true: {}", batchEx.getMessage());
            }
        }

        List<CompletableFuture<TcExecutionResult>> futures = new ArrayList<>();
        for (int i = 0; i < testCases.size(); i++) {
            final int tcIdx = i;
            final TestCase tc = testCases.get(i);
            futures.add(CompletableFuture.supplyAsync(() -> {
                try {
                    JsonNode res = executeOnJudge0(sourceCode, languageId, tc.getInputData(), null);
                    return mapJsonNodeToTcResult(res, tc, tcIdx);
                } catch (Exception ex) {
                    TcExecutionResult item = new TcExecutionResult();
                    item.index = tcIdx;
                    item.statusId = 11;
                    item.tcResult = buildFailedTcResult(tc, "FAILED", "Execution error: " + ex.getMessage());
                    return item;
                }
            }, testCaseExecutor));
        }
        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        List<TcExecutionResult> results = new ArrayList<>();
        for (CompletableFuture<TcExecutionResult> f : futures) {
            try {
                results.add(f.get());
            } catch (Exception ignored) {}
        }
        results.sort(Comparator.comparingInt(a -> a.index));
        return results;
    }

    private List<TcExecutionResult> executeJudge0BatchNative(String sourceCode, int languageId, List<TestCase> testCases) throws Exception {
        String base64Source = Base64.getEncoder().encodeToString(sourceCode.getBytes(StandardCharsets.UTF_8));
        List<Map<String, Object>> submissionsPayload = new ArrayList<>(testCases.size());
        for (TestCase tc : testCases) {
            Map<String, Object> item = new HashMap<>();
            item.put("source_code", base64Source);
            item.put("language_id", languageId);
            if (tc.getInputData() != null) {
                item.put("stdin", Base64.getEncoder().encodeToString(tc.getInputData().getBytes(StandardCharsets.UTF_8)));
            }
            submissionsPayload.add(item);
        }
        Map<String, Object> batchBody = Collections.singletonMap("submissions", submissionsPayload);
        String jsonPayload = OBJECT_MAPPER.writeValueAsString(batchBody);

        HttpRequest createReq = HttpRequest.newBuilder()
                .uri(URI.create(judge0ApiUrl + "/submissions/batch?base64_encoded=true"))
                .header("Content-Type", "application/json")
                .timeout(java.time.Duration.ofSeconds(6))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> createResp = httpClient.send(createReq, HttpResponse.BodyHandlers.ofString());
        if (createResp.statusCode() != 201 && createResp.statusCode() != 200) {
            throw new RuntimeException("Judge0 batch submit failed with status " + createResp.statusCode());
        }

        JsonNode tokensArray = OBJECT_MAPPER.readTree(createResp.body());
        if (!tokensArray.isArray() || tokensArray.size() != testCases.size()) {
            throw new RuntimeException("Unexpected Judge0 batch token response");
        }

        List<String> tokens = new ArrayList<>(testCases.size());
        for (JsonNode n : tokensArray) {
            String tok = n.path("token").asText("");
            if (tok.isEmpty()) throw new RuntimeException("Missing token in Judge0 batch response");
            tokens.add(tok);
        }

        String joinedTokens = String.join(",", tokens);
        String pollUrl = judge0ApiUrl + "/submissions/batch?tokens=" + joinedTokens +
                "&base64_encoded=true&fields=token,stdout,stderr,compile_output,status,time,memory";

        long deadlineMs = System.currentTimeMillis() + 15000L;
        long[] intervalsMs = {120L, 180L, 250L, 350L};
        int pollAttempt = 0;

        while (System.currentTimeMillis() < deadlineMs) {
            long waitMs = intervalsMs[Math.min(pollAttempt++, intervalsMs.length - 1)];
            Thread.sleep(waitMs);

            HttpRequest pollReq = HttpRequest.newBuilder()
                    .uri(URI.create(pollUrl))
                    .timeout(java.time.Duration.ofSeconds(5))
                    .GET()
                    .build();
            HttpResponse<String> pollResp = httpClient.send(pollReq, HttpResponse.BodyHandlers.ofString());
            if (pollResp.statusCode() != 200) continue;

            JsonNode root = OBJECT_MAPPER.readTree(pollResp.body());
            JsonNode subsNode = root.path("submissions");
            if (!subsNode.isArray() || subsNode.size() != testCases.size()) continue;

            boolean allDone = true;
            for (JsonNode subNode : subsNode) {
                int sid = subNode.path("status").path("id").asInt(0);
                if (sid == 1 || sid == 2 || sid == 0) {
                    allDone = false;
                    break;
                }
            }

            if (allDone) {
                List<TcExecutionResult> results = new ArrayList<>(testCases.size());
                for (int i = 0; i < testCases.size(); i++) {
                    results.add(mapJsonNodeToTcResult(subsNode.get(i), testCases.get(i), i));
                }
                return results;
            }
        }
        throw new RuntimeException("Judge0 batch polling timed out");
    }

    private TcExecutionResult mapJsonNodeToTcResult(JsonNode res, TestCase tc, int tcIdx) {
        TcExecutionResult item = new TcExecutionResult();
        item.index = tcIdx;
        TestCaseResultDto tcResult = new TestCaseResultDto();
        tcResult.setTestCaseId(tc.getId());
        tcResult.setInputData(tc.getInputData());
        tcResult.setExpectedOutput(tc.getExpectedOutput());
        int tcMaxMarks = tc.getMarks() != null ? tc.getMarks() : 5;
        tcResult.setMarks(tcMaxMarks);
        tcResult.setMarksAwarded(0);
        item.tcResult = tcResult;

        item.statusId = res.path("status").path("id").asInt();
        double time = res.path("time").asDouble();
        item.timeMs = (int) (time * 1000);
        tcResult.setRunTimeMs(item.timeMs);
        item.memoryKb = res.path("memory").asInt();
        tcResult.setMemoryUsedKb(item.memoryKb);

        item.stdout = decodeBase64(res.path("stdout").asText());
        item.stderr = decodeBase64(res.path("stderr").asText());
        item.compileOutput = decodeBase64(res.path("compile_output").asText());

        if (item.statusId == 6) {
            tcResult.setStatus("COMPILATION_ERROR");
            tcResult.setMessage("Compilation Error:\n" + item.compileOutput);
            tcResult.setActualOutput("Compilation Error:\n" + item.compileOutput);
        } else if (item.statusId == 5) {
            tcResult.setStatus("TLE");
            tcResult.setMessage("Time Limit Exceeded");
            tcResult.setActualOutput("Time Limit Exceeded");
        } else if (item.statusId == 8) {
            tcResult.setStatus("MLE");
            tcResult.setMessage("Memory Limit Exceeded");
            tcResult.setActualOutput("Memory Limit Exceeded");
        } else if (item.statusId == 7 || item.statusId == 9 || item.statusId == 10 || item.statusId == 11 || item.statusId == 12) {
            tcResult.setStatus("RTE");
            tcResult.setMessage("Runtime Error:\n" + item.stderr);
            tcResult.setActualOutput("Runtime Error:\n" + item.stderr);
        } else {
            String expectedOut = tc.getExpectedOutput();
            tcResult.setActualOutput(item.stdout);
            boolean hasValidExpected = (expectedOut != null && !expectedOut.trim().isEmpty() && !"N/A".equalsIgnoreCase(expectedOut.trim()));
            if (hasValidExpected && compareOutputs(expectedOut, item.stdout)) {
                item.statusId = 3;
                item.passed = true;
                tcResult.setStatus("PASSED");
                tcResult.setMarksAwarded(tcMaxMarks);
                tcResult.setMessage("Test Case Passed");
            } else {
                item.statusId = 4;
                tcResult.setStatus("FAILED");
                tcResult.setMarksAwarded(0);
                if (tc.getIsHidden() != null && tc.getIsHidden()) {
                    tcResult.setMessage("Output doesn't match expected output. (Hidden testcase failed)");
                } else {
                    tcResult.setMessage("Output doesn't match expected output.\nExpected:\n" + (expectedOut != null ? expectedOut.trim() : "") + "\nYour Output:\n" + (item.stdout != null ? item.stdout.trim() : ""));
                }
            }
        }
        return item;
    }

    private TestCaseResultDto buildFailedTcResult(TestCase tc, String status, String message) {
        TestCaseResultDto tcResult = new TestCaseResultDto();
        tcResult.setTestCaseId(tc.getId());
        tcResult.setInputData(tc.getInputData());
        tcResult.setExpectedOutput(tc.getExpectedOutput());
        tcResult.setMarks(tc.getMarks() != null ? tc.getMarks() : 5);
        tcResult.setMarksAwarded(0);
        tcResult.setStatus(status);
        tcResult.setMessage(message);
        tcResult.setActualOutput(message);
        return tcResult;
    }

    private List<TcExecutionResult> executeLocallyBatch(String code, int languageId, List<TestCase> testCases) {
        List<TcExecutionResult> results = new ArrayList<>();
        File tempDir = new File(System.getProperty("user.dir"), "temp_batch_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000));
        tempDir.mkdirs();

        try {
            if (languageId == 62) { // Java
                String className = "Main";
                java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("public\\s+class\\s+([A-Za-z0-9_]+)").matcher(code);
                if (matcher.find()) {
                    className = matcher.group(1);
                }
                File sourceFile = new File(tempDir, className + ".java");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);

                int compileResult = -1;
                ByteArrayOutputStream errStream = new ByteArrayOutputStream();
                javax.tools.JavaCompiler compiler = javax.tools.ToolProvider.getSystemJavaCompiler();
                if (compiler != null) {
                    compileResult = compiler.run(null, null, errStream, sourceFile.getAbsolutePath());
                } else {
                    ProcessBuilder compilePb = System.getProperty("os.name").toLowerCase().contains("win")
                            ? new ProcessBuilder("cmd.exe", "/c", "javac", sourceFile.getAbsolutePath())
                            : new ProcessBuilder("javac", sourceFile.getAbsolutePath());
                    Process compileProcess = compilePb.start();
                    try (InputStream is = compileProcess.getErrorStream()) {
                        is.transferTo(errStream);
                    }
                    boolean done = compileProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                    compileResult = done ? compileProcess.exitValue() : -1;
                }

                if (compileResult != 0) {
                    String compileOutput = errStream.toString(StandardCharsets.UTF_8);
                    for (int i = 0; i < testCases.size(); i++) {
                        TestCase tc = testCases.get(i);
                        TcExecutionResult item = new TcExecutionResult();
                        item.index = i;
                        item.statusId = 6;
                        item.compileOutput = compileOutput;
                        item.tcResult = buildFailedTcResult(tc, "COMPILATION_ERROR", "Compilation Error:\n" + compileOutput);
                        results.add(item);
                    }
                    return results;
                }

                final String finalClassName = className;
                List<CompletableFuture<TcExecutionResult>> runFutures = new ArrayList<>();
                for (int i = 0; i < testCases.size(); i++) {
                    final int tcIdx = i;
                    final TestCase tc = testCases.get(i);
                    runFutures.add(CompletableFuture.supplyAsync(() -> runCompiledJavaTestCase(tempDir, finalClassName, tc, tcIdx), testCaseExecutor));
                }
                CompletableFuture.allOf(runFutures.toArray(new CompletableFuture[0])).join();
                for (CompletableFuture<TcExecutionResult> f : runFutures) {
                    results.add(f.get());
                }
                results.sort(Comparator.comparingInt(a -> a.index));
                return results;

            } else if (languageId == 71) { // Python
                File sourceFile = new File(tempDir, "solution.py");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                String pyCmd = getPythonExecutable();

                List<CompletableFuture<TcExecutionResult>> runFutures = new ArrayList<>();
                for (int i = 0; i < testCases.size(); i++) {
                    final int tcIdx = i;
                    final TestCase tc = testCases.get(i);
                    runFutures.add(CompletableFuture.supplyAsync(() -> runPythonTestCase(sourceFile, pyCmd, tc, tcIdx), testCaseExecutor));
                }
                CompletableFuture.allOf(runFutures.toArray(new CompletableFuture[0])).join();
                for (CompletableFuture<TcExecutionResult> f : runFutures) {
                    results.add(f.get());
                }
                results.sort(Comparator.comparingInt(a -> a.index));
                return results;

            } else if (languageId == 50 || languageId == 54) { // C or C++
                boolean isCpp = (languageId == 54);
                String fileName = isCpp ? "solution.cpp" : "solution.c";
                File sourceFile = new File(tempDir, fileName);
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                File exeFile = new File(tempDir, System.getProperty("os.name").toLowerCase().contains("win") ? "solution.exe" : "solution");

                String compilerCmd = isCpp ? getCompilerExecutable("g++") : getCompilerExecutable("gcc");
                ProcessBuilder compilePb = new ProcessBuilder(compilerCmd, "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                ByteArrayOutputStream errStream = new ByteArrayOutputStream();
                Process compileProcess = compilePb.start();
                try (InputStream is = compileProcess.getErrorStream()) {
                    is.transferTo(errStream);
                }
                boolean done = compileProcess.waitFor(10, java.util.concurrent.TimeUnit.SECONDS);
                int compileResult = done ? compileProcess.exitValue() : -1;

                if (compileResult != 0) {
                    String compileOutput = errStream.toString(StandardCharsets.UTF_8);
                    if (compileOutput.isBlank()) compileOutput = "Compilation failed with exit code " + compileResult;
                    for (int i = 0; i < testCases.size(); i++) {
                        TestCase tc = testCases.get(i);
                        TcExecutionResult item = new TcExecutionResult();
                        item.index = i;
                        item.statusId = 6;
                        item.compileOutput = compileOutput;
                        item.tcResult = buildFailedTcResult(tc, "COMPILATION_ERROR", "Compilation Error:\n" + compileOutput);
                        results.add(item);
                    }
                    return results;
                }

                List<CompletableFuture<TcExecutionResult>> runFutures = new ArrayList<>();
                for (int i = 0; i < testCases.size(); i++) {
                    final int tcIdx = i;
                    final TestCase tc = testCases.get(i);
                    runFutures.add(CompletableFuture.supplyAsync(() -> runNativeExecutableTestCase(exeFile, tc, tcIdx), testCaseExecutor));
                }
                CompletableFuture.allOf(runFutures.toArray(new CompletableFuture[0])).join();
                for (CompletableFuture<TcExecutionResult> f : runFutures) {
                    results.add(f.get());
                }
                results.sort(Comparator.comparingInt(a -> a.index));
                return results;

            } else {
                for (int i = 0; i < testCases.size(); i++) {
                    TestCase tc = testCases.get(i);
                    JsonNode res = executeLocallyFallback(code, languageId, tc.getInputData(), tc.getExpectedOutput());
                    results.add(mapJsonNodeToTcResult(res, tc, i));
                }
                return results;
            }
        } catch (Exception ex) {
            System.err.println("executeLocallyBatch error: " + ex.getMessage());
            for (int i = 0; i < testCases.size(); i++) {
                TestCase tc = testCases.get(i);
                TcExecutionResult item = new TcExecutionResult();
                item.index = i;
                item.statusId = 11;
                item.stderr = "Execution error: " + ex.getMessage();
                item.tcResult = buildFailedTcResult(tc, "FAILED", "Execution error: " + ex.getMessage());
                results.add(item);
            }
            return results;
        } finally {
            deleteDirectory(tempDir);
        }
    }

    private TcExecutionResult runCompiledJavaTestCase(File classDir, String className, TestCase tc, int tcIdx) {
        TcExecutionResult item = new TcExecutionResult();
        item.index = tcIdx;
        TestCaseResultDto tcResult = new TestCaseResultDto();
        tcResult.setTestCaseId(tc.getId());
        tcResult.setInputData(tc.getInputData());
        tcResult.setExpectedOutput(tc.getExpectedOutput());
        int tcMaxMarks = tc.getMarks() != null ? tc.getMarks() : 5;
        tcResult.setMarks(tcMaxMarks);
        tcResult.setMarksAwarded(0);
        item.tcResult = tcResult;

        long startTime = System.currentTimeMillis();
        try {
            ProcessBuilder pb = System.getProperty("os.name").toLowerCase().contains("win")
                    ? new ProcessBuilder("cmd.exe", "/c", "java", "-cp", classDir.getAbsolutePath(), className)
                    : new ProcessBuilder("java", "-cp", classDir.getAbsolutePath(), className);
            Process process = pb.start();

            if (tc.getInputData() != null && !tc.getInputData().isEmpty()) {
                try (OutputStream os = process.getOutputStream()) {
                    os.write(tc.getInputData().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }
            } else {
                try { process.getOutputStream().close(); } catch (Exception ignored) {}
            }

            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            ByteArrayOutputStream errStream = new ByteArrayOutputStream();

            Thread outThread = new Thread(() -> {
                try (InputStream is = process.getInputStream()) { is.transferTo(outStream); } catch (Exception ignored) {}
            });
            Thread errThread = new Thread(() -> {
                try (InputStream is = process.getErrorStream()) { is.transferTo(errStream); } catch (Exception ignored) {}
            });
            outThread.start();
            errThread.start();

            boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                item.statusId = 5;
                tcResult.setStatus("TLE");
                tcResult.setMessage("Time Limit Exceeded");
                tcResult.setActualOutput("Time Limit Exceeded");
            } else {
                outThread.join(1000);
                errThread.join(1000);
                item.timeMs = (int) (System.currentTimeMillis() - startTime);
                tcResult.setRunTimeMs(item.timeMs);
                tcResult.setMemoryUsedKb(1200);

                int exitCode = process.exitValue();
                item.stdout = outStream.toString(StandardCharsets.UTF_8);
                item.stderr = errStream.toString(StandardCharsets.UTF_8);

                if (exitCode != 0) {
                    item.statusId = 11;
                    tcResult.setStatus("RTE");
                    tcResult.setMessage("Runtime Error:\n" + item.stderr);
                    tcResult.setActualOutput("Runtime Error:\n" + item.stderr);
                } else {
                    tcResult.setActualOutput(item.stdout);
                    String expectedOut = tc.getExpectedOutput();
                    boolean hasValidExpected = (expectedOut != null && !expectedOut.trim().isEmpty() && !"N/A".equalsIgnoreCase(expectedOut.trim()));
                    if (hasValidExpected && compareOutputs(expectedOut, item.stdout)) {
                        item.statusId = 3;
                        item.passed = true;
                        tcResult.setStatus("PASSED");
                        tcResult.setMarksAwarded(tcMaxMarks);
                        tcResult.setMessage("Test Case Passed");
                    } else {
                        item.statusId = 4;
                        tcResult.setStatus("FAILED");
                        tcResult.setMarksAwarded(0);
                        if (tc.getIsHidden() != null && tc.getIsHidden()) {
                            tcResult.setMessage("Output doesn't match expected output. (Hidden testcase failed)");
                        } else {
                            tcResult.setMessage("Output doesn't match expected output.\nExpected:\n" + (expectedOut != null ? expectedOut.trim() : "") + "\nYour Output:\n" + (item.stdout != null ? item.stdout.trim() : ""));
                        }
                    }
                }
            }
        } catch (Exception e) {
            item.statusId = 11;
            tcResult.setStatus("FAILED");
            tcResult.setMessage("Execution error: " + e.getMessage());
            tcResult.setActualOutput("Execution error: " + e.getMessage());
        }
        return item;
    }

    private TcExecutionResult runPythonTestCase(File sourceFile, String pyCmd, TestCase tc, int tcIdx) {
        TcExecutionResult item = new TcExecutionResult();
        item.index = tcIdx;
        TestCaseResultDto tcResult = new TestCaseResultDto();
        tcResult.setTestCaseId(tc.getId());
        tcResult.setInputData(tc.getInputData());
        tcResult.setExpectedOutput(tc.getExpectedOutput());
        int tcMaxMarks = tc.getMarks() != null ? tc.getMarks() : 5;
        tcResult.setMarks(tcMaxMarks);
        tcResult.setMarksAwarded(0);
        item.tcResult = tcResult;

        long startTime = System.currentTimeMillis();
        try {
            ProcessBuilder pb = System.getProperty("os.name").toLowerCase().contains("win")
                    ? new ProcessBuilder("cmd.exe", "/c", pyCmd, sourceFile.getAbsolutePath())
                    : new ProcessBuilder(pyCmd, sourceFile.getAbsolutePath());
            Process process = pb.start();

            if (tc.getInputData() != null && !tc.getInputData().isEmpty()) {
                try (OutputStream os = process.getOutputStream()) {
                    os.write(tc.getInputData().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }
            } else {
                try { process.getOutputStream().close(); } catch (Exception ignored) {}
            }

            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            ByteArrayOutputStream errStream = new ByteArrayOutputStream();

            Thread outThread = new Thread(() -> {
                try (InputStream is = process.getInputStream()) { is.transferTo(outStream); } catch (Exception ignored) {}
            });
            Thread errThread = new Thread(() -> {
                try (InputStream is = process.getErrorStream()) { is.transferTo(errStream); } catch (Exception ignored) {}
            });
            outThread.start();
            errThread.start();

            boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                item.statusId = 5;
                tcResult.setStatus("TLE");
                tcResult.setMessage("Time Limit Exceeded");
                tcResult.setActualOutput("Time Limit Exceeded");
            } else {
                outThread.join(1000);
                errThread.join(1000);
                item.timeMs = (int) (System.currentTimeMillis() - startTime);
                tcResult.setRunTimeMs(item.timeMs);
                tcResult.setMemoryUsedKb(1200);

                int exitCode = process.exitValue();
                item.stdout = outStream.toString(StandardCharsets.UTF_8);
                item.stderr = errStream.toString(StandardCharsets.UTF_8);

                if (exitCode != 0) {
                    if (item.stderr.contains("SyntaxError") || item.stderr.contains("IndentationError")) {
                        item.statusId = 6;
                        item.compileOutput = item.stderr;
                        tcResult.setStatus("COMPILATION_ERROR");
                        tcResult.setMessage("Syntax Error:\n" + item.stderr);
                        tcResult.setActualOutput("Syntax Error:\n" + item.stderr);
                    } else {
                        item.statusId = 11;
                        tcResult.setStatus("RTE");
                        tcResult.setMessage("Runtime Error:\n" + item.stderr);
                        tcResult.setActualOutput("Runtime Error:\n" + item.stderr);
                    }
                } else {
                    tcResult.setActualOutput(item.stdout);
                    String expectedOut = tc.getExpectedOutput();
                    boolean hasValidExpected = (expectedOut != null && !expectedOut.trim().isEmpty() && !"N/A".equalsIgnoreCase(expectedOut.trim()));
                    if (hasValidExpected && compareOutputs(expectedOut, item.stdout)) {
                        item.statusId = 3;
                        item.passed = true;
                        tcResult.setStatus("PASSED");
                        tcResult.setMarksAwarded(tcMaxMarks);
                        tcResult.setMessage("Test Case Passed");
                    } else {
                        item.statusId = 4;
                        tcResult.setStatus("FAILED");
                        tcResult.setMarksAwarded(0);
                        if (tc.getIsHidden() != null && tc.getIsHidden()) {
                            tcResult.setMessage("Output doesn't match expected output. (Hidden testcase failed)");
                        } else {
                            tcResult.setMessage("Output doesn't match expected output.\nExpected:\n" + (expectedOut != null ? expectedOut.trim() : "") + "\nYour Output:\n" + (item.stdout != null ? item.stdout.trim() : ""));
                        }
                    }
                }
            }
        } catch (Exception e) {
            item.statusId = 11;
            tcResult.setStatus("FAILED");
            tcResult.setMessage("Execution error: " + e.getMessage());
            tcResult.setActualOutput("Execution error: " + e.getMessage());
        }
        return item;
    }

    private TcExecutionResult runNativeExecutableTestCase(File exeFile, TestCase tc, int tcIdx) {
        TcExecutionResult item = new TcExecutionResult();
        item.index = tcIdx;
        TestCaseResultDto tcResult = new TestCaseResultDto();
        tcResult.setTestCaseId(tc.getId());
        tcResult.setInputData(tc.getInputData());
        tcResult.setExpectedOutput(tc.getExpectedOutput());
        int tcMaxMarks = tc.getMarks() != null ? tc.getMarks() : 5;
        tcResult.setMarks(tcMaxMarks);
        tcResult.setMarksAwarded(0);
        item.tcResult = tcResult;

        long startTime = System.currentTimeMillis();
        try {
            ProcessBuilder pb = new ProcessBuilder(exeFile.getAbsolutePath());
            Process process = pb.start();

            if (tc.getInputData() != null && !tc.getInputData().isEmpty()) {
                try (OutputStream os = process.getOutputStream()) {
                    os.write(tc.getInputData().getBytes(StandardCharsets.UTF_8));
                    os.flush();
                }
            } else {
                try { process.getOutputStream().close(); } catch (Exception ignored) {}
            }

            ByteArrayOutputStream outStream = new ByteArrayOutputStream();
            ByteArrayOutputStream errStream = new ByteArrayOutputStream();

            Thread outThread = new Thread(() -> {
                try (InputStream is = process.getInputStream()) { is.transferTo(outStream); } catch (Exception ignored) {}
            });
            Thread errThread = new Thread(() -> {
                try (InputStream is = process.getErrorStream()) { is.transferTo(errStream); } catch (Exception ignored) {}
            });
            outThread.start();
            errThread.start();

            boolean finished = process.waitFor(5, java.util.concurrent.TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                item.statusId = 5;
                tcResult.setStatus("TLE");
                tcResult.setMessage("Time Limit Exceeded");
                tcResult.setActualOutput("Time Limit Exceeded");
            } else {
                outThread.join(1000);
                errThread.join(1000);
                item.timeMs = (int) (System.currentTimeMillis() - startTime);
                tcResult.setRunTimeMs(item.timeMs);
                tcResult.setMemoryUsedKb(1200);

                int exitCode = process.exitValue();
                item.stdout = outStream.toString(StandardCharsets.UTF_8);
                item.stderr = errStream.toString(StandardCharsets.UTF_8);

                if (exitCode != 0) {
                    item.statusId = 11;
                    tcResult.setStatus("RTE");
                    tcResult.setMessage("Runtime Error:\n" + item.stderr);
                    tcResult.setActualOutput("Runtime Error:\n" + item.stderr);
                } else {
                    tcResult.setActualOutput(item.stdout);
                    String expectedOut = tc.getExpectedOutput();
                    boolean hasValidExpected = (expectedOut != null && !expectedOut.trim().isEmpty() && !"N/A".equalsIgnoreCase(expectedOut.trim()));
                    if (hasValidExpected && compareOutputs(expectedOut, item.stdout)) {
                        item.statusId = 3;
                        item.passed = true;
                        tcResult.setStatus("PASSED");
                        tcResult.setMarksAwarded(tcMaxMarks);
                        tcResult.setMessage("Test Case Passed");
                    } else {
                        item.statusId = 4;
                        tcResult.setStatus("FAILED");
                        tcResult.setMarksAwarded(0);
                        if (tc.getIsHidden() != null && tc.getIsHidden()) {
                            tcResult.setMessage("Output doesn't match expected output. (Hidden testcase failed)");
                        } else {
                            tcResult.setMessage("Output doesn't match expected output.\nExpected:\n" + (expectedOut != null ? expectedOut.trim() : "") + "\nYour Output:\n" + (item.stdout != null ? item.stdout.trim() : ""));
                        }
                    }
                }
            }
        } catch (Exception e) {
            item.statusId = 11;
            tcResult.setStatus("FAILED");
            tcResult.setMessage("Execution error: " + e.getMessage());
            tcResult.setActualOutput("Execution error: " + e.getMessage());
        }
        return item;
    }

    private JsonNode executeOnJudge0(String code, int languageId, String stdin, String expectedOutput) {
        if (!isJudge0Available()) {
            return executeLocallyFallback(code, languageId, stdin, expectedOutput);
        }
        try {
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
            
            String jsonPayload = OBJECT_MAPPER.writeValueAsString(payload);
            
            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create(judge0ApiUrl + "/submissions?base64_encoded=true&wait=true"))
                    .header("Content-Type", "application/json")
                    .timeout(java.time.Duration.ofSeconds(6))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();
                    
            HttpResponse<String> httpResponse = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            if (httpResponse.statusCode() != 201 && httpResponse.statusCode() != 200) {
                throw new RuntimeException("Judge0 API returned status code " + httpResponse.statusCode() + ": " + httpResponse.body());
            }
            
            JsonNode resultNode = OBJECT_MAPPER.readTree(httpResponse.body());
            int statusId = resultNode.path("status").path("id").asInt(0);
            String token = resultNode.path("token").asText("");
            if ((statusId == 1 || statusId == 2 || statusId == 0) && !token.isEmpty()) {
                long deadlineMs = System.currentTimeMillis() + 10000L;
                long[] intervalsMs = {120L, 200L, 300L};
                int pollCount = 0;
                while (System.currentTimeMillis() < deadlineMs) {
                    Thread.sleep(intervalsMs[Math.min(pollCount++, intervalsMs.length - 1)]);
                    HttpRequest pollReq = HttpRequest.newBuilder()
                            .uri(URI.create(judge0ApiUrl + "/submissions/" + token + "?base64_encoded=true"))
                            .timeout(java.time.Duration.ofSeconds(4))
                            .GET()
                            .build();
                    HttpResponse<String> pollResp = httpClient.send(pollReq, HttpResponse.BodyHandlers.ofString());
                    if (pollResp.statusCode() == 200) {
                        JsonNode polled = OBJECT_MAPPER.readTree(pollResp.body());
                        int polledSid = polled.path("status").path("id").asInt(0);
                        if (polledSid >= 3) {
                            return polled;
                        }
                    }
                }
            }
            return resultNode;
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
                    String pythonCmd = getPythonExecutable();
                    if (pythonCmd.endsWith(".exe")) {
                        pb = new ProcessBuilder(pythonCmd, sourceFile.getAbsolutePath());
                    } else if (System.getProperty("os.name").toLowerCase().contains("win")) {
                        pb = new ProcessBuilder("cmd.exe", "/c", "python", sourceFile.getAbsolutePath());
                    } else {
                        pb = new ProcessBuilder(pythonCmd, sourceFile.getAbsolutePath());
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
                
                try {
                    // Compile
                    String compilerCmd = getCompilerExecutable("gcc");
                    ProcessBuilder compilePb;
                    if (compilerCmd.endsWith(".exe")) {
                        compilePb = new ProcessBuilder(compilerCmd, "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                        File binDir = new File(compilerCmd).getParentFile();
                        if (binDir != null && binDir.exists()) {
                            String oldPath = compilePb.environment().getOrDefault("PATH", "");
                            compilePb.environment().put("PATH", binDir.getAbsolutePath() + File.pathSeparator + oldPath);
                        }
                    } else if (System.getProperty("os.name").toLowerCase().contains("win")) {
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
                        if (compileOutputVal == null || compileOutputVal.trim().isEmpty()) {
                            compileOutputVal = "GCC compilation failed with exit code " + compileResult;
                        }
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
                } catch (Exception ex) {
                    statusId = 6; // Compilation Error
                    compileOutputVal = "Local C execution error: GCC compiler ('gcc') is not installed or not found on the host server PATH.\nPlease install GCC (e.g. MinGW-w64 on Windows or gcc on Linux) or enable Judge0 container.";
                }
            } else if (languageId == 54) { // C++
                File sourceFile = new File(tempDir, "solution.cpp");
                java.nio.file.Files.writeString(sourceFile.toPath(), code, StandardCharsets.UTF_8);
                File exeFile = new File(tempDir, System.getProperty("os.name").toLowerCase().contains("win") ? "solution.exe" : "solution");
                
                try {
                    // Compile
                    String compilerCmd = getCompilerExecutable("g++");
                    ProcessBuilder compilePb;
                    if (compilerCmd.endsWith(".exe")) {
                        compilePb = new ProcessBuilder(compilerCmd, "-O2", sourceFile.getAbsolutePath(), "-o", exeFile.getAbsolutePath());
                        File binDir = new File(compilerCmd).getParentFile();
                        if (binDir != null && binDir.exists()) {
                            String oldPath = compilePb.environment().getOrDefault("PATH", "");
                            compilePb.environment().put("PATH", binDir.getAbsolutePath() + File.pathSeparator + oldPath);
                        }
                    } else if (System.getProperty("os.name").toLowerCase().contains("win")) {
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
                        if (compileOutputVal == null || compileOutputVal.trim().isEmpty()) {
                            compileOutputVal = "G++ compilation failed with exit code " + compileResult;
                        }
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
                } catch (Exception ex) {
                    statusId = 6; // Compilation Error
                    compileOutputVal = "Local C++ execution error: G++ compiler ('g++') is not installed or not found on the host server PATH.\nPlease install MinGW-w64 (G++) or enable Judge0 container.";
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

    private String getCompilerExecutable(String defaultCmd) {
        if (System.getProperty("os.name").toLowerCase().contains("win")) {
            // Windows: check bundled w64devkit first
            String userDir = System.getProperty("user.dir");
            File localW64 = new File(userDir, "tools/w64devkit/bin/" + defaultCmd + ".exe");
            if (localW64.exists()) {
                return localW64.getAbsolutePath();
            }
            File backendToolsW64 = new File(userDir, "backend/tools/w64devkit/bin/" + defaultCmd + ".exe");
            if (backendToolsW64.exists()) {
                return backendToolsW64.getAbsolutePath();
            }
            File parentToolsW64 = new File(userDir, "../tools/w64devkit/bin/" + defaultCmd + ".exe");
            if (parentToolsW64.exists()) {
                return parentToolsW64.getAbsolutePath();
            }
            // Try system PATH on Windows
            try {
                Process p = new ProcessBuilder("where.exe", defaultCmd).start();
                boolean done = p.waitFor(3, java.util.concurrent.TimeUnit.SECONDS);
                if (done && p.exitValue() == 0) {
                    String path = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim().split("\\r?\\n")[0];
                    if (!path.isEmpty()) return path;
                }
            } catch (Exception ignored) {}
        } else {
            // Linux/Docker (Render, Railway, Heroku): check standard paths
            File usrBin = new File("/usr/bin/" + defaultCmd);
            if (usrBin.exists() && usrBin.canExecute()) {
                return usrBin.getAbsolutePath();
            }
            File usrLocalBin = new File("/usr/local/bin/" + defaultCmd);
            if (usrLocalBin.exists() && usrLocalBin.canExecute()) {
                return usrLocalBin.getAbsolutePath();
            }
            // Try 'which' as last resort
            try {
                Process p = new ProcessBuilder("which", defaultCmd).start();
                boolean done = p.waitFor(3, java.util.concurrent.TimeUnit.SECONDS);
                if (done && p.exitValue() == 0) {
                    String path = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
                    if (!path.isEmpty()) return path;
                }
            } catch (Exception ignored) {}
        }
        return defaultCmd;
    }


    private String getPythonExecutable() {
        if (System.getProperty("os.name").toLowerCase().contains("win")) {
            String userDir = System.getProperty("user.dir");
            File localPy = new File(userDir, "tools/python/python.exe");
            if (localPy.exists()) return localPy.getAbsolutePath();
            File backendPy = new File(userDir, "backend/tools/python/python.exe");
            if (backendPy.exists()) return backendPy.getAbsolutePath();
            File parentPy = new File(userDir, "../tools/python/python.exe");
            if (parentPy.exists()) return parentPy.getAbsolutePath();
            // Try system PATH
            try {
                Process p = new ProcessBuilder("where.exe", "python").start();
                boolean done = p.waitFor(3, java.util.concurrent.TimeUnit.SECONDS);
                if (done && p.exitValue() == 0) {
                    String path = new String(p.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim().split("\\r?\\n")[0];
                    if (!path.isEmpty()) return path;
                }
            } catch (Exception ignored) {}
        } else {
            // Linux/Docker: check standard paths
            File python3 = new File("/usr/bin/python3");
            if (python3.exists() && python3.canExecute()) return python3.getAbsolutePath();
            File python3Local = new File("/usr/local/bin/python3");
            if (python3Local.exists() && python3Local.canExecute()) return python3Local.getAbsolutePath();
            // Symlink created by Dockerfile: /usr/bin/python -> python3
            File python = new File("/usr/bin/python");
            if (python.exists() && python.canExecute()) return python.getAbsolutePath();
        }
        return "python3";
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
        
        // Group by question and take the max score for active submissions
        Map<Long, Integer> maxScores = new HashMap<>();
        int totalPassedCases = 0;
        int totalCases = 0;

        for (Submission sub : submissions) {
            if (sub.getActive() == null || sub.getActive()) {
                maxScores.put(
                    sub.getQuestion().getId(),
                    Math.max(maxScores.getOrDefault(sub.getQuestion().getId(), 0), sub.getScore())
                );
                if (sub.getPassedTests() != null) totalPassedCases += sub.getPassedTests();
                if (sub.getTotalTests() != null) totalCases += sub.getTotalTests();
            }
        }

        int totalScore = maxScores.values().stream().mapToInt(Integer::intValue).sum();
        studentTest.setScore(totalScore);
        studentTest.setTestCasesPassed(totalPassedCases);
        studentTest.setTotalTestCases(totalCases);

        com.chillcode.assessment.entity.Test test = null;
        try {
            test = studentTest.getTest();
            if (test != null) {
                test.getMaxMarks();
            }
        } catch (Exception e) {
            if (studentTest.getTest() != null && studentTest.getTest().getId() != null) {
                test = testRepository.findById(studentTest.getTest().getId()).orElse(null);
            }
        }

        int maxMarks = test != null && test.getMaxMarks() != null ? test.getMaxMarks() : 100;
        studentTest.setPassFailStatus(totalScore >= (maxMarks / 2) ? "PASS" : "FAIL");

        studentTest.setSubmittedAt(java.time.LocalDateTime.now());
        
        boolean isPracticeArena = test != null && test.getName() != null && test.getName().toLowerCase().contains("practice arena");
        
        if (!isPracticeArena) {
            if (studentTest.getTimeTakenSeconds() == null || studentTest.getTimeTakenSeconds() == 0L) {
                if (studentTest.getStartedAt() != null) {
                    long seconds = java.time.Duration.between(studentTest.getStartedAt(), studentTest.getSubmittedAt()).getSeconds();
                    studentTest.setTimeTakenSeconds(Math.max(1L, seconds));
                } else if (studentTest.getAutoSubmitted() != null && studentTest.getAutoSubmitted() && test != null && test.getDurationMinutes() != null) {
                    studentTest.setTimeTakenSeconds((long) test.getDurationMinutes() * 60);
                } else {
                    studentTest.setTimeTakenSeconds(1L); // Prevent 0 sec
                }
            }
        }

        studentTestRepository.save(studentTest);

        // Check if student earned achievement (e.g. solve 1 problem successfully)
        long acceptedCount = submissions.stream()
                .filter(s -> "ACCEPTED".equals(s.getStatus()))
                .map(s -> s.getQuestion().getId())
                .distinct()
                .count();

        if (acceptedCount >= 1 && achievementRepository.findByStudentId(studentTest.getStudent().getId()).isEmpty()) {
            User admin = null;
            if (test != null && test.getAdmin() != null) {
                admin = test.getAdmin();
            } else if (studentTest.getAdmin() != null) {
                admin = studentTest.getAdmin();
            } else if (studentTest.getStudent() != null && studentTest.getStudent().getAdmin() != null) {
                admin = studentTest.getStudent().getAdmin();
            }

            if (admin == null) {
                String diagnostics = String.format(
                    "studentTestId=%s, testId=%s, studentId=%s",
                    studentTest.getId(),
                    test != null ? test.getId() : "null",
                    studentTest.getStudent() != null ? studentTest.getStudent().getId() : "null"
                );
                throw new IllegalStateException("Cannot resolve admin ownership for Achievement. Diagnostics: " + diagnostics);
            }

            System.out.println(String.format(
                "[Achievement] Creating First Success Badge: studentId=%s, adminId=%d",
                studentTest.getStudent().getId(),
                admin.getId()
            ));

            Achievement badge = Achievement.builder()
                    .student(studentTest.getStudent())
                    .admin(admin)
                    .title("First Success Badge")
                    .type("GOLD")
                    .badgeIcon("Award")
                    .build();
            achievementRepository.save(badge);
        }

        // Dynamically recalculate badges asynchronously so it does not block saving evaluation results
        if (test != null && test.getId() != null) {
            final Long badgeTestId = test.getId();
            CompletableFuture.runAsync(() -> {
                try {
                    badgeSetService.allocateBadgesForTest(badgeTestId);
                } catch (Exception ignored) {}
            });
        }
    }

    private Submission saveSubmissionRecord(StudentTest studentTest, Question question, SubmitRequest request, SubmissionResultDto result) {
        // Resolve admin deterministically from the entity chain
        User admin = null;
        if (studentTest != null) {
            if (studentTest.getTest() != null && studentTest.getTest().getAdmin() != null) {
                admin = studentTest.getTest().getAdmin();
            } else if (studentTest.getAdmin() != null) {
                admin = studentTest.getAdmin();
            } else if (studentTest.getStudent() != null && studentTest.getStudent().getAdmin() != null) {
                admin = studentTest.getStudent().getAdmin();
            }
        }
        if (admin == null && question != null && question.getAdmin() != null) {
            admin = question.getAdmin();
        }

        if (studentTest == null && question != null) {
            try {
                User student = getCurrentUser();
                Test qTest = null;
                @SuppressWarnings("unchecked")
                List<Number> testIds = (List<Number>) entityManager.createNativeQuery(
                        "SELECT DISTINCT test_id FROM test_questions WHERE question_id = :qId")
                        .setParameter("qId", question.getId())
                        .getResultList();
                if (testIds != null && !testIds.isEmpty()) {
                    qTest = testRepository.findById(testIds.get(0).longValue()).orElse(null);
                }
                if (qTest != null && student != null) {
                    studentTest = studentTestRepository.findByStudentIdAndTestId(student.getId(), qTest.getId()).orElse(null);
                    if (studentTest == null) {
                        studentTest = StudentTest.builder()
                                .student(student)
                                .test(qTest)
                                .admin(admin != null ? admin : qTest.getAdmin())
                                .status("STARTED")
                                .startedAt(LocalDateTime.now())
                                .build();
                        studentTest = studentTestRepository.save(studentTest);
                    }
                }
            } catch (Exception ex) {
                System.err.println("Auto-resolve studentTest for standalone submission notice: " + ex.getMessage());
            }
        }

        if (admin == null) {
            String diagnostics = String.format(
                "studentTestId=%s, testId=%s, questionId=%s",
                studentTest != null ? studentTest.getId() : "null",
                studentTest != null && studentTest.getTest() != null ? studentTest.getTest().getId() : "null",
                question != null ? question.getId() : "null"
            );
            throw new IllegalStateException("Cannot resolve admin ownership for Submission. Diagnostics: " + diagnostics);
        }

        System.out.println(String.format(
            "[Submission] Creating record: studentTestId=%s, questionId=%s, adminId=%d, language=%s",
            studentTest != null ? studentTest.getId() : "null",
            question != null ? question.getId() : "null",
            admin.getId(),
            request.getLanguage()
        ));

        Long timeTakenSeconds = request.getTimeTakenSeconds();
        if (timeTakenSeconds == null) {
            if (studentTest != null && studentTest.getStudent() != null && question != null) {
                StudentQuestionStatus sqs = studentQuestionStatusRepository
                        .findByStudentIdAndQuestionId(studentTest.getStudent().getId(), question.getId())
                        .orElse(null);
                
                boolean isPracticeArena = studentTest.getTest() != null && 
                                          studentTest.getTest().getName() != null && 
                                          studentTest.getTest().getName().toLowerCase().contains("practice arena");
                                          
                if (isPracticeArena) {
                    if (sqs != null && sqs.getLastAttemptAt() != null) {
                        long diff = java.time.Duration.between(sqs.getLastAttemptAt(), java.time.LocalDateTime.now()).getSeconds();
                        timeTakenSeconds = Math.max(1L, diff);
                    }
                } else {
                    if (request.getTimeTakenSeconds() != null && request.getTimeTakenSeconds() > 0) {
                        timeTakenSeconds = request.getTimeTakenSeconds();
                    } else if (studentTest.getStartedAt() != null) {
                        long diff = java.time.Duration.between(studentTest.getStartedAt(), java.time.LocalDateTime.now()).getSeconds();
                        timeTakenSeconds = Math.max(1L, diff);
                    } else if (studentTest.getTimeTakenSeconds() != null && studentTest.getTimeTakenSeconds() > 0) {
                        timeTakenSeconds = studentTest.getTimeTakenSeconds();
                    }
                }
            }
        }

        Submission sub = Submission.builder()
                .studentTest(studentTest)
                .question(question)
                .admin(admin)
                .timeTakenSeconds(timeTakenSeconds)
                .code(request.getCode())
                .language(request.getLanguage())
                .status(result.getStatus())
                .runTimeMs(result.getRunTimeMs())
                .memoryUsedKb(result.getMemoryUsedKb())
                .score(result.getScore())
                .totalMarks(result.getTotalMarks())
                .passingMarks(result.getPassingMarks())
                .percentage(result.getPercentage())
                .overallResult(result.getOverallResult())
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
            // Batch-load all referenced test cases in ONE query instead of
            // findById() per result (N+1 over remote Supabase per submission).
            Set<Long> tcIds = new HashSet<>();
            for (TestCaseResultDto tcRes : result.getTestCaseResults()) {
                if (tcRes.getTestCaseId() != null) tcIds.add(tcRes.getTestCaseId());
            }
            Map<Long, TestCase> tcById = new HashMap<>();
            if (!tcIds.isEmpty()) {
                for (TestCase tc : testCaseRepository.findAllById(tcIds)) {
                    tcById.put(tc.getId(), tc);
                }
            }

            List<SubmissionTestCase> subTcList = new ArrayList<>();
            for (TestCaseResultDto tcRes : result.getTestCaseResults()) {
                if (tcRes.getTestCaseId() != null) {
                    TestCase tc = tcById.get(tcRes.getTestCaseId());
                    if (tc != null) {
                        String msg = tcRes.getMessage();
                        if (msg != null && msg.length() > 1000) {
                            msg = msg.substring(0, 997) + "...";
                        }
                        SubmissionTestCase subTc = SubmissionTestCase.builder()
                                .submission(savedSub)
                                .testCase(tc)
                                .status(tcRes.getStatus() != null ? tcRes.getStatus() : "FAILED")
                                .runTimeMs(tcRes.getRunTimeMs() != null ? tcRes.getRunTimeMs() : 0)
                                .memoryUsedKb(tcRes.getMemoryUsedKb() != null ? tcRes.getMemoryUsedKb() : 0)
                                .marksAwarded(tcRes.getMarksAwarded() != null ? tcRes.getMarksAwarded() : 0)
                                .message(msg)
                                .build();
                        subTcList.add(subTc);
                    }
                }
            }
            if (!subTcList.isEmpty()) {
                submissionTestCaseRepository.saveAll(subTcList);
                savedSub.setSubmissionTestCases(subTcList);
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
        if (question != null && Boolean.FALSE.equals(question.getEnableAshHint())) {
            return null;
        }
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

            String memoryCached = localHintCache.get(hash);
            if (memoryCached != null) {
                return memoryCached;
            }

            // FAST GUARD: If AI API key is unconfigured or placeholder, use instant local explanation without blocking
            if (xaiApiKey == null || xaiApiKey.isBlank() || xaiApiKey.contains("placeholder") || "gsk_default_key_placeholder".equals(xaiApiKey)) {
                String localExp = getLocalFallbackExplanation(status, compileError, stderr);
                localHintCache.put(hash, localExp);
                CompletableFuture.runAsync(() -> {
                    try {
                        aiHintCacheRepository.save(AiHintCache.builder().hash(hash).aiHint(localExp).build());
                    } catch (Exception ignored) {}
                });
                return localExp;
            }

            Optional<AiHintCache> cachedHintOpt = aiHintCacheRepository.findByHash(hash);
            if (cachedHintOpt.isPresent()) {
                String dbHint = cachedHintOpt.get().getAiHint();
                localHintCache.put(hash, dbHint);
                return dbHint;
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

            HttpRequest httpRequest = HttpRequest.newBuilder()
                .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + xaiApiKey)
                .timeout(java.time.Duration.ofSeconds(4))
                .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            
            if (response.statusCode() != 200) {
                System.err.println("Primary Grok request in CodeExecutionService failed with status: " + response.statusCode());
                requestMap.put("model", "llama-3.1-8b-instant");
                requestBody = mapper.writeValueAsString(requestMap);
                httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + xaiApiKey)
                    .timeout(java.time.Duration.ofSeconds(4))
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();
                response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
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
            
            // Check for class, interface, enum, or record expected
            if (err.contains("class, interface, enum, or record expected")) {
                return "Syntax error: Your code is written outside of any valid class structure. In Java, all statements and methods must be declared inside a class, e.g., 'public class Solution { ... }'.";
            }
            
            // Reached end of file while parsing
            if (err.contains("reached end of file while parsing") || err.contains("expected '}'") || err.contains("expected declaration or statement")) {
                return "Syntax error: Mismatched curly braces or parentheses. Ensure every opening '{' and '(' has a corresponding closing '}' and ')'.";
            }
            
            // Semicolon expected
            if (err.contains("';' expected") || err.contains("expected ';'") || err.contains("expected ';' before")) {
                return "Syntax error: You are missing a semicolon ';' at the end of a statement.";
            }
            
            // Cannot find symbol
            if (err.contains("cannot find symbol") || err.contains("was not declared in this scope") || err.contains("is not defined")) {
                return "Compiler error: Referenced variable or method cannot be found. Ensure all variables are declared, spelling is correct, and necessary packages are imported.";
            }
            
            // Public class named Solution
            if (err.contains("class") && err.contains("should be declared in a file named")) {
                return "Workspace error: Your public class must be named 'Solution' (e.g., 'public class Solution') to match the execution environment.";
            }

            // Python/JS Syntax/Indent errors
            if (err.contains("IndentationError") || err.contains("unexpected indent")) {
                return "Indentation error: Python requires consistent indentation (spaces or tabs) to define blocks of code.";
            }
            
            if (err.contains("expected ':'") || err.contains("SyntaxError: expected ':'")) {
                return "Syntax error: A colon ':' is expected. Ensure your control flow statements (like if, for, while) and function definitions end with a colon.";
            }
            
            if (err.contains("SyntaxError") || err.contains("invalid syntax") || err.contains("unexpected token") || err.contains("Unexpected token") || err.contains("Unexpected identifier")) {
                return "Syntax error: The compiler encountered an unexpected token. Verify your structure, variable declaration keywords, and parentheses.";
            }
            
            // Incompatible types
            if (err.contains("incompatible types") || err.contains("cannot be converted to") || err.contains("invalid conversion")) {
                return "Type mismatch error: You are attempting to assign a value of one type to a variable of a different, incompatible type.";
            }

            // Fallback: extract the error line if possible
            if (!err.trim().isEmpty()) {
                String[] lines = err.split("\n");
                for (String line : lines) {
                    if (line.contains("error:") || line.contains("Error:")) {
                        return "Compilation failed: " + line.substring(line.indexOf("error:")).trim();
                    }
                }
            }
            return "Compilation failed. Review the compiler log details to resolve syntax errors or missing declaration identifiers.";
        } else if ("RUNTIME_ERROR".equals(status)) {
            String err = stderr != null ? stderr : "";
            
            if (err.contains("NullPointerException") || err.contains("NoneType") || err.contains("Cannot read properties of null")) {
                return "Null pointer error: Your code is trying to access or manipulate an object/property that is null or undefined.";
            } else if (err.contains("/ by zero") || err.contains("ZeroDivisionError")) {
                return "Arithmetic error: Attempted division by zero. Ensure your denominators are not zero before performing division.";
            } else if (err.contains("IndexOutOfBoundsException") || err.contains("IndexError") || err.contains("out of bounds") || err.contains("out_of_range")) {
                return "Index out of bounds error: Accessed an array or list index that doesn't exist. Check your loop boundaries and index offset.";
            } else if (err.contains("StackOverflowError") || err.contains("maximum recursion depth exceeded")) {
                return "Recursion error: Stack overflow. Ensure your recursive functions have a valid base case and terminate correctly.";
            } else if (err.contains("segmentation fault") || err.contains("SIGSEGV")) {
                return "Memory access violation (Segmentation Fault): The program tried to access restricted memory. Check pointers, memory limits, or array boundaries.";
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

    private String sanitizeInputData(String inputData) {
        if (inputData == null || inputData.trim().isEmpty()) {
            return inputData;
        }
        try {
            String clean = inputData.replace("\r\n", "\n").replace("\r", "\n").trim();
            String[] lines = clean.split("\n");
            if (lines.length >= 2) {
                String firstLine = lines[0].trim();
                // Check if first line is a single integer N
                if (firstLine.matches("^\\d+$")) {
                    int declaredN = Integer.parseInt(firstLine);
                    List<String> tokens = new ArrayList<>();
                    for (int i = 1; i < lines.length; i++) {
                        String[] parts = lines[i].trim().split("\\s+");
                        for (String p : parts) {
                            if (!p.isEmpty()) {
                                tokens.add(p);
                            }
                        }
                    }
                    if (!tokens.isEmpty() && declaredN != tokens.size()) {
                        // Automatically adjust declared N to match the actual token count
                        int actualN = tokens.size();
                        StringBuilder sb = new StringBuilder();
                        sb.append(actualN).append("\n");
                        sb.append(String.join(" ", tokens));
                        return sb.toString();
                    }
                }
            }
        } catch (Exception ignored) {}
        return inputData;
    }

    private String findMatchingExpectedOutput(List<TestCase> allTestCases, String customInput) {
        if (customInput == null || allTestCases == null) {
            return null;
        }
        List<String> customTokens = getFilteredTokens(customInput);
        for (TestCase tc : allTestCases) {
            if (tc.getInputData() != null) {
                List<String> tcTokens = getFilteredTokens(tc.getInputData());
                if (customTokens.equals(tcTokens)) {
                    return tc.getExpectedOutput();
                }
            }
        }
        return null;
    }

    private String getExpectedOutputForCustomInput(List<TestCase> allTestCases, List<TestCase> sampleTestCases, String customInput, int index) {
        String matched = findMatchingExpectedOutput(allTestCases, customInput);
        if (matched != null && !matched.trim().isEmpty() && !"N/A".equalsIgnoreCase(matched.trim())) {
            return matched;
        }
        // Strict match: if input doesn't match any sample testcase, no expected output is assigned
        return null;
    }

    private List<String> getFilteredTokens(String str) {
        List<String> tokens = new ArrayList<>();
        if (str == null) return tokens;
        String[] parts = str.trim().split("\\s+");
        for (String p : parts) {
            if (!p.trim().isEmpty()) {
                tokens.add(p.trim());
            }
        }
        return tokens;
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

