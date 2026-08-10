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
import com.chillcode.assessment.dto.BadgeDefinitionDto;
import com.chillcode.assessment.dto.BadgeSetDto;

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

    @Autowired
    @org.springframework.context.annotation.Lazy
    private BadgeSetService badgeSetService;

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
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        if (adminId == null) return java.util.Collections.emptyList();
        
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

        return questionRepository.findByAdminId(adminId).stream()
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

        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        if (adminId == null) return java.util.Collections.emptyList();

        return questionRepository.findBySubjectIdAndAdminId(subjectId, adminId).stream()
                .map(q -> convertToDto(q, statusMap, testCasesMap.getOrDefault(q.getId(), java.util.Collections.emptyList()), solvedSet, latestSubmissionMap))
                .collect(Collectors.toList());
    }

    public QuestionDto getQuestionById(Long id) {
        log.info("Repository Call: Load question by ID: {} from database", id);
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        Question question = questionRepository.findByIdAndAdminId(id, adminId)
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

        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        
        // Idempotency protection to prevent duplicate creations
        if (questionDto.getQuestionCode() != null && !questionDto.getQuestionCode().trim().isEmpty()) {
            java.util.Optional<Question> existingCodeOpt = questionRepository.findByQuestionCodeAndAdminId(questionDto.getQuestionCode().trim().toUpperCase(), adminId);
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
                .admin(com.chillcode.assessment.security.SecurityUtils.getCurrentUser())
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

        ensureTestAndBadgeSetForSubject(subject, savedQuestion, questionDto);
        return convertToDto(savedQuestion);
    }

    @Transactional
    public QuestionDto updateQuestion(Long id, QuestionDto questionDto) {
        log.info("Repository Call: Update question ID: {}", id);
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        Question question = questionRepository.findByIdAndAdminId(id, adminId)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));

        Subject subject = subjectRepository.findById(questionDto.getSubjectId())
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + questionDto.getSubjectId()));

        if (questionDto.getQuestionCode() != null && !questionDto.getQuestionCode().trim().isEmpty()) {
            String newCode = questionDto.getQuestionCode().trim().toUpperCase();
            java.util.Optional<Question> existingCodeOpt = questionRepository.findByQuestionCodeAndAdminId(newCode, adminId);
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

        ensureTestAndBadgeSetForSubject(subject, savedQuestion, questionDto);

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
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        Question question = questionRepository.findByIdAndAdminId(id, adminId)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));

        // 1. Flush & clear Hibernate context to avoid stale entity state
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

        // 3. Clear last_submission_id references in student_question_status for this question's submissions
        entityManager.createNativeQuery(
                "UPDATE student_question_status SET last_submission_id = NULL " +
                "WHERE question_id = :id OR last_submission_id IN (SELECT id FROM submissions WHERE question_id = :id)")
                .setParameter("id", id)
                .executeUpdate();

        // 4. Delete student_question_status for this question
        entityManager.createNativeQuery("DELETE FROM student_question_status WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 5. Delete submission_test_cases for submissions OR test_cases of this question
        entityManager.createNativeQuery(
                "DELETE FROM submission_test_cases WHERE submission_id IN (SELECT id FROM submissions WHERE question_id = :id) " +
                "OR test_case_id IN (SELECT id FROM test_cases WHERE question_id = :id)")
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

        // 8. Clear references in join table test_questions
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE question_id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 9. Delete the question entity
        entityManager.createNativeQuery("DELETE FROM questions WHERE id = :id")
                .setParameter("id", id)
                .executeUpdate();

        // 10. Cascade delete linked empty tests and all their child records
        if (testIdsRaw != null) {
            for (Number tNum : testIdsRaw) {
                Long tId = tNum.longValue();
                Number remainingQuestionsCount = (Number) entityManager.createNativeQuery(
                        "SELECT COUNT(*) FROM test_questions WHERE test_id = :tId")
                        .setParameter("tId", tId)
                        .getSingleResult();

                if (remainingQuestionsCount == null || remainingQuestionsCount.longValue() == 0) {
                    log.info("Cascade purging empty test ID: {} and associated child records", tId);

                    entityManager.createNativeQuery(
                            "UPDATE student_question_status SET last_submission_id = NULL " +
                            "WHERE last_submission_id IN (SELECT id FROM submissions WHERE student_test_id IN (SELECT id FROM student_tests WHERE test_id = :tId))")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery(
                            "DELETE FROM submission_test_cases WHERE submission_id IN (" +
                            "SELECT id FROM submissions WHERE student_test_id IN (SELECT id FROM student_tests WHERE test_id = :tId))")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery(
                            "DELETE FROM submissions WHERE student_test_id IN (SELECT id FROM student_tests WHERE test_id = :tId)")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery(
                            "DELETE FROM warnings WHERE student_test_id IN (SELECT id FROM student_tests WHERE test_id = :tId)")
                            .setParameter("tId", tId)
                            .executeUpdate();

                    entityManager.createNativeQuery("DELETE FROM student_tests WHERE test_id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();

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

                    entityManager.createNativeQuery("DELETE FROM tests WHERE id = :tId")
                            .setParameter("tId", tId)
                            .executeUpdate();
                }
            }
        }

        // 11. Run system-wide orphan cleanup
        try {
            cleanupOrphanedRecordsAndEmptyTests();
        } catch (Exception e) {
            log.warn("Background cleanup deferred: {}", e.getMessage());
        }

        // 12. Flush and clear Persistence Context
        try {
            entityManager.flush();
            entityManager.clear();
        } catch (Exception ignored) {}

        log.info("Question Deleted: Question ID: {} and all associated test cases, submissions, and empty tests successfully removed.", id);
    }

    @Transactional
    public void cleanupOrphanedRecordsAndEmptyTests() {
        log.info("Running complete cleanup of orphaned question statuses, submissions, tests, and achievements...");

        // 1. Clear last_submission_id on student_question_status for orphaned or empty test submissions
        entityManager.createNativeQuery(
                "UPDATE student_question_status SET last_submission_id = NULL WHERE last_submission_id IN (" +
                "SELECT id FROM submissions WHERE question_id NOT IN (SELECT id FROM questions) " +
                "OR student_test_id IN (SELECT id FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))))"
        ).executeUpdate();

        // 2. Delete submission_test_cases for non-existent submissions or questions or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM submission_test_cases WHERE submission_id IN (" +
                "SELECT id FROM submissions WHERE question_id NOT IN (SELECT id FROM questions) " +
                "OR student_test_id IN (SELECT id FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions)))) " +
                "OR test_case_id IN (SELECT id FROM test_cases WHERE question_id NOT IN (SELECT id FROM questions))"
        ).executeUpdate();

        // 3. Delete submissions for non-existent questions or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM submissions WHERE question_id NOT IN (SELECT id FROM questions) " +
                "OR student_test_id IN (SELECT id FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions)))"
        ).executeUpdate();

        // 4. Delete warnings for student_tests of non-existent or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM warnings WHERE student_test_id IN (" +
                "SELECT id FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))" +
                ")"
        ).executeUpdate();

        // 5. Delete student_tests for non-existent or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM student_tests WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 6. Delete student_question_status for non-existent questions
        entityManager.createNativeQuery("DELETE FROM student_question_status WHERE question_id NOT IN (SELECT id FROM questions)")
                .executeUpdate();

        // 7. Delete test_questions join entries for non-existent questions or tests
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE question_id NOT IN (SELECT id FROM questions) OR test_id NOT IN (SELECT id FROM tests)")
                .executeUpdate();

        // 8. Delete test_cases for non-existent questions
        entityManager.createNativeQuery("DELETE FROM test_cases WHERE question_id NOT IN (SELECT id FROM questions)")
                .executeUpdate();

        // 9. Delete student_achievements for non-existent tests or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM student_achievements WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 10. Delete language_master_badges for non-existent tests or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM language_master_badges WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 11. Delete student_badges for non-existent source tests or empty source tests
        entityManager.createNativeQuery(
                "DELETE FROM student_badges WHERE source_test_id IS NOT NULL AND (" +
                "source_test_id NOT IN (SELECT id FROM tests) " +
                "OR source_test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))" +
                ")"
        ).executeUpdate();

        // 12. Delete badge_definitions for non-existent badge sets or badge sets of empty tests
        entityManager.createNativeQuery(
                "DELETE FROM badge_definitions WHERE badge_set_id IN (" +
                "SELECT id FROM badge_sets WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))" +
                ")"
        ).executeUpdate();

        // 13. Delete badge_sets for non-existent tests or empty tests
        entityManager.createNativeQuery(
                "DELETE FROM badge_sets WHERE test_id NOT IN (SELECT id FROM tests) " +
                "OR test_id IN (SELECT id FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions))"
        ).executeUpdate();

        // 14. De-duplicate badge_definitions for duplicate badge sets
        entityManager.createNativeQuery(
                "DELETE FROM badge_definitions WHERE badge_set_id IN (" +
                "SELECT id FROM badge_sets bs1 WHERE bs1.id > (" +
                "SELECT MIN(bs2.id) FROM badge_sets bs2 WHERE bs2.test_id = bs1.test_id" +
                ")" +
                ")"
        ).executeUpdate();

        // 15. De-duplicate badge_sets for the same test_id
        entityManager.createNativeQuery(
                "DELETE FROM badge_sets bs1 WHERE bs1.id > (" +
                "SELECT MIN(bs2.id) FROM badge_sets bs2 WHERE bs2.test_id = bs1.test_id" +
                ")"
        ).executeUpdate();

        // 16. De-duplicate tests with identical names in the same subject that have no questions
        entityManager.createNativeQuery(
                "DELETE FROM tests t1 WHERE t1.id > (" +
                "SELECT MIN(t2.id) FROM tests t2 WHERE LOWER(t2.name) = LOWER(t1.name) AND t2.subject_id = t1.subject_id" +
                ") AND t1.id NOT IN (SELECT DISTINCT test_id FROM test_questions)"
        ).executeUpdate();

        // 17. Delete empty tests (tests with 0 questions)
        entityManager.createNativeQuery(
                "DELETE FROM tests WHERE id NOT IN (SELECT DISTINCT test_id FROM test_questions)"
        ).executeUpdate();

        // 18. Synchronize tests.test_code, badge_sets.test_code, and student_achievements.test_code
        try {
            entityManager.createNativeQuery(
                "UPDATE tests t " +
                "SET test_code = UPPER(TRIM(q.question_code)), name = q.title " +
                "FROM test_questions tq " +
                "JOIN questions q ON tq.question_id = q.id " +
                "WHERE tq.test_id = t.id " +
                "AND q.question_code IS NOT NULL AND TRIM(q.question_code) != ''"
            ).executeUpdate();

            entityManager.createNativeQuery(
                "UPDATE badge_sets bs " +
                "SET test_code = UPPER(TRIM(q.question_code)), name = CONCAT(q.title, ' Badge Set') " +
                "FROM test_questions tq " +
                "JOIN questions q ON tq.question_id = q.id " +
                "WHERE tq.test_id = bs.test_id " +
                "AND q.question_code IS NOT NULL AND TRIM(q.question_code) != ''"
            ).executeUpdate();

            entityManager.createNativeQuery(
                "UPDATE student_achievements sa " +
                "SET test_code = UPPER(TRIM(q.question_code)), test_name = q.title " +
                "FROM test_questions tq " +
                "JOIN questions q ON tq.question_id = q.id " +
                "WHERE tq.test_id = sa.test_id " +
                "AND q.question_code IS NOT NULL AND TRIM(q.question_code) != ''"
            ).executeUpdate();
        } catch (Exception e) {
            log.warn("Error running native test_code sync query: {}", e.getMessage());
        }

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
            boolean isCompleted = hasAcceptedSubmission || "COMPLETED".equals(status.getStatus());
            if ("PENDING_REATTEMPT".equals(status.getStatus())) {
                dto.setStatus("PENDING_REATTEMPT");
            } else {
                dto.setStatus(isCompleted ? "COMPLETED" : status.getStatus());
            }
            int rawAttempts = status.getAttemptCount() != null ? status.getAttemptCount() : 0;
            if (isCompleted) {
                dto.setAttemptCount(Math.max(0, rawAttempts - 1));
            } else {
                dto.setAttemptCount(rawAttempts);
            }
            dto.setLastAttemptAt(status.getLastAttemptAt() != null ? status.getLastAttemptAt().toString() : null);
        } else {
            dto.setStatus(hasAcceptedSubmission ? "COMPLETED" : "NOT_STARTED");
            dto.setAttemptCount(0);
        }
        populateBadgeInfo(question, dto);
        return dto;
    }

    private void populateBadgeInfo(Question question, QuestionDto dto) {
        if (question == null || question.getId() == null) return;
        try {
            com.chillcode.assessment.entity.Test questionTest = findTestForQuestion(question.getId());
            if (questionTest != null) {
                dto.setTestId(questionTest.getId());
                List<com.chillcode.assessment.entity.BadgeSet> badgeSets = badgeSetRepository.findByTestId(questionTest.getId());
                if (badgeSets != null && !badgeSets.isEmpty()) {
                    com.chillcode.assessment.entity.BadgeSet bs = badgeSets.get(0);
                    dto.setBadgeSetId(bs.getId());
                    dto.setEnableBadgeManagement("ACTIVE".equalsIgnoreCase(bs.getStatus()));
                    dto.setBadgeSetName(bs.getName());
                    dto.setBadgeWinnersCount(bs.getNumberOfWinners());
                    dto.setEnableLanguageBadge(bs.getEnableLanguageBadge());
                    dto.setLanguageName(bs.getLanguageName());
                    dto.setLanguageBadgeName(bs.getLanguageBadgeName());
                    dto.setLanguageBadgeIcon(bs.getLanguageBadgeIcon());
                    dto.setLanguageAwardRank(bs.getLanguageAwardRank());

                    List<BadgeDefinitionDto> defDtos = badgeDefinitionRepository.findByBadgeSetIdAndStatus(bs.getId(), "ACTIVE").stream()
                            .sorted(java.util.Comparator.comparingInt(com.chillcode.assessment.entity.BadgeDefinition::getRankPosition))
                            .map(bd -> BadgeDefinitionDto.builder()
                                    .id(bd.getId())
                                    .badgeSetId(bs.getId())
                                    .rankPosition(bd.getRankPosition())
                                    .badgeName(bd.getBadgeName())
                                    .badgeIcon(bd.getBadgeIcon())
                                    .badgeColor(bd.getBadgeColor())
                                    .badgeOrder(bd.getBadgeOrder())
                                    .status(bd.getStatus())
                                    .build())
                            .collect(Collectors.toList());
                    dto.setBadgeDefs(defDtos);
                }
            }
        } catch (Exception e) {
            log.warn("Error populating badge info for question ID {}: {}", question.getId(), e.getMessage());
        }
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
    private com.chillcode.assessment.entity.Test findTestForQuestion(Long questionId) {
        if (questionId != null) {
            try {
                @SuppressWarnings("unchecked")
                List<Number> existingTestIds = (List<Number>) entityManager.createNativeQuery(
                        "SELECT DISTINCT test_id FROM test_questions WHERE question_id = :qId")
                        .setParameter("qId", questionId)
                        .getResultList();
                if (existingTestIds != null && !existingTestIds.isEmpty()) {
                    return testRepository.findById(existingTestIds.get(0).longValue()).orElse(null);
                }
            } catch (Exception ignored) {}
        }
        return null;
    }

    private void ensureTestAndBadgeSetForSubject(Subject subject, Question question) {
        ensureTestAndBadgeSetForSubject(subject, question, null);
    }

    /**
     * Ensures that a Test and BadgeSet exist for the given subject and question,
     * links the question to the test, and updates badge management configuration from DTO.
     */
    private void ensureTestAndBadgeSetForSubject(Subject subject, Question question, QuestionDto dto) {
        String qCode = (question.getQuestionCode() != null && !question.getQuestionCode().trim().isEmpty())
                ? question.getQuestionCode().trim().toUpperCase() : null;

        // 1. Find or create a dedicated Test for THIS specific question
        com.chillcode.assessment.entity.Test questionTest = findTestForQuestion(question.getId());

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
                testCode = prefix + "-" + String.format("%03d", question.getId() != null ? question.getId() : System.currentTimeMillis() % 1000);
            }

            questionTest = com.chillcode.assessment.entity.Test.builder()
                    .name(question.getTitle())
                    .subject(subject)
                    .testCode(testCode)
                    .durationMinutes(question.getTimer() != null ? question.getTimer() : 60)
                    .startTime(java.time.LocalDateTime.now())
                    .endTime(java.time.LocalDateTime.now().plusYears(10))
                    .admin(com.chillcode.assessment.security.SecurityUtils.getCurrentUser())
                    .securityShieldEnabled(true)
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
            for (int i = 1; i < badgeSets.size(); i++) {
                try {
                    badgeSetRepository.delete(badgeSets.get(i));
                } catch (Exception ignored) {}
            }
        } else {
            badgeSet = com.chillcode.assessment.entity.BadgeSet.builder()
                    .test(questionTest)
                    .subject(subject)
                    .admin(questionTest.getAdmin())
                    .build();
        }

        boolean enabled = dto != null && Boolean.TRUE.equals(dto.getEnableBadgeManagement());
        String effectiveTestCode = (qCode != null) ? qCode : questionTest.getTestCode();

        badgeSet.setName((dto != null && dto.getBadgeSetName() != null && !dto.getBadgeSetName().trim().isEmpty())
                ? dto.getBadgeSetName().trim() : question.getTitle() + " Badge Set");
        badgeSet.setTest(questionTest);
        badgeSet.setSubject(subject);
        badgeSet.setTestCode(effectiveTestCode);

        if (dto != null) {
            if (dto.getBadgeWinnersCount() != null) badgeSet.setNumberOfWinners(dto.getBadgeWinnersCount());
            if (dto.getEnableLanguageBadge() != null) badgeSet.setEnableLanguageBadge(dto.getEnableLanguageBadge());
            if (dto.getLanguageName() != null) badgeSet.setLanguageName(dto.getLanguageName());
            if (dto.getLanguageBadgeName() != null) badgeSet.setLanguageBadgeName(dto.getLanguageBadgeName());
            if (dto.getLanguageBadgeIcon() != null) badgeSet.setLanguageBadgeIcon(dto.getLanguageBadgeIcon());
            if (dto.getLanguageAwardRank() != null) badgeSet.setLanguageAwardRank(dto.getLanguageAwardRank());
            if (dto.getEnableBadgeManagement() != null) {
                badgeSet.setStatus(enabled ? "ACTIVE" : "INACTIVE");
            }
        } else if (badgeSet.getStatus() == null) {
            badgeSet.setStatus("ACTIVE");
            badgeSet.setNumberOfWinners(3);
        }

        badgeSet = badgeSetRepository.save(badgeSet);

        // Save custom badge definitions if provided in dto
        if (dto != null && dto.getBadgeDefs() != null && !dto.getBadgeDefs().isEmpty()) {
            List<com.chillcode.assessment.entity.BadgeDefinition> oldDefs = badgeDefinitionRepository.findByBadgeSetIdAndStatus(badgeSet.getId(), "ACTIVE");
            for (com.chillcode.assessment.entity.BadgeDefinition oldDef : oldDefs) {
                try { badgeDefinitionRepository.delete(oldDef); } catch (Exception ignored) {}
            }
            for (BadgeDefinitionDto bDto : dto.getBadgeDefs()) {
                com.chillcode.assessment.entity.BadgeDefinition bd = com.chillcode.assessment.entity.BadgeDefinition.builder()
                        .badgeSet(badgeSet)
                        .rankPosition(bDto.getRankPosition() != null ? bDto.getRankPosition() : 1)
                        .badgeName(bDto.getBadgeName() != null ? bDto.getBadgeName() : "Rank Badge")
                        .badgeIcon(bDto.getBadgeIcon() != null ? bDto.getBadgeIcon() : "Award")
                        .badgeColor(bDto.getBadgeColor() != null ? bDto.getBadgeColor() : "#f59e0b")
                        .badgeOrder(bDto.getBadgeOrder() != null ? bDto.getBadgeOrder() : bDto.getRankPosition())
                        .status("ACTIVE")
                        .build();
                badgeDefinitionRepository.save(bd);
            }
        } else if (badgeDefinitionRepository.findByBadgeSetIdAndStatus(badgeSet.getId(), "ACTIVE").isEmpty()) {
            // Seed defaults if no definitions exist
            String titlePrefix = question.getTitle() != null ? question.getTitle() : subject.getName();
            String[][] defaults = {
                    {"1", "🥇 " + titlePrefix + " Gold Winner", "Award", "#f59e0b"},
                    {"2", "🥈 " + titlePrefix + " Silver Winner", "Award", "#94a3b8"},
                    {"3", "🥉 " + titlePrefix + " Bronze Winner", "Award", "#b45309"}
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
        }

        // Sync student_achievements immediately when question code/title changes
        try {
            entityManager.createNativeQuery(
                "UPDATE student_achievements SET test_code = :qCode, test_name = :title WHERE test_id = :tId")
                .setParameter("qCode", effectiveTestCode)
                .setParameter("title", question.getTitle())
                .setParameter("tId", questionTest.getId())
                .executeUpdate();
        } catch (Exception e) {
            log.warn("Error syncing achievements on question edit: {}", e.getMessage());
        }

        if (enabled) {
            try {
                badgeSetService.allocateBadgesForTest(questionTest.getId());
            } catch (Exception ignored) {}
        }
    }
}
