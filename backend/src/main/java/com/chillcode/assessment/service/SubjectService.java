package com.chillcode.assessment.service;

import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.repository.SubjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubjectService {

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private com.chillcode.assessment.repository.QuestionRepository questionRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentTestRepository studentTestRepository;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    public List<Subject> getAllSubjects() {
        return subjectRepository.findAll();
    }

    @org.springframework.transaction.annotation.Transactional
    public Subject createSubject(Subject subject) {
        if (subjectRepository.existsByName(subject.getName())) {
            throw new RuntimeException("Subject with name " + subject.getName() + " already exists.");
        }
        Subject savedSubject = subjectRepository.save(subject);

        // Auto-create Practice Arena test for the new subject
        String testName = savedSubject.getName() + " Practice Arena";
        com.chillcode.assessment.entity.Test test = com.chillcode.assessment.entity.Test.builder()
                .subject(savedSubject)
                .name(testName)
                .durationMinutes(120)
                .startTime(java.time.LocalDateTime.now().minusDays(1))
                .endTime(java.time.LocalDateTime.now().plusYears(1))
                .maxMarks(100)
                .instructions("Write your solutions to the practice problems in the arena canvas.")
                .shuffleQuestions(false)
                .autoSubmit(true)
                .negativeMarking(false)
                .questions(new java.util.HashSet<>())
                .build();
        test = testRepository.save(test);

        // Assign test to all existing students
        java.util.List<com.chillcode.assessment.entity.User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                .collect(java.util.stream.Collectors.toList());

        for (com.chillcode.assessment.entity.User student : students) {
            com.chillcode.assessment.entity.StudentTest st = com.chillcode.assessment.entity.StudentTest.builder()
                    .student(student)
                    .test(test)
                    .status("ASSIGNED")
                    .score(0)
                    .warningsCount(0)
                    .isSuspended(false)
                    .build();
            studentTestRepository.save(st);
        }

        return savedSubject;
    }

    public Subject updateSubject(Long id, Subject subjectDetails) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + id));
        subject.setName(subjectDetails.getName());
        subject.setDescription(subjectDetails.getDescription());
        subject.setIcon(subjectDetails.getIcon());
        subject.setColor(subjectDetails.getColor());
        subject.setStatus(subjectDetails.getStatus());
        return subjectRepository.save(subject);
    }

    @Autowired
    private com.chillcode.assessment.repository.TestCaseRepository testCaseRepository;

    @Autowired
    private com.chillcode.assessment.repository.WarningRepository warningRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubmissionRepository submissionRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @org.springframework.transaction.annotation.Transactional
    public void deleteSubject(Long id) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + id));

        // 1. Delete submission test cases for submissions of student tests belonging to tests in this subject
        entityManager.createQuery("DELETE FROM SubmissionTestCase stc WHERE stc.submission.id IN (SELECT s.id FROM Submission s WHERE s.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.test.subject.id = :subId))")
                .setParameter("subId", id)
                .executeUpdate();

        // 2. Delete submission test cases for submissions associated directly with questions of this subject
        entityManager.createQuery("DELETE FROM SubmissionTestCase stc WHERE stc.submission.id IN (SELECT s.id FROM Submission s WHERE s.question.id IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId))")
                .setParameter("subId", id)
                .executeUpdate();

        // 3. Delete warning logs for student tests belonging to tests in this subject
        entityManager.createQuery("DELETE FROM Warning w WHERE w.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.test.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 4. Delete submissions for student tests belonging to tests in this subject
        entityManager.createQuery("DELETE FROM Submission s WHERE s.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.test.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 5. Delete submissions associated directly with questions of this subject
        entityManager.createQuery("DELETE FROM Submission s WHERE s.question.id IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 6. Delete all student tests associated with tests of this subject
        entityManager.createQuery("DELETE FROM StudentTest st WHERE st.test.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 7. Delete all test cases for questions of this subject
        entityManager.createQuery("DELETE FROM TestCase tc WHERE tc.question.id IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 8. Delete all student question status entries for questions of this subject
        entityManager.createQuery("DELETE FROM StudentQuestionStatus sqs WHERE sqs.questionId IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 9. Clear test_questions join table natively
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE test_id IN (SELECT id FROM tests WHERE subject_id = ?)")
                .setParameter(1, id)
                .executeUpdate();

        // 10. Delete tests belonging to this subject
        entityManager.createQuery("DELETE FROM Test t WHERE t.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 11. Delete questions belonging to this subject
        entityManager.createQuery("DELETE FROM Question q WHERE q.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 12. Delete subject itself
        entityManager.createQuery("DELETE FROM Subject s WHERE s.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();
    }

    public com.chillcode.assessment.dto.SubjectStatsDto getSubjectStats(Long subjectId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + subjectId));

        java.util.List<com.chillcode.assessment.entity.Question> questions = questionRepository.findBySubjectId(subjectId);
        long questionsCount = questions.size();

        java.util.List<com.chillcode.assessment.entity.Test> tests = testRepository.findBySubjectId(subjectId);

        int totalScore = 0;
        int studentTestCount = 0;
        int passedCount = 0;
        double rankScore = 0.0;
        String rankHolder = "N/A";
        long attendedCount = 0;
        long notAttendedCount = 0;
        java.util.List<com.chillcode.assessment.dto.SubjectStatsDto.StudentMarkDto> studentMarks = new java.util.ArrayList<>();

        for (com.chillcode.assessment.entity.Test test : tests) {
            java.util.List<com.chillcode.assessment.entity.StudentTest> studentTests = studentTestRepository.findByTestId(test.getId());
            for (com.chillcode.assessment.entity.StudentTest st : studentTests) {
                com.chillcode.assessment.entity.User student = st.getStudent();
                String studentName = student != null ? student.getName() : "Unknown";
                String registerNum = student != null ? (student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername()) : "Unknown";
                int score = st.getScore() != null ? st.getScore() : 0;
                int maxMarks = test.getMaxMarks() != null ? test.getMaxMarks() : 100;

                String status = "ABSENT";
                if ("SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()) || "PENDING".equals(st.getStatus())) {
                    attendedCount++;
                    status = (score >= maxMarks * 0.4) ? "PASSED" : "FAILED";
                    if (score > rankScore) {
                        rankScore = score;
                        rankHolder = studentName;
                    }
                    totalScore += score;
                    studentTestCount++;
                    if ("PASSED".equals(status)) {
                        passedCount++;
                    }
                } else {
                    notAttendedCount++;
                }

                studentMarks.add(new com.chillcode.assessment.dto.SubjectStatsDto.StudentMarkDto(studentName, registerNum, score, maxMarks, status));
            }
        }

        if (studentMarks.isEmpty()) {
            java.util.List<com.chillcode.assessment.entity.User> students = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                    .collect(java.util.stream.Collectors.toList());
            for (com.chillcode.assessment.entity.User s : students) {
                studentMarks.add(new com.chillcode.assessment.dto.SubjectStatsDto.StudentMarkDto(s.getName(), s.getRegisterNumber() != null ? s.getRegisterNumber() : s.getUsername(), 0, 100, "ABSENT"));
                notAttendedCount++;
            }
        }

        double avgScore = studentTestCount > 0 ? (double) totalScore / studentTestCount : 0.0;
        double passRate = studentTestCount > 0 ? (double) passedCount / studentTestCount * 100 : 0.0;
        double failRate = studentTestCount > 0 ? 100.0 - passRate : 0.0;

        return new com.chillcode.assessment.dto.SubjectStatsDto(
                questionsCount,
                Math.round(avgScore * 10.0) / 10.0,
                Math.round(passRate * 10.0) / 10.0,
                Math.round(failRate * 10.0) / 10.0,
                rankHolder,
                rankScore,
                attendedCount,
                notAttendedCount,
                studentMarks
        );
    }
}
