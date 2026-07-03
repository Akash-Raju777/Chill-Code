package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.TestDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class TestService {

    @Autowired
    private TestRepository testRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private WarningRepository warningRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    public List<Test> getAllTests() {
        return testRepository.findAll();
    }

    public List<StudentTest> getTestsForStudent(Long studentId) {
        return studentTestRepository.findByStudentId(studentId);
    }

    public Optional<Test> getTestById(Long id) {
        return testRepository.findById(id);
    }

    @Transactional
    public Test createTest(TestDto dto) {
        Subject subject = subjectRepository.findById(dto.getSubjectId())
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + dto.getSubjectId()));

        Set<Question> questions = new HashSet<>();
        if (dto.getQuestionIds() != null) {
            questions.addAll(questionRepository.findAllById(dto.getQuestionIds()));
        }

        Test test = Test.builder()
                .subject(subject)
                .name(dto.getName())
                .durationMinutes(dto.getDurationMinutes())
                .startTime(dto.getStartTime())
                .endTime(dto.getEndTime())
                .maxMarks(dto.getMaxMarks())
                .instructions(dto.getInstructions())
                .shuffleQuestions(dto.getShuffleQuestions() != null ? dto.getShuffleQuestions() : false)
                .autoSubmit(dto.getAutoSubmit() != null ? dto.getAutoSubmit() : true)
                .negativeMarking(dto.getNegativeMarking() != null ? dto.getNegativeMarking() : false)
                .questions(questions)
                .build();

        Test savedTest = testRepository.save(test);

        // Assign to students
        List<User> studentsToAssign;
        if (dto.getStudentIds() != null && !dto.getStudentIds().isEmpty()) {
            studentsToAssign = userRepository.findAllById(dto.getStudentIds());
        } else {
            // Assign to all students
            studentsToAssign = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == Role.STUDENT)
                    .collect(Collectors.toList());
        }

        for (User student : studentsToAssign) {
            StudentTest st = StudentTest.builder()
                    .student(student)
                    .test(savedTest)
                    .status("ASSIGNED")
                    .score(0)
                    .warningsCount(0)
                    .isSuspended(false)
                    .build();
            studentTestRepository.save(st);

            // Notify Student
            Notification notification = Notification.builder()
                    .user(student)
                    .title("New Test Assigned: " + savedTest.getName())
                    .message("You have been assigned the test '" + savedTest.getName() + "' for subject " + subject.getName() + 
                            ". Scheduled window: " + savedTest.getStartTime() + " to " + savedTest.getEndTime())
                    .type("TEST_ALERT")
                    .isRead(false)
                    .build();
            notificationRepository.save(notification);
        }

        return savedTest;
    }

    @Transactional
    public StudentTest startTest(Long testId, Long studentId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student is not assigned to this test"));

        if ("SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus())) {
            throw new RuntimeException("Test has already been submitted.");
        }

        if (st.getIsSuspended()) {
            throw new RuntimeException("Your attempt on this test has been suspended due to security violations.");
        }

        st.setStatus("STARTED");
        st.setStartedAt(LocalDateTime.now());
        return studentTestRepository.save(st);
    }

    @Transactional
    public StudentTest submitTest(Long testId, Long studentId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student-Test mapping not found."));

        if ("SUBMITTED".equals(st.getStatus())) {
            return st; // already submitted
        }

        st.setStatus("SUBMITTED");
        st.setSubmittedAt(LocalDateTime.now());
        return studentTestRepository.save(st);
    }

    @Transactional
    public StudentTest recordWarning(Long testId, Long studentId, String type, String reason) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student-Test mapping not found."));

        if (!"STARTED".equals(st.getStatus())) {
            throw new RuntimeException("Cannot log warning for a test that is not in progress.");
        }

        Warning warning = Warning.builder()
                .studentTest(st)
                .type(type)
                .reason(reason)
                .build();
        warningRepository.save(warning);

        int warnings = st.getWarningsCount() + 1;
        st.setWarningsCount(warnings);

        if (warnings >= 3) {
            st.setStatus("SUSPENDED");
            st.setIsSuspended(true);
            
            User student = st.getStudent();

            // Log activity log
            Notification alert = Notification.builder()
                    .user(student)
                    .title("Attempt Suspended")
                    .message("Your exam attempt has been suspended due to multiple security violations in test: " + st.getTest().getName())
                    .type("SUSPENSION")
                    .build();
            notificationRepository.save(alert);
        }

        return studentTestRepository.save(st);
    }

    public com.chillcode.assessment.dto.StudentTestDto convertToStudentTestDto(StudentTest st) {
        if (st == null) return null;
        
        Test test = st.getTest();
        com.chillcode.assessment.entity.Subject subject = test != null ? test.getSubject() : null;

        com.chillcode.assessment.dto.StudentTestDto.SubjectDetailsDto subjectDto = null;
        if (subject != null) {
            subjectDto = new com.chillcode.assessment.dto.StudentTestDto.SubjectDetailsDto(
                subject.getId(),
                subject.getName(),
                subject.getColor()
            );
        }

        com.chillcode.assessment.dto.StudentTestDto.TestDetailsDto testDto = null;
        if (test != null) {
            testDto = new com.chillcode.assessment.dto.StudentTestDto.TestDetailsDto(
                test.getId(),
                test.getName(),
                test.getDurationMinutes(),
                test.getStartTime(),
                test.getEndTime(),
                test.getMaxMarks(),
                test.getInstructions(),
                subjectDto
            );
        }

        return new com.chillcode.assessment.dto.StudentTestDto(
            st.getId(),
            st.getStatus(),
            st.getScore() != null ? st.getScore() : 0,
            st.getWarningsCount() != null ? st.getWarningsCount() : 0,
            st.getIsSuspended() != null ? st.getIsSuspended() : false,
            testDto,
            st.getSubmittedAt()
        );
    }

    public List<com.chillcode.assessment.dto.StudentTestDto> getTestsForStudentDto(Long studentId) {
        return studentTestRepository.findByStudentId(studentId).stream()
                .map(this::convertToStudentTestDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto startTestDto(Long testId, Long studentId) {
        StudentTest st = startTest(testId, studentId);
        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId) {
        StudentTest st = submitTest(testId, studentId);
        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto recordWarningDto(Long testId, Long studentId, String type, String reason) {
        StudentTest st = recordWarning(testId, studentId, type, reason);
        return convertToStudentTestDto(st);
    }
}
