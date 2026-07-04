package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.QuestionDto;
import com.chillcode.assessment.dto.TestCaseDto;
import com.chillcode.assessment.entity.Question;
import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.entity.TestCase;
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

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    public List<QuestionDto> getAllQuestions() {
        log.info("Repository Call: Load all questions from database");
        return questionRepository.findAll().stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public List<QuestionDto> getQuestionsBySubject(Long subjectId) {
        log.info("Repository Call: Load questions for subject ID: {} from database", subjectId);
        return questionRepository.findBySubjectId(subjectId).stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    public QuestionDto getQuestionById(Long id) {
        log.info("Repository Call: Load question by ID: {} from database", id);
        Question question = questionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Question not found with id: " + id));
        return convertToDto(question);
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
                .marks(questionDto.getMarks())
                .negativeMarks(questionDto.getNegativeMarks())
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
        question.setMarks(questionDto.getMarks());
        question.setNegativeMarks(questionDto.getNegativeMarks());
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
        List<TestCase> testCases = testCaseRepository.findByQuestionId(question.getId());
        List<TestCaseDto> tcDtos = testCases.stream()
                .map(tc -> TestCaseDto.builder()
                        .id(tc.getId())
                        .inputData(tc.getInputData())
                        .expectedOutput(tc.getExpectedOutput())
                        .isHidden(tc.getIsHidden())
                        .build())
                .collect(Collectors.toList());

        return QuestionDto.builder()
                .id(question.getId())
                .subjectId(question.getSubject().getId())
                .title(question.getTitle())
                .difficulty(question.getDifficulty())
                .problemStatement(question.getProblemStatement())
                .constraints(question.getConstraints())
                .inputFormat(question.getInputFormat())
                .outputFormat(question.getOutputFormat())
                .marks(question.getMarks())
                .negativeMarks(question.getNegativeMarks())
                .allowedLanguages(question.getAllowedLanguages())
                .tags(question.getTags())
                .testCases(tcDtos)
                .build();
    }
}
