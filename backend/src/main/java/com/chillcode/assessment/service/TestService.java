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

    @Autowired
    private SubmissionRepository submissionRepository;


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
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        if (student.getSuspensionEndTime() != null) {
            if (student.getSuspensionEndTime().isBefore(LocalDateTime.now())) {
                student.setStatus(UserStatus.ACTIVE);
                student.setSuspensionEndTime(null);
                userRepository.save(student);

                StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId).orElse(null);
                if (st != null) {
                    st.setIsSuspended(false);
                    st.setWarningsCount(0);
                    st.setStatus("STARTED");
                    studentTestRepository.save(st);

                    List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
                    if (warnings != null && !warnings.isEmpty()) {
                        warningRepository.deleteAll(warnings);
                    }
                }
            } else {
                throw new RuntimeException("Your attempt on this test has been suspended due to security violations. Please wait until your 30 minutes suspension expires.");
            }
        }

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

        com.chillcode.assessment.dto.StudentTestDto dto = new com.chillcode.assessment.dto.StudentTestDto(
            st.getId(),
            st.getStatus(),
            st.getScore() != null ? st.getScore() : 0,
            st.getWarningsCount() != null ? st.getWarningsCount() : 0,
            st.getIsSuspended() != null ? st.getIsSuspended() : false,
            testDto,
            st.getSubmittedAt(),
            st.getStartedAt(),
            st.getReattemptStatus()
        );
        if (st.getStudent() != null) {
            dto.setStudentRegisterNumber(st.getStudent().getRegisterNumber());
            dto.setStudentName(st.getStudent().getName());
        }
        return dto;
    }

    @Transactional
    public List<com.chillcode.assessment.dto.StudentTestDto> getTestsForStudentDto(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        if (student.getSuspensionEndTime() != null && student.getSuspensionEndTime().isBefore(LocalDateTime.now())) {
            student.setStatus(UserStatus.ACTIVE);
            student.setSuspensionEndTime(null);
            userRepository.save(student);

            List<StudentTest> studentTests = studentTestRepository.findByStudentId(studentId);
            for (StudentTest st : studentTests) {
                if (Boolean.TRUE.equals(st.getIsSuspended()) || "SUSPENDED".equals(st.getStatus())) {
                    st.setIsSuspended(false);
                    st.setWarningsCount(0);
                    st.setStatus("STARTED");
                    studentTestRepository.save(st);

                    List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
                    if (warnings != null && !warnings.isEmpty()) {
                        warningRepository.deleteAll(warnings);
                    }
                }
            }
        }
        
        List<com.chillcode.assessment.entity.Test> allTests = testRepository.findAll();
        for (com.chillcode.assessment.entity.Test test : allTests) {
            if (studentTestRepository.findByStudentIdAndTestId(studentId, test.getId()).isEmpty()) {
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
        }

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

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto requestReattempt(Long testId, Long studentId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        st.setReattemptStatus("PENDING");
        return convertToStudentTestDto(studentTestRepository.save(st));
    }

    @Transactional(readOnly = true)
    public List<com.chillcode.assessment.dto.StudentTestDto> getPendingReattempts() {
        return studentTestRepository.findAll().stream()
                .filter(st -> "PENDING".equals(st.getReattemptStatus()))
                .map(this::convertToStudentTestDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto approveReattempt(Long studentTestId) {
        StudentTest st = studentTestRepository.findById(studentTestId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        
        st.setStatus("ASSIGNED");
        st.setScore(0);
        st.setWarningsCount(0);
        st.setIsSuspended(false);
        st.setStartedAt(null);
        st.setSubmittedAt(null);
        st.setReattemptStatus(null);
        
        List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
        if (warnings != null && !warnings.isEmpty()) {
            warningRepository.deleteAll(warnings);
        }
        
        List<Submission> submissions = submissionRepository.findByStudentTestId(st.getId());
        if (submissions != null && !submissions.isEmpty()) {
            submissionRepository.deleteAll(submissions);
        }

        return convertToStudentTestDto(studentTestRepository.save(st));
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto rejectReattempt(Long studentTestId) {
        StudentTest st = studentTestRepository.findById(studentTestId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        st.setReattemptStatus("REJECTED");
        return convertToStudentTestDto(studentTestRepository.save(st));
    }
}
