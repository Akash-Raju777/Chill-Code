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
            solved.addAll(submissionRepository.findSolvedQuestionIdsByStudentId(student.getId()));
        } catch (Exception ignored) {}
        return solved;
    }

    public List<QuestionDto> getAllQuestions() {
        log.info("Repository Call: Load all questions from database");
        com.chillcode.assessment.entity.User student = getCurrentUserEntity();
        java.util.Map<Long, StudentQuestionStatus> statusMap = getStatusMapForStudent(student);
        java.util.Set<Long> solvedSet = getSolvedQuestionIdsForStudent(student);
        return questionRepository.findAll().stream()
                .map(q -> convertToDto(q, statusMap, java.util.Collections.emptyList(), solvedSet))
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
        return questionRepository.findBySubjectId(subjectId).stream()
                .map(q -> convertToDto(q, statusMap, testCasesMap.getOrDefault(q.getId(), java.util.Collections.emptyList()), solvedSet))
                .collect(Collectors.toList());
    }

    public QuestionDto getQuestionById(Long id) {
        log.info("Repository Call: Load question by ID: {} from database", id);
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));
        com.chillcode.assessment.entity.User student = getCurrentUserEntity();
        java.util.Map<Long, StudentQuestionStatus> statusMap = getStatusMapForStudent(student);
        return convertToDto(question, statusMap, testCaseRepository.findByQuestionId(question.getId()), getSolvedQuestionIdsForStudent(student));
    }

    @Transactional
    public QuestionDto createQuestion(QuestionDto questionDto) {
        log.info("Repository Call: Save new question under subject ID: {}", questionDto.getSubjectId());
        Subject subject = subjectRepository.findById(questionDto.getSubjectId())
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + questionDto.getSubjectId()));

        // Idempotency protection to prevent duplicate creations
        java.util.Optional<Question> existingOpt = questionRepository.findBySubjectIdAndTitle(subject.getId(), questionDto.getTitle());
        if (existingOpt.isPresent()) {
            log.warn("Idempotency Block: Question with title '{}' already exists under subject ID: {}", questionDto.getTitle(), subject.getId());
            return convertToDto(existingOpt.get());
        }

        Question question = Question.builder()
                .subject(subject)
                .title(questionDto.getTitle())
                .difficulty(questionDto.getDifficulty())
                .problemStatement(questionDto.getProblemStatement())
                .constraints(questionDto.getConstraints())
                .inputFormat(questionDto.getInputFormat())
                .outputFormat(questionDto.getOutputFormat())
                .allowedLanguages(questionDto.getAllowedLanguages())
                .tags(questionDto.getTags())
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
                        .build();
                testCaseRepository.save(testCase);
            }
        }

        // Link uploaded question to existing tests of the same subject automatically and unlink from others
        java.util.List<com.chillcode.assessment.entity.Test> tests = testRepository.findAll();
        for (com.chillcode.assessment.entity.Test test : tests) {
            if (test.getSubject().getId().equals(subject.getId())) {
                test.getQuestions().add(savedQuestion);
            } else {
                test.getQuestions().remove(savedQuestion);
            }
            testRepository.save(test);
        }

        return convertToDto(savedQuestion);
    }

    @Transactional
    public QuestionDto updateQuestion(Long id, QuestionDto questionDto) {
        log.info("Repository Call: Update question ID: {}", id);
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));

        Subject subject = subjectRepository.findById(questionDto.getSubjectId())
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + questionDto.getSubjectId()));

        question.setSubject(subject);
        question.setTitle(questionDto.getTitle());
        question.setDifficulty(questionDto.getDifficulty());
        question.setProblemStatement(questionDto.getProblemStatement());
        question.setConstraints(questionDto.getConstraints());
        question.setInputFormat(questionDto.getInputFormat());
        question.setOutputFormat(questionDto.getOutputFormat());
        question.setAllowedLanguages(questionDto.getAllowedLanguages());
        question.setTags(questionDto.getTags());

        Question savedQuestion = questionRepository.save(question);
        log.info("Question Updated: Question ID: {}, Title: '{}' successfully updated in database", savedQuestion.getId(), savedQuestion.getTitle());

        // Synchronize question links to tests based on subject
        java.util.List<com.chillcode.assessment.entity.Test> tests = testRepository.findAll();
        for (com.chillcode.assessment.entity.Test test : tests) {
            if (test.getSubject().getId().equals(subject.getId())) {
                test.getQuestions().add(savedQuestion);
            } else {
                test.getQuestions().remove(savedQuestion);
            }
            testRepository.save(test);
        }

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
                .allowedLanguages(question.getAllowedLanguages())
                .tags(question.getTags())
                .testCases(tcDtos)
                .build();

        StudentQuestionStatus status = statusMap.get(question.getId());
        boolean hasAcceptedSubmission = solvedQuestionIds != null && solvedQuestionIds.contains(question.getId());

        if (status != null) {
            dto.setStatus(hasAcceptedSubmission ? "COMPLETED" : status.getStatus());
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
                        solved.addAll(submissionRepository.findSolvedQuestionIdsByStudentId(userOpt.get().getId()));
                    }
                }
            }
        } catch (Exception ignored) {}
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
}
