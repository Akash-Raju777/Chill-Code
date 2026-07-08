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

    @Autowired
    private StudentQuestionStatusRepository studentQuestionStatusRepository;


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
                .securityShieldEnabled(dto.getSecurityShieldEnabled() != null ? dto.getSecurityShieldEnabled() : false)
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
                if (student.getStatus() != UserStatus.INACTIVE && student.getStatus() != UserStatus.NO_SECURITY) {
                    student.setStatus(UserStatus.ACTIVE);
                }
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

        if ("COMPLETED".equals(st.getStatus())) {
            throw new RuntimeException("Test has already been completed and passed.");
        }

        if ("SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus())) {
            if (st.getTest().getName().toLowerCase().contains("practice arena") || Boolean.FALSE.equals(st.getTest().getSecurityShieldEnabled())) {
                st.setStatus("STARTED");
                st.setStartedAt(LocalDateTime.now());
                return studentTestRepository.save(st);
            }
            throw new RuntimeException("Test has already been submitted.");
        }

        if (st.getIsSuspended()) {
            // For practice arenas or tests without security shield, auto-clear suspension
            // so students can attempt other questions (suspension was for the previous question session only)
            boolean isPracticeArena = st.getTest().getName() != null && st.getTest().getName().toLowerCase().contains("practice arena");
            boolean hasSecurityShield = Boolean.TRUE.equals(st.getTest().getSecurityShieldEnabled());
            if (isPracticeArena || !hasSecurityShield) {
                st.setIsSuspended(false);
                st.setWarningsCount(0);
                st.setStatus("STARTED");
                st.setStartedAt(LocalDateTime.now());
                return studentTestRepository.save(st);
            }
            throw new RuntimeException("Your attempt on this test has been suspended due to security violations.");
        }

        // If re-attempting a failed test (PENDING), clear previous attempt's submissions and score
        if ("PENDING".equals(st.getStatus())) {
            List<Submission> submissions = submissionRepository.findByStudentTestId(st.getId());
            if (submissions != null && !submissions.isEmpty()) {
                submissionRepository.deleteAll(submissions);
            }
            st.setScore(0);
        }

        st.setStatus("STARTED");
        st.setStartedAt(LocalDateTime.now());
        return studentTestRepository.save(st);
    }

    @Transactional
    public StudentTest submitTest(Long testId, Long studentId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student-Test mapping not found."));

        if ("COMPLETED".equals(st.getStatus())) {
            return st; // already completed & passed
        }

        int score = st.getScore() != null ? st.getScore() : 0;
        int maxMarks = st.getTest().getMaxMarks() != null ? st.getTest().getMaxMarks() : 100;

        if (score >= (maxMarks / 2)) {
            st.setStatus("COMPLETED");
        } else {
            st.setStatus("PENDING");
            st.setWarningsCount(0);
            st.setIsSuspended(false);
        }

        st.setSubmittedAt(LocalDateTime.now());
        return studentTestRepository.save(st);
    }

    @Transactional
    public StudentTest recordWarning(Long testId, Long studentId, String type, String reason, Long questionId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student-Test mapping not found."));

        if (Boolean.FALSE.equals(st.getTest().getSecurityShieldEnabled())) {
            return st; // Ignore warnings and suspension if security shield is disabled
        }

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
            
            // Mark specific question status as SUSPENDED
            if (questionId != null) {
                studentQuestionStatusRepository.findByStudentIdAndQuestionId(studentId, questionId)
                        .ifPresent(sqs -> {
                            sqs.setStatus("SUSPENDED");
                            studentQuestionStatusRepository.save(sqs);
                        });
            }
            
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
                test.getSecurityShieldEnabled() != null ? test.getSecurityShieldEnabled() : false,
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

        String displayTitle = test != null ? test.getName() : "";
        if (test != null && test.getName().toLowerCase().contains("practice arena") && test.getSubject() != null && st.getStudent() != null) {
            List<Question> questions = questionRepository.findBySubjectId(test.getSubject().getId());
            if (questions != null && !questions.isEmpty()) {
                java.util.Set<String> titles = new java.util.LinkedHashSet<>();
                for (Question question : questions) {
                    StudentQuestionStatus sqs = studentQuestionStatusRepository
                            .findByStudentIdAndQuestionId(st.getStudent().getId(), question.getId())
                            .orElse(null);
                    String qStatus = (sqs != null && "COMPLETED".equals(sqs.getStatus())) ? "PASS" : "FAIL";
                    titles.add(question.getTitle() + "|" + qStatus);
                }
                if (!titles.isEmpty()) {
                    displayTitle = String.join(", ", titles);
                }
            }
        }
        dto.setDisplayTitle(displayTitle);
        if (st.getStudent() != null) {
            dto.setStudentRegisterNumber(st.getStudent().getRegisterNumber());
            dto.setStudentName(st.getStudent().getName());
        }
        
        String rStatus = st.getReattemptStatus();
        if (rStatus != null && rStatus.contains(":")) {
            String[] parts = rStatus.split(":");
            if (parts.length == 2) {
                dto.setReattemptStatus(parts[0]);
                try {
                    Long qId = Long.parseLong(parts[1]);
                    dto.setReattemptQuestionId(qId);
                    questionRepository.findById(qId).ifPresent(q -> dto.setReattemptQuestionTitle(q.getTitle()));
                } catch (Exception ignored) {}
            }
        }
        return dto;
    }

    @Transactional
    public List<com.chillcode.assessment.dto.StudentTestDto> getTestsForStudentDto(Long studentId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        if (student.getSuspensionEndTime() != null && student.getSuspensionEndTime().isBefore(LocalDateTime.now())) {
            if (student.getStatus() != UserStatus.INACTIVE && student.getStatus() != UserStatus.NO_SECURITY) {
                student.setStatus(UserStatus.ACTIVE);
            }
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

        // Auto-unsuspend practice tests / tests with security shield disabled
        List<StudentTest> studentTests = studentTestRepository.findByStudentId(studentId);
        for (StudentTest st : studentTests) {
            if (Boolean.FALSE.equals(st.getTest().getSecurityShieldEnabled())) {
                if (Boolean.TRUE.equals(st.getIsSuspended()) || "SUSPENDED".equals(st.getStatus())) {
                    st.setIsSuspended(false);
                    st.setWarningsCount(0);
                    if ("SUSPENDED".equals(st.getStatus())) {
                        st.setStatus("STARTED");
                    }
                    studentTestRepository.save(st);

                    List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
                    if (warnings != null && !warnings.isEmpty()) {
                        warningRepository.deleteAll(warnings);
                    }
                }
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
        return submitTestDto(testId, studentId, null);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId, java.util.Map<String, java.util.Map<String, String>> questionCodes) {
        StudentTest st = submitTest(testId, studentId);

        // Save final draft codes as submissions
        if (questionCodes != null) {
            for (java.util.Map.Entry<String, java.util.Map<String, String>> entry : questionCodes.entrySet()) {
                try {
                    Long questionId = Long.parseLong(entry.getKey());
                    java.util.Map<String, String> details = entry.getValue();
                    String code = details.get("code");
                    String language = details.get("language");
                    
                    if (code != null && !code.trim().isEmpty()) {
                        Question question = questionRepository.findById(questionId).orElse(null);
                        if (question != null) {
                            List<Submission> existing = submissionRepository.findByStudentTestIdAndQuestionId(st.getId(), questionId);
                            boolean isDuplicate = false;
                            if (existing != null && !existing.isEmpty()) {
                                existing.sort((a, b) -> b.getId().compareTo(a.getId()));
                                if (code.equals(existing.get(0).getCode())) {
                                    isDuplicate = true;
                                }
                            }
                            
                            if (!isDuplicate) {
                                Submission sub = Submission.builder()
                                        .studentTest(st)
                                        .question(question)
                                        .code(code)
                                        .language(language != null ? language : "java")
                                        .status("PENDING")
                                        .runTimeMs(0)
                                        .memoryUsedKb(0)
                                        .score(0)
                                        .build();
                                submissionRepository.save(sub);

                                StudentQuestionStatus statusObj = studentQuestionStatusRepository
                                        .findByStudentIdAndQuestionId(studentId, question.getId())
                                        .orElse(null);
                                if (statusObj == null) {
                                    statusObj = StudentQuestionStatus.builder()
                                            .studentId(studentId)
                                            .questionId(question.getId())
                                            .status("IN_PROGRESS")
                                            .attemptCount(1)
                                            .lastAttemptAt(LocalDateTime.now())
                                            .lastSubmissionId(sub.getId())
                                            .build();
                                } else {
                                    statusObj.setAttemptCount(statusObj.getAttemptCount() + 1);
                                    statusObj.setLastAttemptAt(LocalDateTime.now());
                                    statusObj.setLastSubmissionId(sub.getId());
                                }
                                studentQuestionStatusRepository.save(statusObj);
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Error saving draft submission: " + e.getMessage());
                }
            }
        }

        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto recordWarningDto(Long testId, Long studentId, String type, String reason, Long questionId) {
        StudentTest st = recordWarning(testId, studentId, type, reason, questionId);
        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto requestReattempt(Long testId, Long studentId, Long questionId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        st.setReattemptStatus("PENDING:" + questionId);
        return convertToStudentTestDto(studentTestRepository.save(st));
    }

    @Transactional(readOnly = true)
    public List<com.chillcode.assessment.dto.StudentTestDto> getPendingReattempts() {
        return studentTestRepository.findAll().stream()
                .filter(st -> st.getReattemptStatus() != null && st.getReattemptStatus().startsWith("PENDING:"))
                .map(this::convertToStudentTestDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto approveReattempt(Long studentTestId) {
        StudentTest st = studentTestRepository.findById(studentTestId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        
        Long questionId = null;
        String rStatus = st.getReattemptStatus();
        if (rStatus != null && rStatus.contains(":")) {
            String[] parts = rStatus.split(":");
            if (parts.length == 2) {
                try {
                    questionId = Long.parseLong(parts[1]);
                } catch (Exception ignored) {}
            }
        }

        st.setStatus("STARTED");
        st.setIsSuspended(false);
        st.setReattemptStatus(null);
        st.setWarningsCount(0);
        st.setStartedAt(LocalDateTime.now());
        st.setSubmittedAt(null);
        
        List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
        if (warnings != null && !warnings.isEmpty()) {
            warningRepository.deleteAll(warnings);
        }
        
        if (questionId != null) {
            List<Submission> submissions = submissionRepository.findByStudentTestId(st.getId());
            if (submissions != null && !submissions.isEmpty()) {
                final Long targetQId = questionId;
                List<Submission> toDelete = submissions.stream()
                        .filter(sub -> sub.getQuestion().getId().equals(targetQId))
                        .collect(Collectors.toList());
                submissionRepository.deleteAll(toDelete);
            }
            
            // Reset question completion status
            StudentQuestionStatus sqs = studentQuestionStatusRepository
                    .findByStudentIdAndQuestionId(st.getStudent().getId(), questionId)
                    .orElse(null);
            if (sqs != null) {
                sqs.setStatus("NOT_STARTED");
                sqs.setCompletedAt(null);
                studentQuestionStatusRepository.save(sqs);
            }
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
