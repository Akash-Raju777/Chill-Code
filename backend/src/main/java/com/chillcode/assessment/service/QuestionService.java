package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.QuestionDto;
import com.chillcode.assessment.dto.TestCaseDto;
import com.chillcode.assessment.entity.Question;
import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.entity.TestCase;
import com.chillcode.assessment.entity.StudentQuestionStatus;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.entity.Submission;
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
    private com.chillcode.assessment.repository.StudentTestRepository studentTestRepository;

    @Autowired
    private com.chillcode.assessment.repository.BadgeSetRepository badgeSetRepository;

    @Autowired
    private com.chillcode.assessment.repository.BadgeDefinitionRepository badgeDefinitionRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    @org.springframework.transaction.annotation.Transactional
    public void onApplicationReady() {
        log.info("Application started: Running retroactive cleanup for orphaned deleted questions...");
        try {
            cleanupOrphanedRecordsAndEmptyTests();
            log.info("Retroactive cleanup completed successfully.");
        } catch (Exception e) {
            log.error("Failed to run retroactive cleanup: {}", e.getMessage(), e);
        }
    }

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

        // 1. Flush & clear Hibernate context
        try {
            entityManager.flush();
            entityManager.clear();
        } catch (Exception ignored) {}

        // 2. Find all test IDs linked to this question before removing references
        @SuppressWarnings("unchecked")
        List<Number> testIdsRaw = (List<Number>) entityManager.createNativeQuery(
                "SELECT DISTINCT test_id FROM test_questions WHERE question_id = :id")
                .setParameter("id", id)
                .getResultList();

        // 3. Delete student_question_status
        entityManager.createNativeQuery("DELETE FROM student_question_status WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 4. Clear references in join table test_questions
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 5. Delete all submission test cases for submissions associated with this question
        entityManager.createNativeQuery("DELETE FROM submission_test_cases WHERE submission_id IN (SELECT id FROM submissions WHERE question_id = :id)")
                .setParameter("id", id)
                .executeUpdate();

        // 6. Delete all submissions for this question
        entityManager.createNativeQuery("DELETE FROM submissions WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 7. Delete all test cases for this question
        entityManager.createNativeQuery("DELETE FROM test_cases WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 8. Delete the question entity
        entityManager.createNativeQuery("DELETE FROM questions WHERE id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 9. Cascade delete linked empty tests and their badge sets / achievements
        if (testIdsRaw != null) {
            for (Number tNum : testIdsRaw) {
                Long tId = tNum.longValue();
                Number remainingQuestionsCount = (Number) entityManager.createNativeQuery(
                        "SELECT COUNT(*) FROM test_questions WHERE test_id = :tId")
                        .setParameter("tId", tId)
                        .getSingleResult();

                if (remainingQuestionsCount == null || remainingQuestionsCount.longValue() == 0) {
                    log.info("Cascade purging empty test ID: {} and associated badges/achievements", tId);

                    entityManager.createNativeQuery("DELETE FROM student_achievements WHERE test_id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM language_master_badges WHERE test_id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM student_badges WHERE source_test_id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM badge_definitions WHERE badge_set_id IN (SELECT id FROM badge_sets WHERE test_id = :tId)")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM badge_sets WHERE test_id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM warnings WHERE student_test_id IN (SELECT id FROM student_tests WHERE test_id = :tId)")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM student_tests WHERE test_id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM tests WHERE id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();
                }
            }
        }

        // 10. Comprehensive cleanup of any remaining orphaned records system-wide
        cleanupOrphanedRecordsAndEmptyTests();

        // 11. Flush and clear Persistence Context to invalidate cached state
        try {
            entityManager.flush();
            entityManager.clear();
        } catch (Exception ignored) {}

        log.info("Question Deleted: Question ID: {} and all associated badges, achievements, submissions, and empty tests successfully removed.", id);
    }

    @Transactional
    public void cleanupOrphanedRecordsAndEmptyTests() {
        log.info("Running complete cleanup of orphaned question statuses, submissions, tests, and achievements...");

        // 1. Delete student_question_status for non-existent questions
        entityManager.createNativeQuery("DELETE FROM student_question_status WHERE question_id NOT IN (SELECT id FROM questions)")
                .executeUpdate();

        // 2. Delete submission_test_cases for non-existent submissions or non-existent questions
        entityManager.createNativeQuery("DELETE FROM submission_test_cases WHERE submission_id IN (SELECT id FROM submissions WHERE question_id NOT IN (SELECT id FROM questions))")
                .executeUpdate();

        // 3. Delete submissions for non-existent questions
        entityManager.createNativeQuery("DELETE FROM submissions WHERE question_id NOT IN (SELECT id FROM questions)")
                .executeUpdate();

        // 4. Delete test_questions join entries for non-existent questions or tests
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE question_id NOT IN (SELECT id FROM questions) OR test_id NOT IN (SELECT id FROM tests)")
                .executeUpdate();

        // 5. Delete test_cases for non-existent questions
        entityManager.createNativeQuery("DELETE FROM test_cases WHERE question_id NOT IN (SELECT id FROM questions)")
                .executeUpdate();

        // 6. Delete student_achievements for non-existent tests or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM student_achievements WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 7. Delete language_master_badges for non-existent tests or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM language_master_badges WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 8. Delete student_badges for non-existent source tests or empty source tests
        entityManager.createNativeQuery(
                "DELETE FROM student_badges WHERE source_test_id IS NOT NULL AND (" +
                "source_test_id NOT IN (SELECT id FROM tests) " +
                "OR source_test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))" +
                ")"
        ).executeUpdate();

        // 9. Delete badge_definitions for non-existent badge sets or badge sets of empty tests
        entityManager.createNativeQuery(
                "DELETE FROM badge_definitions WHERE badge_set_id IN (" +
                "SELECT id FROM badge_sets WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))" +
                ")"
        ).executeUpdate();

        // 10. Delete badge_sets for non-existent tests or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM badge_sets WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 10b. De-duplicate badge_definitions for duplicate badge sets
        entityManager.createNativeQuery(
                "DELETE FROM badge_definitions WHERE badge_set_id IN (" +
                "SELECT id FROM badge_sets bs1 WHERE bs1.id > (" +
                "SELECT MIN(bs2.id) FROM badge_sets bs2 WHERE bs2.test_id = bs1.test_id" +
                ")" +
                ")"
        ).executeUpdate();

        // 10c. De-duplicate badge_sets for the same test_id
        entityManager.createNativeQuery(
                "DELETE FROM badge_sets bs1 WHERE bs1.id > (" +
                "SELECT MIN(bs2.id) FROM badge_sets bs2 WHERE bs2.test_id = bs1.test_id" +
                ")"
        ).executeUpdate();

        // 10d. De-duplicate tests with identical names in the same subject that have no questions
        entityManager.createNativeQuery(
                "DELETE FROM tests t1 WHERE t1.id > (" +
                "SELECT MIN(t2.id) FROM tests t2 WHERE LOWER(t2.name) = LOWER(t1.name) AND t2.subject_id = t1.subject_id" +
                ") AND t1.id NOT IN (SELECT DISTINCT test_id FROM test_questions)"
        ).executeUpdate();

        // 11. Delete warnings for student_tests of non-existent or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM warnings WHERE student_test_id IN (" +
                "SELECT id FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))" +
                ")"
        ).executeUpdate();

        // 12. Delete student_tests for non-existent or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 13. Delete empty tests (tests with 0 questions)
        entityManager.createNativeQuery(
                "DELETE FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions)"
        ).executeUpdate();

        // Flush and clear L1 session
        try {
            entityManager.flush();
            entityManager.clear();
        } catch (Exception ignored) {}
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

        // 1. Find or create a dedicated Test for THIS specific question
        com.chillcode.assessment.entity.Test questionTest = null;
        try {
            @SuppressWarnings("unchecked")
            List<Number> existingTestIds = (List<Number>) entityManager.createNativeQuery(
                    "SELECT DISTINCT test_id FROM test_questions WHERE question_id = :qId")
                    .setParameter("qId", question.getId())
                    .getResultList();
            if (existingTestIds != null && !existingTestIds.isEmpty()) {
                questionTest = testRepository.findById(existingTestIds.get(0).longValue()).orElse(null);
            }
        } catch (Exception ignored) {}

        // If not linked yet, search for existing test by Title & Subject to prevent duplicate tests
        if (questionTest == null) {
            List<com.chillcode.assessment.entity.Test> matchingTests = testRepository.findBySubjectId(subject.getId()).stream()
                    .filter(t -> t.getName() != null && t.getName().equalsIgnoreCase(question.getTitle()))
                    .collect(Collectors.toList());
            if (!matchingTests.isEmpty()) {
                questionTest = matchingTests.get(0);
            }
        }

        if (questionTest != null) {
            // Sync test properties
            questionTest.setName(question.getTitle());
            questionTest.setSubject(subject);
            if (qCode != null) {
                questionTest.setTestCode(qCode);
            }
            if (!questionTest.getQuestions().contains(question)) {
                questionTest.getQuestions().add(question);
            }
            questionTest = testRepository.save(questionTest);
        } else {
            // Create a new dedicated Test for this question
            String testCode = qCode;
            if (testCode == null) {
                String prefix = subject.getName().replaceAll("[^a-zA-Z]", "").toUpperCase();
                if (prefix.length() > 6) prefix = prefix.substring(0, 6);
                if (prefix.isEmpty()) prefix = "TEST";
                testCode = prefix + "-" + String.format("%03d", question.getId());
            }

            questionTest = com.chillcode.assessment.entity.Test.builder()
                    .name(question.getTitle())
                    .subject(subject)
                    .testCode(testCode)
                    .durationMinutes(question.getTimer() != null ? question.getTimer() : 60)
                    .startTime(java.time.LocalDateTime.now())
                    .endTime(java.time.LocalDateTime.now().plusYears(10))
                    .build();
            questionTest = testRepository.save(questionTest);
            questionTest.getQuestions().add(question);
            questionTest = testRepository.save(questionTest);
            log.info("Auto-created Test ID: {} for question '{}' (code: {})", questionTest.getId(), question.getTitle(), testCode);
        }

        // 2. Find or create single BadgeSet for this test (purge duplicates if any exist)
        List<com.chillcode.assessment.entity.BadgeSet> badgeSets = badgeSetRepository.findByTestId(questionTest.getId());
        com.chillcode.assessment.entity.BadgeSet badgeSet;

        if (badgeSets != null && !badgeSets.isEmpty()) {
            badgeSet = badgeSets.get(0);
            // Delete any duplicate badge sets for this same test ID
            for (int i = 1; i < badgeSets.size(); i++) {
                try {
                    badgeSetRepository.delete(badgeSets.get(i));
                } catch (Exception ignored) {}
            }
            badgeSet.setName(question.getTitle() + " Badge Set");
            badgeSet.setSubject(subject);
            if (qCode != null) {
                badgeSet.setTestCode(qCode);
            }
            badgeSetRepository.save(badgeSet);
        } else {
            badgeSet = com.chillcode.assessment.entity.BadgeSet.builder()
                    .name(question.getTitle() + " Badge Set")
                    .test(questionTest)
                    .subject(subject)
                    .testCode(qCode != null ? qCode : questionTest.getTestCode())
                    .numberOfWinners(3)
                    .status("ACTIVE")
                    .build();
            badgeSet = badgeSetRepository.save(badgeSet);

            // Seed default badge definitions (Gold, Silver, Bronze)
            String titlePrefix = question.getTitle() != null ? question.getTitle() : subject.getName();
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
            log.info("Auto-created BadgeSet ID: {} with 3 default badge definitions for question '{}'", badgeSet.getId(), question.getTitle());
        }
    }
}
