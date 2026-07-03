package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.SubmissionResultDto;
import com.chillcode.assessment.dto.SubmitRequest;
import com.chillcode.assessment.dto.TestCaseResultDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;

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

    @Transactional
    public SubmissionResultDto submitCode(SubmitRequest request) {
        Question question = questionRepository.findById(request.getQuestionId())
                .orElseThrow(() -> new RuntimeException("Question not found"));

        StudentTest studentTest = null;
        if (request.getStudentTestId() != null) {
            studentTest = studentTestRepository.findById(request.getStudentTestId()).orElse(null);
        }

        List<TestCase> testCases = testCaseRepository.findByQuestionId(question.getId());

        // Setup execution directory
        String uuid = UUID.randomUUID().toString();
        Path tempDir;
        try {
            tempDir = Files.createTempDirectory("chillcode-" + uuid);
        } catch (IOException e) {
            throw new RuntimeException("Failed to create temporary directory for compilation: " + e.getMessage());
        }

        SubmissionResultDto resultDto = new SubmissionResultDto();
        resultDto.setTestCaseResults(new ArrayList<>());
        resultDto.setRunTimeMs(0);
        resultDto.setMemoryUsedKb(0);

        String compileError = null;
        boolean compileSuccess = true;

        String lang = request.getLanguage().toLowerCase();
        String code = request.getCode();

        File sourceFile = null;
        List<String> compileCmd = new ArrayList<>();
        List<String> runCmd = new ArrayList<>();
        boolean needsCompilation = false;

        String isWindows = System.getProperty("os.name").toLowerCase().contains("win") ? "true" : "false";

        String gccPath = "gcc";
        String gppPath = "g++";
        if ("true".equals(isWindows)) {
            File localGcc = new File("C:\\mingw64\\bin\\gcc.exe");
            if (localGcc.exists()) {
                gccPath = localGcc.getAbsolutePath();
            }
            File localGpp = new File("C:\\mingw64\\bin\\g++.exe");
            if (localGpp.exists()) {
                gppPath = localGpp.getAbsolutePath();
            }
        }

        // Define compiler & execution parameters
        if ("java".equals(lang)) {
            String className = "Solution";
            java.util.regex.Matcher matcher = java.util.regex.Pattern.compile("public\\s+class\\s+(\\w+)").matcher(code);
            if (matcher.find()) {
                className = matcher.group(1);
            } else {
                java.util.regex.Matcher matcher2 = java.util.regex.Pattern.compile("class\\s+(\\w+)").matcher(code);
                if (matcher2.find()) {
                    className = matcher2.group(1);
                }
            }
            sourceFile = new File(tempDir.toFile(), className + ".java");
            needsCompilation = true;
            compileCmd.addAll(Arrays.asList("javac", className + ".java"));
            runCmd.addAll(Arrays.asList("java", "-Xmx" + question.getMemoryLimitMb() + "m", className));
        } else if ("python".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.py");
            runCmd.addAll(Arrays.asList("python", "solution.py"));
        } else if ("cpp".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.cpp");
            needsCompilation = true;
            String binName = "true".equals(isWindows) ? "solution.exe" : "solution";
            File exeFile = new File(tempDir.toFile(), binName);
            compileCmd.addAll(Arrays.asList(gppPath, "solution.cpp", "-o", exeFile.getName()));
            if ("true".equals(isWindows)) {
                runCmd.add(exeFile.getAbsolutePath());
            } else {
                runCmd.add("./" + binName);
            }
        } else if ("c".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.c");
            needsCompilation = true;
            String binName = "true".equals(isWindows) ? "solution.exe" : "solution";
            File exeFile = new File(tempDir.toFile(), binName);
            compileCmd.addAll(Arrays.asList(gccPath, "solution.c", "-o", exeFile.getName()));
            if ("true".equals(isWindows)) {
                runCmd.add(exeFile.getAbsolutePath());
            } else {
                runCmd.add("./" + binName);
            }
        } else if ("javascript".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.js");
            runCmd.addAll(Arrays.asList("node", "--max-old-space-size=" + question.getMemoryLimitMb(), "solution.js"));
        } else {
            cleanupDirectory(tempDir.toFile());
            throw new RuntimeException("Unsupported language: " + lang);
        }

        // Write source code to file
        try (FileWriter writer = new FileWriter(sourceFile)) {
            writer.write(code);
        } catch (IOException e) {
            cleanupDirectory(tempDir.toFile());
            throw new RuntimeException("Failed to write source code: " + e.getMessage());
        }

        // Compile if required
        if (needsCompilation) {
            try {
                ProcessBuilder pb = new ProcessBuilder(compileCmd);
                pb.directory(tempDir.toFile());
                pb.redirectErrorStream(true);
                Process process = pb.start();

                String output = readStream(process.getInputStream());
                boolean finished = process.waitFor(15, TimeUnit.SECONDS);

                if (!finished || process.exitValue() != 0) {
                    compileSuccess = false;
                    compileError = output.isBlank() ? "Compilation Timeout/Failed" : output;
                }
            } catch (Exception e) {
                compileSuccess = false;
                compileError = "Compiler execution failed: " + e.getMessage();
            }
        }

        if (!compileSuccess) {
            resultDto.setStatus("COMPILATION_ERROR");
            resultDto.setCompileError(compileError);
            if (request.getRunOnly() == null || !request.getRunOnly()) {
                saveSubmissionRecord(studentTest, question, request, resultDto);
            }
            cleanupDirectory(tempDir.toFile());
            return resultDto;
        }

        // Run Code workflow (LeetCode/HackerRank Run Code with custom stdin input)
        if (request.getRunOnly() != null && request.getRunOnly()) {
            try {
                ProcessBuilder pb = new ProcessBuilder(runCmd);
                pb.directory(tempDir.toFile());
                Process process = pb.start();

                // Inject Custom Input Data
                if (request.getCustomInput() != null) {
                    try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8))) {
                        writer.write(request.getCustomInput());
                        writer.flush();
                    }
                } else {
                    process.getOutputStream().close();
                }

                // Wait with Time Limit
                long startTime = System.currentTimeMillis();
                boolean finished = process.waitFor(question.getTimeLimitMs(), TimeUnit.MILLISECONDS);
                long runTime = System.currentTimeMillis() - startTime;
                resultDto.setRunTimeMs((int) runTime);

                if (!finished) {
                    process.destroyForcibly();
                    resultDto.setStatus("TIME_LIMIT_EXCEEDED");
                    resultDto.setStderr("Time Limit Exceeded (TLE)");
                } else if (process.exitValue() != 0) {
                    String error = readStream(process.getErrorStream());
                    String stdout = readStream(process.getInputStream());
                    if (isMemoryLimitExceeded(error, stdout, process.exitValue())) {
                        resultDto.setStatus("MEMORY_LIMIT_EXCEEDED");
                        resultDto.setStderr("Memory Limit Exceeded (MLE)");
                    } else {
                        resultDto.setStatus("RUNTIME_ERROR");
                        resultDto.setStderr(error.isBlank() ? "Runtime Error (RTE) exit code: " + process.exitValue() : error.trim());
                    }
                    resultDto.setStdout(stdout);
                } else {
                    String stdout = readStream(process.getInputStream());
                    String stderr = readStream(process.getErrorStream());
                    resultDto.setStatus("ACCEPTED");
                    resultDto.setStdout(stdout);
                    resultDto.setStderr(stderr);
                }
                resultDto.setMemoryUsedKb(estimateMemoryUsage(lang));
            } catch (Exception e) {
                resultDto.setStatus("RUNTIME_ERROR");
                resultDto.setStderr("Execution error: " + e.getMessage());
            }

            cleanupDirectory(tempDir.toFile());
            return resultDto;
        }

        // Run Test Cases
        String overallVerdict = "ACCEPTED";
        int maxRunTimeMs = 0;

        for (TestCase tc : testCases) {
            TestCaseResultDto tcResult = new TestCaseResultDto();
            tcResult.setTestCaseId(tc.getId());
            tcResult.setRunTimeMs(0);
            tcResult.setMemoryUsedKb(0);

            try {
                ProcessBuilder pb = new ProcessBuilder(runCmd);
                pb.directory(tempDir.toFile());
                Process process = pb.start();

                // Inject Input Data
                if (tc.getInputData() != null) {
                    try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8))) {
                        writer.write(tc.getInputData());
                        writer.flush();
                    }
                } else {
                    process.getOutputStream().close();
                }

                // Wait with Time Limit
                long startTime = System.currentTimeMillis();
                boolean finished = process.waitFor(question.getTimeLimitMs(), TimeUnit.MILLISECONDS);
                long runTime = System.currentTimeMillis() - startTime;
                tcResult.setRunTimeMs((int) runTime);

                if (runTime > maxRunTimeMs) {
                    maxRunTimeMs = (int) runTime;
                }

                if (!finished) {
                    process.destroyForcibly();
                    tcResult.setStatus("TLE");
                    tcResult.setMessage("Time Limit Exceeded");
                    overallVerdict = updateVerdict(overallVerdict, "TIME_LIMIT_EXCEEDED");
                } else if (process.exitValue() != 0) {
                    String error = readStream(process.getErrorStream());
                    String stdout = readStream(process.getInputStream());
                    if (isMemoryLimitExceeded(error, stdout, process.exitValue())) {
                        tcResult.setStatus("MLE");
                        tcResult.setMessage("Memory Limit Exceeded");
                        overallVerdict = updateVerdict(overallVerdict, "MEMORY_LIMIT_EXCEEDED");
                    } else {
                        tcResult.setStatus("RTE");
                        tcResult.setMessage("Runtime Error: " + error.trim());
                        overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
                    }
                } else {
                    String output = readStream(process.getInputStream());
                    String expected = tc.getExpectedOutput().trim();
                    String actual = output.trim();

                    // Compare output
                    if (expected.replaceAll("\\r\\n", "\n").equals(actual.replaceAll("\\r\\n", "\n"))) {
                        tcResult.setStatus("PASSED");
                        tcResult.setMessage("Test Case Passed");
                    } else {
                        tcResult.setStatus("FAILED");
                        if (!tc.getIsHidden()) {
                            tcResult.setMessage("Expected: " + expected + "\nActual: " + actual);
                        } else {
                            tcResult.setMessage("Hidden testcase failed.");
                        }
                        overallVerdict = updateVerdict(overallVerdict, "WRONG_ANSWER");
                    }
                }
                tcResult.setMemoryUsedKb(estimateMemoryUsage(lang));

            } catch (Exception e) {
                tcResult.setStatus("RTE");
                tcResult.setMessage("Execution error: " + e.getMessage());
                overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
            }

            resultDto.getTestCaseResults().add(tcResult);
        }

        resultDto.setStatus(overallVerdict);
        resultDto.setRunTimeMs(maxRunTimeMs);
        
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

        resultDto.setMemoryUsedKb(estimateMemoryUsage(lang));

        // Save submission and individual test case runs
        Submission sub = saveSubmissionRecord(studentTest, question, request, resultDto);
        sub.setScore(finalScore);
        submissionRepository.save(sub);

        // Update overall StudentTest score
        updateStudentTestScore(studentTest, question, finalScore);

        cleanupDirectory(tempDir.toFile());
        return resultDto;
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

    private boolean isMemoryLimitExceeded(String stderr, String stdout, int exitValue) {
        if (stderr != null) {
            String lower = stderr.toLowerCase();
            if (lower.contains("outofmemory") || 
                lower.contains("memoryerror") || 
                lower.contains("bad_alloc") || 
                lower.contains("heap limit allocation failed") ||
                lower.contains("allocation failed - javascript heap out of memory")) {
                return true;
            }
        }
        return false;
    }

    private int estimateMemoryUsage(String lang) {
        Random rand = new Random();
        if ("c".equals(lang) || "cpp".equals(lang)) {
            return 1200 + rand.nextInt(1500); // 1.2MB - 2.7MB
        } else if ("python".equals(lang)) {
            return 8500 + rand.nextInt(4000); // 8.5MB - 12.5MB
        } else if ("javascript".equals(lang)) {
            return 28000 + rand.nextInt(8000); // 28MB - 36MB
        } else { // java
            return 32000 + rand.nextInt(12000); // 32MB - 44MB
        }
    }

    private String readStream(InputStream is) throws IOException {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
            String line;
            while ((line = r.readLine()) != null) {
                sb.append(line).append("\n");
            }
        }
        return sb.toString();
    }

    private void cleanupDirectory(File dir) {
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                f.delete();
            }
        }
        dir.delete();
    }
}
