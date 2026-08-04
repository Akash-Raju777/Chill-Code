package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.QuestionDto;
import com.chillcode.assessment.dto.TestCaseDto;
import com.chillcode.assessment.entity.Question;
import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.entity.TestCase;
import com.chillcode.assessment.entity.StudentQuestionStatus;
import com.chillcode.assessment.repository.QuestionRepository;
import com.chillcode.assessment.repository.SubjectRepository;
import com.chillcode.assessment.repository.TestCaseRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class QuestionService {

    private static final Logger log = LoggerFactory.getLogger(QuestionService.class);

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private TestCaseRepository testCaseRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubmissionRepository submissionRepository;

    @Autowired
    private com.chillcode.assessment.repository.BadgeSetRepository badgeSetRepository;

    @Autowired
    private com.chillcode.assessment.repository.BadgeDefinitionRepository badgeDefinitionRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    private com.chillcode.assessment.entity.User getCurrentUserEntity() {
        try {
            org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth == null) return null;
            Object principal = auth.getPrincipal();
            if (principal instanceof com.chillcode.assessment.security.CustomUserDetails) {
                return ((com.chillcode.assessment.security.CustomUserDetails) principal).getUser();
            }
            String identifier = auth.getName();
            if (identifier == null || "anonymousUser".equals(identifier)) {
                return null;
            }
            return userRepository.findByIdentifier(identifier).orElse(null);
        } catch (Exception e) {
            log.warn("Failed to fetch current user entity: {}", e.getMessage());
            return null;
        }
    }

    private java.util.Map<Long, StudentQuestionStatus> getStatusMapForStudent(com.chillcode.assessment.entity.User student) {
        if (student == null) return java.util.Collections.emptyMap();
        try {
            if (student.getRole() == com.chillcode.assessment.entity.Role.STUDENT) {
                List<StudentQuestionStatus> statuses = studentQuestionStatusRepository.findByStudentId(student.getId());
                return statuses.stream().collect(Collectors.toMap(StudentQuestionStatus::getQuestionId, s -> s, (s1, s2) -> s1));
            }
        } catch (Exception e) {
            log.warn("Failed to fetch student status map: {}", e.getMessage());
        }
        return java.util.Collections.emptyMap();
    }

    private java.util.Set<Long> getSolvedQuestionIdsForStudent(com.chillcode.assessment.entity.User student) {
        java.util.Set<Long> solved = new java.util.HashSet<>();
        if (student == null) return solved;
        try {
            List<StudentQuestionStatus> completedStatuses = studentQuestionStatusRepository.findByStudentIdAndStatus(student.getId(), "COMPLETED");
            for (StudentQuestionStatus sqs : completedStatuses) {
                solved.add(sqs.getQuestionId());
            }
            List<Long> solvedFromSubmissions = submissionRepository.findSolvedQuestionIdsByStudentId(student.getId());
            if (solvedFromSubmissions != null) {
                solved.addAll(solvedFromSubmissions);
            }
        } catch (Exception e) {
            log.warn("Error fetching solved question IDs: {}", e.getMessage());
        }
        return solved;
    }

    public List<QuestionDto> getAllQuestions() {
        log.info("Repository Call: Load all questions from database");
        com.chillcode.assessment.entity.User student = getCurrentUserEntity();
        java.util.Map<Long, StudentQuestionStatus> statusMap = getStatusMapForStudent(student);
        java.util.Set<Long> solvedSet = getSolvedQuestionIdsForStudent(student);

        java.util.Map<Long, com.chillcode.assessment.entity.Submission> latestSubmissionMap = new java.util.HashMap<>();
        if (student != null) {
            List<com.chillcode.assessment.entity.Submission> allSubs = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(student.getId());
            for (com.chillcode.assessment.entity.Submission sub : allSubs) {
                if (sub.getQuestion() != null) {
                    latestSubmissionMap.putIfAbsent(sub.getQuestion().getId(), sub);
                }
            }
        }

        return questionRepository.findAll().stream()
                .map(q -> convertToDto(q, statusMap, java.util.Collections.emptyList(), solvedSet, latestSubmissionMap))
                .collect(Collectors.toList());
    }

    public List<QuestionDto> getQuestionsBySubject(Long subjectId) {
        log.info("Repository Call: Load questions for subject ID: {} from database", subjectId);
        com.chillcode.assessment.entity.User student = getCurrentUserEntity();
        java.util.Map<Long, StudentQuestionStatus> statusMap = getStatusMapForStudent(student);
        java.util.Set<Long> solvedSet = getSolvedQuestionIdsForStudent(student);
        List<TestCase> subjectTestCases = testCaseRepository.findByQuestionSubjectId(subjectId);
        java.util.Map<Long, List<TestCase>> testCasesMap = subjectTestCases.stream()
                .collect(Collectors.groupingBy(tc -> tc.getQuestion().getId()));

        java.util.Map<Long, com.chillcode.assessment.entity.Submission> latestSubmissionMap = new java.util.HashMap<>();
        if (student != null) {
            List<com.chillcode.assessment.entity.Submission> allSubs = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(student.getId());
            for (com.chillcode.assessment.entity.Submission sub : allSubs) {
                if (sub.getQuestion() != null) {
                    latestSubmissionMap.putIfAbsent(sub.getQuestion().getId(), sub);
                }
            }
        }

        return questionRepository.findBySubjectId(subjectId).stream()
                .map(q -> convertToDto(q, statusMap, testCasesMap.getOrDefault(q.getId(), java.util.Collections.emptyList()), solvedSet, latestSubmissionMap))
                .collect(Collectors.toList());
    }

    public QuestionDto getQuestionById(Long id) {
        log.info("Repository Call: Load question by ID: {} from database", id);
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));
        com.chillcode.assessment.entity.User student = getCurrentUserEntity();
        java.util.Map<Long, StudentQuestionStatus> statusMap = getStatusMapForStudent(student);

        java.util.Map<Long, com.chillcode.assessment.entity.Submission> latestSubmissionMap = new java.util.HashMap<>();
        if (student != null) {
            List<com.chillcode.assessment.entity.Submission> allSubs = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(student.getId());
            for (com.chillcode.assessment.entity.Submission sub : allSubs) {
                if (sub.getQuestion() != null) {
                    latestSubmissionMap.putIfAbsent(sub.getQuestion().getId(), sub);
                }
            }
        }

        return convertToDto(question, statusMap, testCaseRepository.findByQuestionId(question.getId()), getSolvedQuestionIdsForStudent(student), latestSubmissionMap);
    }

    @Transactional
    public QuestionDto createQuestion(QuestionDto questionDto) {
        log.info("Repository Call: Save new question under subject ID: {}", questionDto.getSubjectId());
        Subject subject = subjectRepository.findById(questionDto.getSubjectId())
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + questionDto.getSubjectId()));

        // Idempotency protection to prevent duplicate creations
        if (questionDto.getQuestionCode() != null && !questionDto.getQuestionCode().trim().isEmpty()) {
            java.util.Optional<Question> existingCodeOpt = questionRepository.findByQuestionCode(questionDto.getQuestionCode().trim().toUpperCase());
            if (existingCodeOpt.isPresent()) {
                throw new RuntimeException("Question ID '" + questionDto.getQuestionCode().trim().toUpperCase() + "' already exists. Please choose a unique Question ID.");
            }
        }
        
        java.util.Optional<Question> existingOpt = questionRepository.findBySubjectIdAndTitle(subject.getId(), questionDto.getTitle());
        if (existingOpt.isPresent()) {
            log.warn("Idempotency Block: Question with title '{}' already exists under subject ID: {}", questionDto.getTitle(), subject.getId());
            return convertToDto(existingOpt.get());
        }

        // Module 1 & 2: Calculate total marks from test cases and validate passing marks
        int computedTotalMarks = 0;
        if (questionDto.getTestCases() != null && !questionDto.getTestCases().isEmpty()) {
            for (TestCaseDto tcDto : questionDto.getTestCases()) {
                computedTotalMarks += (tcDto.getMarks() != null ? tcDto.getMarks() : 5);
            }
        } else {
            computedTotalMarks = questionDto.getTotalMarks() != null ? questionDto.getTotalMarks() : 20;
        }

        int passingMarks = questionDto.getPassingMarks() != null ? questionDto.getPassingMarks() : 10;
        if (passingMarks < 0) {
            throw new IllegalArgumentException("Passing Marks cannot be negative.");
        }
        if (passingMarks > computedTotalMarks) {
            throw new IllegalArgumentException("Passing Marks cannot exceed Total Marks.");
        }

        Question question = Question.builder()
                .subject(subject)
                .title(questionDto.getTitle())
                .difficulty(questionDto.getDifficulty())
                .problemStatement(questionDto.getProblemStatement())
                .constraints(questionDto.getConstraints())
                .inputFormat(questionDto.getInputFormat())
                .outputFormat(questionDto.getOutputFormat())
                .questionCode(questionDto.getQuestionCode() != null ? questionDto.getQuestionCode().trim().toUpperCase() : null)
                .timer(questionDto.getTimer())
                .allowedLanguages(questionDto.getAllowedLanguages())
                .tags(questionDto.getTags())
                .totalMarks(computedTotalMarks)
                .passingMarks(passingMarks)
                .negativeMarks(questionDto.getNegativeMarks() != null ? questionDto.getNegativeMarks() : 0.0)
                .partialMarksEnabled(questionDto.getPartialMarksEnabled() != null ? questionDto.getPartialMarksEnabled() : true)
                .build();

        Question savedQuestion = questionRepository.save(question);
        log.info("Question Saved: Question ID: {}, Title: '{}' successfully created in database", savedQuestion.getId(), savedQuestion.getTitle());

        if (questionDto.getTestCases() != null) {
            for (TestCaseDto tcDto : questionDto.getTestCases()) {
                TestCase testCase = TestCase.builder()
                        .question(savedQuestion)
                        .inputData(tcDto.getInputData())
                        .expectedOutput(tcDto.getExpectedOutput())
                        .isHidden(tcDto.getIsHidden())
                        .marks(tcDto.getMarks() != null ? tcDto.getMarks() : 5)
                        .build();
                testCaseRepository.save(testCase);
            }
        }

        ensureTestAndBadgeSetForSubject(subject, savedQuestion);
        return convertToDto(savedQuestion);
    }

    @Transactional
    public QuestionDto updateQuestion(Long id, QuestionDto questionDto) {
        log.info("Repository Call: Update question ID: {}", id);
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));

        Subject subject = subjectRepository.findById(questionDto.getSubjectId())
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + questionDto.getSubjectId()));

        if (questionDto.getQuestionCode() != null && !questionDto.getQuestionCode().trim().isEmpty()) {
            String newCode = questionDto.getQuestionCode().trim().toUpperCase();
            java.util.Optional<Question> existingCodeOpt = questionRepository.findByQuestionCode(newCode);
            if (existingCodeOpt.isPresent() && !existingCodeOpt.get().getId().equals(id)) {
                throw new RuntimeException("Question ID '" + newCode + "' already exists. Please choose a unique Question ID.");
            }
        }

        // Module 1 & 2: Calculate total marks from test cases and validate passing marks
        int computedTotalMarks = 0;
        if (questionDto.getTestCases() != null && !questionDto.getTestCases().isEmpty()) {
            for (TestCaseDto tcDto : questionDto.getTestCases()) {
                computedTotalMarks += (tcDto.getMarks() != null ? tcDto.getMarks() : 5);
            }
        } else {
            computedTotalMarks = questionDto.getTotalMarks() != null ? questionDto.getTotalMarks() : 20;
        }

        int passingMarks = questionDto.getPassingMarks() != null ? questionDto.getPassingMarks() : 10;
        if (passingMarks < 0) {
            throw new IllegalArgumentException("Passing Marks cannot be negative.");
        }
        if (passingMarks > computedTotalMarks) {
            throw new IllegalArgumentException("Passing Marks cannot exceed Total Marks.");
        }

        question.setSubject(subject);
        question.setTitle(questionDto.getTitle());
        question.setDifficulty(questionDto.getDifficulty());
        question.setProblemStatement(questionDto.getProblemStatement());
        question.setConstraints(questionDto.getConstraints());
        question.setInputFormat(questionDto.getInputFormat());
        question.setOutputFormat(questionDto.getOutputFormat());
        question.setQuestionCode(questionDto.getQuestionCode() != null ? questionDto.getQuestionCode().trim().toUpperCase() : null);
        question.setTimer(questionDto.getTimer());
        question.setAllowedLanguages(questionDto.getAllowedLanguages());
        question.setTags(questionDto.getTags());
        question.setTotalMarks(computedTotalMarks);
        question.setPassingMarks(passingMarks);

        Question savedQuestion = questionRepository.save(question);
        log.info("Question Updated: Question ID: {}, Title: '{}' successfully updated in database", savedQuestion.getId(), savedQuestion.getTitle());

        ensureTestAndBadgeSetForSubject(subject, savedQuestion);

        // Update test cases (delete existing and insert new ones for simplicity)
        List<TestCase> existingTestCases = testCaseRepository.findByQuestionId(id);
        // Clear all referencing submission test cases first to prevent foreign key constraint violations
        entityManager.createNativeQuery("DELETE FROM submission_test_cases WHERE test_case_id IN (SELECT id FROM test_cases WHERE question_id = :questionId)")
                .setParameter("questionId", id)
                .executeUpdate();
        testCaseRepository.deleteAll(existingTestCases);

        if (questionDto.getTestCases() != null) {
            for (TestCaseDto tcDto : questionDto.getTestCases()) {
                TestCase testCase = TestCase.builder()
                        .question(savedQuestion)
                        .inputData(tcDto.getInputData())
                        .expectedOutput(tcDto.getExpectedOutput())
                        .isHidden(tcDto.getIsHidden())
                        .marks(tcDto.getMarks() != null ? tcDto.getMarks() : 5)
                        .build();
                testCaseRepository.save(testCase);
            }
        }

        return convertToDto(savedQuestion);
    }

    @Transactional
    public void deleteQuestion(Long id) {
        log.info("Repository Call: Delete question ID: {}", id);
        Question question = questionRepository.findById(id).orElse(null);
        if (question != null) {
            // Remove from Test collections in Hibernate session
            java.util.List<com.chillcode.assessment.entity.Test> tests = testRepository.findAll();
            for (com.chillcode.assessment.entity.Test test : tests) {
                if (test.getQuestions().remove(question)) {
                    testRepository.save(test);
                }
            }
            // Flush and clear Hibernate context to dissociate entities
            entityManager.flush();
            entityManager.clear();
        }

        // Clear references in join table test_questions
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // Delete all submission test cases for submissions associated with this question
        entityManager.createNativeQuery("DELETE FROM submission_test_cases WHERE submission_id IN (SELECT id FROM submissions WHERE question_id = :id)")
                .setParameter("id", id)
                .executeUpdate();

        // Delete all submissions for this question
        entityManager.createNativeQuery("DELETE FROM submissions WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // Delete all test cases for this question
        entityManager.createNativeQuery("DELETE FROM test_cases WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // Finally, delete the question
        entityManager.createNativeQuery("DELETE FROM questions WHERE id = :id")
                .setParameter("id", id)
                .executeUpdate();
        
        log.info("Question Deleted: Question ID: {} successfully removed from database", id);
    }

    private QuestionDto convertToDto(Question question) {
        return convertToDto(question, java.util.Collections.emptyMap(), java.util.Collections.emptyList(), java.util.Collections.emptySet());
    }

    private QuestionDto convertToDto(Question question, java.util.Map<Long, StudentQuestionStatus> statusMap) {
        List<TestCase> testCases = testCaseRepository.findByQuestionId(question.getId());
        return convertToDto(question, statusMap, testCases, getSolvedQuestionIdsForCurrentStudent());
    }

    private QuestionDto convertToDto(Question question, java.util.Map<Long, StudentQuestionStatus> statusMap, List<TestCase> testCases, java.util.Set<Long> solvedQuestionIds) {
        List<TestCaseDto> tcDtos = testCases != null ? testCases.stream()
                .map(tc -> TestCaseDto.builder()
                        .id(tc.getId())
                        .inputData(tc.getInputData())
                        .expectedOutput(tc.getExpectedOutput())
                        .isHidden(tc.getIsHidden())
                        .marks(tc.getMarks() != null ? tc.getMarks() : 5)
                        .build())
                .collect(Collectors.toList()) : java.util.Collections.emptyList();

        QuestionDto dto = QuestionDto.builder()
                .id(question.getId())
                .subjectId(question.getSubject().getId())
                .title(question.getTitle())
                .difficulty(question.getDifficulty())
                .problemStatement(question.getProblemStatement())
                .constraints(question.getConstraints())
                .inputFormat(question.getInputFormat())
                .outputFormat(question.getOutputFormat())
                .questionCode(question.getQuestionCode())
                .timer(question.getTimer())
                .allowedLanguages(question.getAllowedLanguages())
                .tags(question.getTags())
                .totalMarks(question.getTotalMarks() != null ? question.getTotalMarks() : 20)
                .passingMarks(question.getPassingMarks() != null ? question.getPassingMarks() : 10)
                .negativeMarks(question.getNegativeMarks() != null ? question.getNegativeMarks() : 0.0)
                .partialMarksEnabled(question.getPartialMarksEnabled() != null ? question.getPartialMarksEnabled() : true)
                .testCases(tcDtos)
                .build();

        StudentQuestionStatus status = statusMap.get(question.getId());
        boolean hasAcceptedSubmission = solvedQuestionIds != null && solvedQuestionIds.contains(question.getId());

        if (status != null) {
            if ("PENDING_REATTEMPT".equals(status.getStatus())) {
                dto.setStatus("PENDING_REATTEMPT");
            } else {
                dto.setStatus(hasAcceptedSubmission ? "COMPLETED" : status.getStatus());
            }
            dto.setAttemptCount(status.getAttemptCount());
            dto.setLastAttemptAt(status.getLastAttemptAt() != null ? status.getLastAttemptAt().toString() : null);
        } else {
            dto.setStatus(hasAcceptedSubmission ? "COMPLETED" : "NOT_STARTED");
            dto.setAttemptCount(0);
        }
        return dto;
    }

    private java.util.Set<Long> getSolvedQuestionIdsForCurrentStudent() {
        java.util.Set<Long> solved = new java.util.HashSet<>();
        try {
            org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth != null) {
                String identifier = auth.getName();
                if (identifier != null && !"anonymousUser".equals(identifier)) {
                    java.util.Optional<com.chillcode.assessment.entity.User> userOpt = userRepository.findByIdentifier(identifier);
                    if (userOpt.isPresent()) {
                        Long studentId = userOpt.get().getId();
                        List<StudentQuestionStatus> completedStatuses = studentQuestionStatusRepository.findByStudentIdAndStatus(studentId, "COMPLETED");
                        for (StudentQuestionStatus sqs : completedStatuses) {
                            solved.add(sqs.getQuestionId());
                        }
                        List<Long> solvedFromSubmissions = submissionRepository.findSolvedQuestionIdsByStudentId(studentId);
                        if (solvedFromSubmissions != null) {
                            solved.addAll(solvedFromSubmissions);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Error resolving current student solved questions: {}", e.getMessage());
        }
        return solved;
    }

    private java.util.Map<Long, StudentQuestionStatus> getStatusMapForCurrentStudent() {
        try {
            org.springframework.security.core.Authentication auth = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
            if (auth == null) return java.util.Collections.emptyMap();
            String identifier = auth.getName();
            if (identifier == null || "anonymousUser".equals(identifier)) {
                return java.util.Collections.emptyMap();
            }
            java.util.Optional<com.chillcode.assessment.entity.User> userOpt = userRepository.findByIdentifier(identifier);
            if (userOpt.isPresent()) {
                com.chillcode.assessment.entity.User student = userOpt.get();
                if (student.getRole() == com.chillcode.assessment.entity.Role.STUDENT) {
                    List<StudentQuestionStatus> statuses = studentQuestionStatusRepository.findByStudentId(student.getId());
                    return statuses.stream().collect(Collectors.toMap(StudentQuestionStatus::getQuestionId, s -> s, (s1, s2) -> s1));
                }
            }
        } catch (Exception e) {
            log.warn("Failed to fetch student status map: {}", e.getMessage());
        }
        return java.util.Collections.emptyMap();
    }

    private QuestionDto convertToDto(Question question, java.util.Map<Long, StudentQuestionStatus> statusMap, List<TestCase> testCases, java.util.Set<Long> solvedQuestionIds, java.util.Map<Long, com.chillcode.assessment.entity.Submission> latestSubmissionMap) {
        QuestionDto dto = convertToDto(question, statusMap, testCases, solvedQuestionIds);
        if (latestSubmissionMap != null && latestSubmissionMap.containsKey(question.getId())) {
            com.chillcode.assessment.entity.Submission sub = latestSubmissionMap.get(question.getId());
            if (sub != null) {
                dto.setScore(sub.getScore());
                dto.setOverallResult(sub.getOverallResult());
            }
        }
        return dto;
    }

    /**
     * Ensures that a Test and BadgeSet exist for the given subject, links the question to the test,
     * and creates a BadgeSet with default Gold/Silver/Bronze definitions if one doesn't exist.
     * This guarantees that every saved question appears in Question Management AND Badge Management.
     */
    private void ensureTestAndBadgeSetForSubject(Subject subject, Question question) {
        String qCode = (question.getQuestionCode() != null && !question.getQuestionCode().trim().isEmpty())
                ? question.getQuestionCode().trim().toUpperCase() : null;

        // 1. Find or create a Test for this subject
        java.util.List<com.chillcode.assessment.entity.Test> allTests = testRepository.findAll();
        com.chillcode.assessment.entity.Test subjectTest = null;

        for (com.chillcode.assessment.entity.Test test : allTests) {
            if (test.getSubject() != null && test.getSubject().getId().equals(subject.getId())) {
                subjectTest = test;
                // Link question to this test
                if (!test.getQuestions().contains(question)) {
                    test.getQuestions().add(question);
                }
                if (qCode != null) {
                    test.setTestCode(qCode);
                }
                testRepository.save(test);
            } else {
                // Unlink from tests of other subjects
                test.getQuestions().remove(question);
                testRepository.save(test);
            }
        }

        // If no test exists for this subject, create one
        if (subjectTest == null) {
            String prefix = subject.getName().replaceAll("[^a-zA-Z]", "").toUpperCase();
            if (prefix.length() > 6) prefix = prefix.substring(0, 6);
            if (prefix.isEmpty()) prefix = "TEST";

            subjectTest = com.chillcode.assessment.entity.Test.builder()
                    .name(subject.getName() + " Practice Arena")
                    .subject(subject)
                    .testCode(qCode != null ? qCode : prefix + "-001")
                    .build();
            subjectTest = testRepository.save(subjectTest);
            subjectTest.getQuestions().add(question);
            testRepository.save(subjectTest);
            log.info("Auto-created Test ID: {} for subject '{}'", subjectTest.getId(), subject.getName());
        }

        // 2. Find or create a BadgeSet for this test
        java.util.List<com.chillcode.assessment.entity.BadgeSet> badgeSets = badgeSetRepository.findByTestId(subjectTest.getId());
        com.chillcode.assessment.entity.BadgeSet badgeSet;

        if (badgeSets != null && !badgeSets.isEmpty()) {
            badgeSet = badgeSets.get(0);
            if (qCode != null) {
                badgeSet.setTestCode(qCode);
            }
            badgeSetRepository.save(badgeSet);
        } else {
            String testName = subjectTest.getName() != null ? subjectTest.getName() : subject.getName();
            badgeSet = com.chillcode.assessment.entity.BadgeSet.builder()
                    .name(testName + " Champions")
                    .test(subjectTest)
                    .subject(subject)
                    .testCode(qCode != null ? qCode : subjectTest.getTestCode())
                    .numberOfWinners(3)
                    .status("ACTIVE")
                    .build();
            badgeSet = badgeSetRepository.save(badgeSet);

            // Seed default badge definitions (Gold, Silver, Bronze)
            String titlePrefix = question.getTitle() != null ? question.getTitle() : testName;
            String[][] defaults = {
                    {"1", "\uD83E\uDD47 " + titlePrefix + " Gold Winner", "Award", "#f59e0b"},
                    {"2", "\uD83E\uDD48 " + titlePrefix + " Silver Winner", "Award", "#94a3b8"},
                    {"3", "\uD83E\uDD49 " + titlePrefix + " Bronze Winner", "Award", "#b45309"}
            };
            for (String[] def : defaults) {
                com.chillcode.assessment.entity.BadgeDefinition bd = com.chillcode.assessment.entity.BadgeDefinition.builder()
                        .badgeSet(badgeSet)
                        .rankPosition(Integer.parseInt(def[0]))
                        .badgeName(def[1])
                        .badgeIcon(def[2])
                        .badgeColor(def[3])
                        .badgeOrder(Integer.parseInt(def[0]))
                        .status("ACTIVE")
                        .build();
                badgeDefinitionRepository.save(bd);
            }
            log.info("Auto-created BadgeSet ID: {} with 3 default badge definitions for test '{}'", badgeSet.getId(), testName);
        }
    }
}
