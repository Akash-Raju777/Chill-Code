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

        StudentTest studentTest = studentTestRepository.findById(request.getStudentTestId())
                .orElseThrow(() -> new RuntimeException("Student test session not found"));

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

        // Define compiler & execution parameters
        if ("java".equals(lang)) {
            // Assume Class name is Solution
            sourceFile = new File(tempDir.toFile(), "Solution.java");
            needsCompilation = true;
            compileCmd.addAll(Arrays.asList("javac", "Solution.java"));
            runCmd.addAll(Arrays.asList("java", "Solution"));
        } else if ("python".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.py");
            runCmd.addAll(Arrays.asList("python", "solution.py"));
        } else if ("cpp".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.cpp");
            needsCompilation = true;
            String binName = "true".equals(isWindows) ? "solution.exe" : "./solution";
            compileCmd.addAll(Arrays.asList("g++", "solution.cpp", "-o", binName));
            runCmd.add(binName);
        } else if ("c".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.c");
            needsCompilation = true;
            String binName = "true".equals(isWindows) ? "solution.exe" : "./solution";
            compileCmd.addAll(Arrays.asList("gcc", "solution.c", "-o", binName));
            runCmd.add(binName);
        } else if ("javascript".equals(lang)) {
            sourceFile = new File(tempDir.toFile(), "solution.js");
            runCmd.addAll(Arrays.asList("node", "solution.js"));
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
            saveSubmissionRecord(studentTest, question, request, resultDto);
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
                try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(process.getOutputStream(), StandardCharsets.UTF_8))) {
                    writer.write(tc.getInputData());
                    writer.flush();
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
                    tcResult.setStatus("RTE");
                    tcResult.setMessage("Runtime Error: " + error.trim());
                    overallVerdict = updateVerdict(overallVerdict, "RUNTIME_ERROR");
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

        resultDto.setMemoryUsedKb(12800); // Standard base mock memory usage

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
        if ("RUNTIME_ERROR".equals(current) || "RUNTIME_ERROR".equals(challenger)) {
            return "RUNTIME_ERROR";
        }
        if ("WRONG_ANSWER".equals(current) || "WRONG_ANSWER".equals(challenger)) {
            return "WRONG_ANSWER";
        }
        return challenger;
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
