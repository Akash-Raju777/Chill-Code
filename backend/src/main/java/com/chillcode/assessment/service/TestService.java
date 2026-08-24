package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.TestDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
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

    @Autowired
    private StudentQuestionStatusService studentQuestionStatusService;

    @Autowired
    private CodeExecutionService codeExecutionService;

    @Autowired
    private RankingService rankingService;

    @Autowired
    private BadgeService badgeService;

    @Autowired
    private BadgeSetService badgeSetService;


    @Transactional
    public List<Test> getAllTests() {
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        if (adminId == null) return java.util.Collections.emptyList();
        List<Test> tests = testRepository.findByAdminId(adminId);
        for (Test t : tests) {
            String foundQCode = null;
            if (t.getQuestions() != null) {
                for (Question q : t.getQuestions()) {
                    if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty() && !q.getQuestionCode().trim().startsWith("TEST-")) {
                        foundQCode = q.getQuestionCode().trim().toUpperCase();
                        break;
                    }
                }
            }
            if (foundQCode != null) {
                if (!foundQCode.equals(t.getTestCode())) {
                    t.setTestCode(foundQCode);
                    testRepository.save(t);
                }
            } else if (t.getTestCode() == null || t.getTestCode().trim().isEmpty() || t.getTestCode().startsWith("TEST-")) {
                String prefix = (t.getSubject() != null && t.getSubject().getName() != null) ? 
                        t.getSubject().getName().replaceAll("[^a-zA-Z]", "").toUpperCase() : "TEST";
                if (prefix.length() > 6) prefix = prefix.substring(0, 6);
                t.setTestCode(prefix + "-" + String.format("%03d", t.getId()));
                testRepository.save(t);
            }
        }
        return tests;
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

        // Validate unique testCode if provided
        if (dto.getTestCode() != null && !dto.getTestCode().trim().isEmpty()) {
            String normalizedCode = dto.getTestCode().trim().toUpperCase();
            if (testRepository.findByTestCodeAndAdminId(normalizedCode, com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId()).isPresent()) {
                throw new RuntimeException("Test ID '" + normalizedCode + "' already exists. Please choose a unique Test ID.");
            }
        }

        Test test = Test.builder()
                .admin(com.chillcode.assessment.security.SecurityUtils.getCurrentUser())
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

        // Set provided testCode (will be normalized)
        if (dto.getTestCode() != null && !dto.getTestCode().trim().isEmpty()) {
            test.setTestCode(dto.getTestCode().trim().toUpperCase());
        }

        Test savedTest = testRepository.save(test);

        if (savedTest.getTestCode() == null || savedTest.getTestCode().trim().isEmpty()) {
            String prefix = subject.getName() != null ? subject.getName().replaceAll("[^a-zA-Z]", "").toUpperCase() : "TEST";
            if (prefix.length() > 6) prefix = prefix.substring(0, 6);
            savedTest.setTestCode(prefix + "-" + String.format("%03d", savedTest.getId()));
            savedTest = testRepository.save(savedTest);
        }

        // Assign to students
        List<User> studentsToAssign;
        if (dto.getStudentIds() != null && !dto.getStudentIds().isEmpty()) {
            studentsToAssign = userRepository.findAllById(dto.getStudentIds());
        } else {
            // Assign to all students of the current admin
            Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
            studentsToAssign = userRepository.findByRoleAndAdminId(Role.STUDENT, adminId);
        }

        for (User student : studentsToAssign) {
            StudentTest st = StudentTest.builder()
                    .student(student)
                    .test(savedTest)
                    .status("ASSIGNED")
                    .score(0)
                    .warningsCount(0)
                    .isSuspended(false)
                    .admin(savedTest.getAdmin() != null ? savedTest.getAdmin() : (student.getAdmin() != null ? student.getAdmin() : com.chillcode.assessment.security.SecurityUtils.getCurrentUser()))
                    .build();
            studentTestRepository.save(st);

            // Notify Student
            Notification notification = Notification.builder()
                    .user(student)
                    .admin(savedTest.getAdmin())
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
    public StudentTest startTest(Long testId, Long studentId, Long questionId) {
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

        boolean isPracticeArena = st.getTest().getName() != null && 
                (st.getTest().getName().toLowerCase().contains("practice") || st.getTest().getName().toLowerCase().contains("arena"));
        boolean hasSecurityShield = Boolean.TRUE.equals(st.getTest().getSecurityShieldEnabled());

        if ("SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus())) {
            if (isPracticeArena || !hasSecurityShield) {
                st.setStatus("STARTED");
                st.setStartedAt(LocalDateTime.now());
                st = studentTestRepository.save(st);
            } else {
                return st;
            }
        } else if ("COMPLETED".equals(st.getStatus())) {
             return st;
        }

        if (st.getIsSuspended()) {
            // For practice arenas or tests without security shield, auto-clear suspension
            // so students can attempt other questions (suspension was for the previous question session only)
            if (isPracticeArena || !hasSecurityShield) {
                st.setIsSuspended(false);
                st.setWarningsCount(0);
                st.setStatus("STARTED");
                st.setStartedAt(LocalDateTime.now());
                st = studentTestRepository.save(st);
            } else {
                throw new RuntimeException("Your attempt on this test has been suspended due to security violations.");
            }
        }

        // If re-attempting a failed test (PENDING), deactivate previous attempt's submissions and clear score & startedAt
        if ("PENDING".equals(st.getStatus())) {
            List<Submission> submissions = submissionRepository.findByStudentTestId(st.getId());
            if (submissions != null && !submissions.isEmpty()) {
                for (Submission sub : submissions) {
                    sub.setActive(false);
                    // Reset the StudentQuestionStatus for each question
                    StudentQuestionStatus sqs = studentQuestionStatusRepository
                            .findByStudentIdAndQuestionId(studentId, sub.getQuestion().getId())
                            .orElse(null);
                    if (sqs != null) {
                        sqs.setStatus("NOT_STARTED");
                        sqs.setCompletedAt(null);
                        studentQuestionStatusRepository.save(sqs);
                    }
                }
                submissionRepository.saveAll(submissions);
            }
            st.setScore(0);
            st.setStartedAt(LocalDateTime.now()); // Set fresh start time for reattempt
        }

        if (!("COMPLETED".equals(st.getStatus())) && !("SUBMITTED".equals(st.getStatus())) && !("EVALUATED".equals(st.getStatus()))) {
            String prevStatus = st.getStatus();
            st.setStatus("STARTED");
            if (st.getStartedAt() == null) {
                // No startedAt yet — set it now (fresh first entry)
                st.setStartedAt(LocalDateTime.now());
            } else if ("ASSIGNED".equals(prevStatus)) {
                // Transitioning from ASSIGNED → STARTED: always set a fresh start time
                st.setStartedAt(LocalDateTime.now());
            } else {
                // Already STARTED (navigating between questions in same session).
                // If startedAt is stale (>12 hours old), it's from a previous abandoned session —
                // reset it so the time taken is measured from the current actual session.
                long hoursAgo = java.time.Duration.between(st.getStartedAt(), LocalDateTime.now()).toHours();
                if (hoursAgo >= 12) {
                    st.setStartedAt(LocalDateTime.now());
                }
                // Otherwise preserve startedAt to keep the running session clock accurate.
            }
            st = studentTestRepository.save(st);
        }

        if (questionId != null) {
            final Long adminIdForQuestion = st.getAdmin().getId();
            com.chillcode.assessment.entity.StudentQuestionStatus sqs = studentQuestionStatusRepository.findByStudentIdAndQuestionId(studentId, questionId)
                    .orElseGet(() -> com.chillcode.assessment.entity.StudentQuestionStatus.builder()
                            .adminId(adminIdForQuestion)
                            .studentId(studentId)
                            .questionId(questionId)
                            .attemptCount(0)
                            .status("NOT_STARTED")
                            .build());

            if ("NOT_STARTED".equals(sqs.getStatus()) || "SUSPENDED".equals(sqs.getStatus())) {
                sqs.setStatus("IN_PROGRESS");
                sqs.setLastAttemptAt(LocalDateTime.now());
                studentQuestionStatusRepository.save(sqs);
            }
        }
        return st;
    }

    @Transactional
    public StudentTest submitTest(Long testId, Long studentId) {
        return submitTest(testId, studentId, false, null);
    }

    @Transactional
    public StudentTest submitTest(Long testId, Long studentId, boolean isAutoSubmitted) {
        return submitTest(testId, studentId, isAutoSubmitted, null);
    }

    @Transactional
    public StudentTest submitTest(Long testId, Long studentId, boolean isAutoSubmitted, Long frontendTimeTakenSeconds) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseGet(() -> studentTestRepository.findById(testId)
                        .orElseThrow(() -> new RuntimeException("Student-Test mapping not found.")));

        if ("COMPLETED".equals(st.getStatus())) {
            return st; // already completed & passed
        }

        int score = st.getScore() != null ? st.getScore() : 0;

        // Determine pass/fail using actual question passing marks from submissions
        // Sum the passingMarks across all active submissions for this student test
        List<Submission> activeSubmissions = submissionRepository.findByStudentTestId(st.getId()).stream()
                .filter(sub -> sub.getActive() == null || Boolean.TRUE.equals(sub.getActive()))
                .collect(Collectors.toList());

        int totalPassingMarks = 0;
        int totalEarnedScore = 0;
        int totalTestCasesPassed = 0;
        int totalTestCasesCount = 0;

        for (Submission sub : activeSubmissions) {
            if (sub.getPassingMarks() != null && sub.getPassingMarks() > 0) {
                totalPassingMarks += sub.getPassingMarks();
            }
            if (sub.getScore() != null) {
                totalEarnedScore += sub.getScore();
            }
            if (sub.getPassedTests() != null) {
                totalTestCasesPassed += sub.getPassedTests();
            }
            if (sub.getTotalTests() != null) {
                totalTestCasesCount += sub.getTotalTests();
            }
        }

        // If no per-question passingMarks set, fallback to 50% of maxMarks
        if (totalPassingMarks == 0) {
            int maxMarks = st.getTest().getMaxMarks() != null ? st.getTest().getMaxMarks() : 100;
            totalPassingMarks = maxMarks / 2;
        }

        // Use the actual accumulated score if available, or 0 if null
        if (totalEarnedScore > 0 && score == 0) {
            score = totalEarnedScore;
            st.setScore(score);
        } else if (st.getScore() == null) {
            st.setScore(0);
        }

        st.setTestCasesPassed(totalTestCasesPassed);
        st.setTotalTestCases(totalTestCasesCount);

        if (score >= totalPassingMarks) {
            st.setStatus("COMPLETED");
            st.setPassFailStatus("PASS");
        } else {
            st.setStatus("PENDING");
            st.setPassFailStatus("FAIL");
            st.setWarningsCount(0);
            st.setIsSuspended(false);
        }

        st.setAutoSubmitted(isAutoSubmitted);
        st.setSubmittedAt(LocalDateTime.now());

        if (frontendTimeTakenSeconds != null && frontendTimeTakenSeconds > 0) {
            st.setTimeTakenSeconds(frontendTimeTakenSeconds);
        } else if (st.getStartedAt() != null) {
            long seconds = java.time.Duration.between(st.getStartedAt(), st.getSubmittedAt()).getSeconds();
            st.setTimeTakenSeconds(Math.max(1L, seconds));
        } else if (isAutoSubmitted && st.getTest() != null && st.getTest().getDurationMinutes() != null) {
            st.setTimeTakenSeconds((long) st.getTest().getDurationMinutes() * 60);
        } else {
            st.setTimeTakenSeconds(1L); // Prevent 0 sec
        }

        StudentTest savedSt = studentTestRepository.save(st);

        // Update subject ranking & award badges asynchronously
        try {
            if (savedSt.getTest() != null && savedSt.getTest().getSubject() != null) {
                rankingService.updateSubjectRankings(savedSt.getTest().getSubject().getId());
            }
            badgeService.evaluateAndAwardBadges(studentId, testId);
            badgeSetService.allocateBadgesForTest(testId);
        } catch (Exception e) {
            System.err.println("Non-fatal error updating ranking/badges: " + e.getMessage());
        }

        return savedSt;
    }

    @Transactional
    public StudentTest recordWarning(Long testId, Long studentId, String type, String reason, Long questionId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student-Test mapping not found."));

        if (Boolean.FALSE.equals(st.getTest().getSecurityShieldEnabled()) || 
            (st.getStudent() != null && com.chillcode.assessment.entity.UserStatus.NO_SECURITY.equals(st.getStudent().getStatus()))) {
            return st; // Ignore warnings and suspension if security shield is disabled or student has NO_SECURITY status
        }

        if (!"STARTED".equals(st.getStatus()) && !"PENDING".equals(st.getStatus())) {
            throw new RuntimeException("Cannot log warning for a test that is not in progress.");
        }

        // Deterministic admin resolution: Test.admin → StudentTest.admin → Student.admin
        User admin = null;
        if (st.getTest() != null && st.getTest().getAdmin() != null) {
            admin = st.getTest().getAdmin();
        } else if (st.getAdmin() != null) {
            admin = st.getAdmin();
        } else if (st.getStudent() != null && st.getStudent().getAdmin() != null) {
            admin = st.getStudent().getAdmin();
        }

        if (admin == null) {
            String diagnostics = String.format(
                "studentTestId=%d, testId=%d, studentId=%d",
                st.getId(), testId, studentId
            );
            throw new RuntimeException(
                "Cannot determine admin ownership for warning. " +
                "Every Test must have an admin. Diagnostics: " + diagnostics
            );
        }

        System.out.println(String.format(
            "[Warning] Recording: type=%s, studentTestId=%d, adminId=%d, reason=%s",
            type, st.getId(), admin.getId(), reason
        ));

        Warning warning = Warning.builder()
                .admin(admin)
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
                    .admin(st.getAdmin())
                    .title("Attempt Suspended")
                    .message("Your exam attempt has been suspended due to multiple security violations in test: " + st.getTest().getName())
                    .type("SUSPENSION")
                    .build();
            notificationRepository.save(alert);
        }

        return studentTestRepository.save(st);
    }

    public com.chillcode.assessment.dto.StudentTestDto convertToStudentTestDto(StudentTest st) {
        return convertToStudentTestDto(st, null, null);
    }

    public com.chillcode.assessment.dto.StudentTestDto convertToStudentTestDto(StudentTest st, 
            java.util.Map<Long, StudentQuestionStatus> sqsMap,
            java.util.Map<Long, List<Question>> questionsBySubjectMap) {
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
                test.getTestCode() != null ? test.getTestCode() : "TEST-" + test.getId(),
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
            List<Question> questions = null;
            if (questionsBySubjectMap != null) {
                questions = questionsBySubjectMap.get(test.getSubject().getId());
            } else {
                questions = questionRepository.findBySubjectId(test.getSubject().getId());
            }
            if (questions != null && !questions.isEmpty()) {
                java.util.Map<Long, StudentQuestionStatus> localSqsMap = sqsMap;
                if (localSqsMap == null) {
                    List<StudentQuestionStatus> sqsList = studentQuestionStatusRepository.findByStudentId(st.getStudent().getId());
                    localSqsMap = sqsList.stream()
                            .collect(Collectors.toMap(StudentQuestionStatus::getQuestionId, s -> s, (s1, s2) -> s1));
                }
                java.util.Set<String> titles = new java.util.LinkedHashSet<>();
                for (Question question : questions) {
                    StudentQuestionStatus sqs = localSqsMap.get(question.getId());
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
                    questionRepository.findById(qId).ifPresent(q -> dto.setReattemptQuestionTitle(q.getTitle()));
                } catch (Exception ignored) {}
            }
        }
        dto.setPassFailStatus(st.getPassFailStatus() != null ? st.getPassFailStatus() : ("COMPLETED".equals(st.getStatus()) ? "PASS" : "FAIL"));
        dto.setTestCasesPassed(st.getTestCasesPassed());
        dto.setTotalTestCases(st.getTotalTestCases());
        dto.setTimeTakenSeconds(st.getTimeTakenSeconds());
        dto.setAutoSubmitted(st.getAutoSubmitted());
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
        
        List<StudentTest> existingStudentTests = studentTestRepository.findByStudentId(studentId);
        java.util.Set<Long> assignedTestIds = existingStudentTests.stream()
                .map(st -> st.getTest().getId())
                .collect(Collectors.toSet());

        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        List<com.chillcode.assessment.entity.Test> allTests = adminId != null ? testRepository.findByAdminId(adminId) : testRepository.findAll();
        boolean savedAny = false;
        for (com.chillcode.assessment.entity.Test test : allTests) {
            if (!assignedTestIds.contains(test.getId())) {
                com.chillcode.assessment.entity.StudentTest st = com.chillcode.assessment.entity.StudentTest.builder()
                        .student(student)
                        .test(test)
                        .status("ASSIGNED")
                        .score(0)
                        .warningsCount(0)
                        .isSuspended(false)
                        .admin(test.getAdmin() != null ? test.getAdmin() : (student != null ? student.getAdmin() : null))
                        .build();
                studentTestRepository.save(st);
                savedAny = true;
            }
        }

        // Auto-unsuspend practice tests / tests with security shield disabled
        List<StudentTest> studentTests = savedAny ? studentTestRepository.findByStudentId(studentId) : existingStudentTests;
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

        List<StudentQuestionStatus> sqsList = studentQuestionStatusRepository.findByStudentId(studentId);
        java.util.Map<Long, StudentQuestionStatus> sqsMap = sqsList.stream()
                .collect(Collectors.toMap(StudentQuestionStatus::getQuestionId, s -> s, (s1, s2) -> s1));

        List<Question> allQuestions = questionRepository.findAll();
        java.util.Map<Long, List<Question>> questionsBySubjectMap = allQuestions.stream()
                .filter(q -> q.getSubject() != null)
                .collect(Collectors.groupingBy(q -> q.getSubject().getId()));

        return studentTestRepository.findByStudentId(studentId).stream()
                .map(st -> convertToStudentTestDto(st, sqsMap, questionsBySubjectMap))
                .collect(Collectors.toList());
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto startTestDto(Long testId, Long studentId, Long questionId) {
        StudentTest st = startTest(testId, studentId, questionId);
        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto exitTestDto(Long testId, Long studentId, Long questionId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        
        if ("STARTED".equals(st.getStatus())) {
            // Treat an exit as an empty auto-submit to ensure attempts are consumed 
            // and fail results are generated correctly.
            return submitTestDto(testId, studentId, new java.util.HashMap<>(), true, null);
        }
        
        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId) {
        return submitTestDto(testId, studentId, null, false, null);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId, java.util.Map<String, java.util.Map<String, String>> questionCodes) {
        return submitTestDto(testId, studentId, questionCodes, false, null);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId, java.util.Map<String, java.util.Map<String, String>> questionCodes, boolean isAutoSubmitted, Long timeTakenSeconds) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseGet(() -> studentTestRepository.findById(testId)
                        .orElseThrow(() -> new RuntimeException("Student-Test mapping not found.")));

        // Pre-save the exact frontend time taken so CodeExecutionService uses it for all submissions
        if (timeTakenSeconds != null && timeTakenSeconds > 0) {
            st.setTimeTakenSeconds(timeTakenSeconds);
            st = studentTestRepository.save(st);
        }

        // Save final draft codes as submissions and evaluate them first
        if (questionCodes != null) {
            for (java.util.Map.Entry<String, java.util.Map<String, String>> entry : questionCodes.entrySet()) {
                try {
                    Long questionId = Long.parseLong(entry.getKey());
                    java.util.Map<String, String> details = entry.getValue();
                    String code = details.get("code");
                    String language = details.get("language");
                    if (code == null || code.trim().isEmpty()) {
                        code = "// No code submitted";
                    }
                    
                    if (code != null) {
                        Question question = questionRepository.findById(questionId).orElse(null);
                        if (question != null) {
                            List<Submission> existing = submissionRepository.findByStudentTestIdAndQuestionId(st.getId(), questionId);
                            boolean isDuplicate = false;
                            if (existing != null && !existing.isEmpty()) {
                                existing.sort((a, b) -> b.getId().compareTo(a.getId()));
                                if (code.equals(existing.get(0).getCode())) {
                                    isDuplicate = true;
                                    if (timeTakenSeconds != null) {
                                        com.chillcode.assessment.entity.Submission existingSub = existing.get(0);
                                        existingSub.setTimeTakenSeconds(timeTakenSeconds);
                                        submissionRepository.save(existingSub);
                                    }
                                }
                            }
                            
                            if (!isDuplicate) {
                                try {
                                    com.chillcode.assessment.dto.SubmitRequest submitReq = new com.chillcode.assessment.dto.SubmitRequest();
                                    submitReq.setQuestionId(questionId);
                                    submitReq.setStudentTestId(st.getId());
                                    submitReq.setCode(code);
                                    submitReq.setLanguage(language != null ? language : "java");
                                    submitReq.setRunOnly(false); // Evaluate and save submission!
                                    submitReq.setTimeTakenSeconds(timeTakenSeconds);

                                    // Run submission evaluation synchronously
                                    codeExecutionService.submitCode(submitReq);
                                } catch (Exception e) {
                                    System.err.println("Failed to evaluate submission dynamically: " + e.getMessage());
                                }
                            }
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Error saving draft submission: " + e.getMessage());
                }
            }
        }

        if (st.getStartedAt() != null && st.getTest() != null && st.getTest().getQuestions() != null
                && !st.getTest().getQuestions().isEmpty()) {
            
            Set<Long> questionsSubmittedNow = new HashSet<>();
            if (questionCodes != null) {
                for (String qIdStr : questionCodes.keySet()) {
                    try {
                        questionsSubmittedNow.add(Long.parseLong(qIdStr));
                    } catch (NumberFormatException ignored) {}
                }
            }

            for (Question q : st.getTest().getQuestions()) {
                if (!questionsSubmittedNow.contains(q.getId())) {
                    StudentQuestionStatus sqs = studentQuestionStatusRepository
                            .findByStudentIdAndQuestionId(studentId, q.getId())
                            .orElse(null);
                    
                    if (sqs != null && "IN_PROGRESS".equals(sqs.getStatus())) {
                        // Create a placeholder submission per question so attemptCount increments.
                        try {
                            com.chillcode.assessment.dto.SubmitRequest blankReq = new com.chillcode.assessment.dto.SubmitRequest();
                            blankReq.setQuestionId(q.getId());
                            blankReq.setStudentTestId(st.getId());
                            blankReq.setCode("// No code submitted");
                            blankReq.setLanguage("java");
                            blankReq.setRunOnly(false);
                            blankReq.setTimeTakenSeconds(timeTakenSeconds);
                            codeExecutionService.submitCode(blankReq);
                        } catch (Exception e) {
                            System.err.println("Failed to create blank submission for question " + q.getId() + ": " + e.getMessage());
                        }
                    }
                }
            }
        }

        // Now submit and finalize the test (calculates score and status)
        st = submitTest(testId, studentId, isAutoSubmitted, timeTakenSeconds);

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
        
        StudentQuestionStatus sqs = studentQuestionStatusRepository
                .findByStudentIdAndQuestionId(studentId, questionId)
                .orElseGet(() -> {
                    StudentQuestionStatus newSqs = new StudentQuestionStatus();
                    newSqs.setAdminId(st.getAdmin().getId());
                    newSqs.setStudentId(studentId);
                    newSqs.setQuestionId(questionId);
                    newSqs.setAttemptCount(0);
                    return newSqs;
                });
        sqs.setStatus("PENDING_REATTEMPT");
        studentQuestionStatusRepository.save(sqs);

        st.setReattemptStatus("PENDING");
        studentTestRepository.save(st);

        com.chillcode.assessment.dto.StudentTestDto dto = convertToStudentTestDto(st);
        dto.setReattemptStatus("PENDING");
        dto.setReattemptQuestionId(questionId);
        questionRepository.findById(questionId).ifPresent(q -> dto.setReattemptQuestionTitle(q.getTitle()));
        return dto;
    }

    @Transactional(readOnly = true)
    public List<com.chillcode.assessment.dto.StudentTestDto> getPendingReattempts() {
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        if (adminId == null) return java.util.Collections.emptyList();
        
        List<StudentQuestionStatus> pendingStatusList = studentQuestionStatusRepository.findByStatus("PENDING_REATTEMPT");
        List<com.chillcode.assessment.dto.StudentTestDto> dtos = new ArrayList<>();
        java.util.Set<String> processedKeys = new java.util.HashSet<>();

        for (StudentQuestionStatus sqs : pendingStatusList) {
            List<StudentTest> studentTests = studentTestRepository.findByStudentId(sqs.getStudentId());
            for (StudentTest st : studentTests) {
                if (st.getTest().getAdmin() != null && st.getTest().getAdmin().getId().equals(adminId)) {
                    if (st.getTest().getQuestions().stream().anyMatch(q -> q.getId().equals(sqs.getQuestionId()))) {
                        String key = st.getStudent().getId() + "_" + sqs.getQuestionId();
                        if (!processedKeys.contains(key)) {
                            processedKeys.add(key);
                            com.chillcode.assessment.dto.StudentTestDto dto = convertToStudentTestDto(st);
                            dto.setReattemptStatus("PENDING");
                            dto.setReattemptQuestionId(sqs.getQuestionId());
                            questionRepository.findById(sqs.getQuestionId()).ifPresent(q -> dto.setReattemptQuestionTitle(q.getTitle()));
                            dtos.add(dto);
                        }
                    }
                }
            }
        }
        return dtos;
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto approveReattempt(Long studentTestId, Long questionId) {
        StudentTest st = studentTestRepository.findById(studentTestId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        
        st.setStatus("PENDING");
        st.setIsSuspended(false);
        st.setWarningsCount(0);
        st.setStartedAt(null);
        st.setSubmittedAt(null);

        List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
        if (warnings != null && !warnings.isEmpty()) {
            warningRepository.deleteAll(warnings);
        }

        if (questionId != null) {
            StudentQuestionStatus sqs = studentQuestionStatusRepository
                    .findByStudentIdAndQuestionId(st.getStudent().getId(), questionId)
                    .orElse(null);
            if (sqs != null) {
                sqs.setStatus("NOT_STARTED");
                sqs.setCompletedAt(null);
                sqs.setAttemptCount(sqs.getAttemptCount() != null ? sqs.getAttemptCount() + 1 : 1);
                studentQuestionStatusRepository.save(sqs);
            }

            List<Submission> submissions = submissionRepository.findByStudentTestId(st.getId());
            if (submissions != null && !submissions.isEmpty()) {
                List<Submission> toDeactivate = submissions.stream()
                        .filter(sub -> sub.getQuestion().getId().equals(questionId))
                        .collect(Collectors.toList());
                for (Submission sub : toDeactivate) {
                    sub.setActive(false);
                }
                submissionRepository.saveAll(toDeactivate);
            }
        } else {
            List<StudentQuestionStatus> allStatus = studentQuestionStatusRepository.findByStudentId(st.getStudent().getId());
            for (StudentQuestionStatus status : allStatus) {
                if ("PENDING_REATTEMPT".equals(status.getStatus())) {
                    status.setStatus("NOT_STARTED");
                    status.setCompletedAt(null);
                    status.setAttemptCount(status.getAttemptCount() != null ? status.getAttemptCount() + 1 : 1);
                    studentQuestionStatusRepository.save(status);
                }
            }
        }

        boolean hasMorePending = false;
        List<StudentQuestionStatus> allStatus = studentQuestionStatusRepository.findByStudentId(st.getStudent().getId());
        for (StudentQuestionStatus status : allStatus) {
            if ("PENDING_REATTEMPT".equals(status.getStatus())) {
                if (st.getTest().getQuestions().stream().anyMatch(q -> q.getId().equals(status.getQuestionId()))) {
                    hasMorePending = true;
                    break;
                }
            }
        }

        if (!hasMorePending) {
            st.setReattemptStatus(null);
        }
        
        studentTestRepository.save(st);

        com.chillcode.assessment.dto.StudentTestDto dto = convertToStudentTestDto(st);
        if (hasMorePending) {
            dto.setReattemptStatus("PENDING");
        } else {
            dto.setReattemptStatus(null);
        }
        return dto;
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto rejectReattempt(Long studentTestId, Long questionId) {
        StudentTest st = studentTestRepository.findById(studentTestId)
                .orElseThrow(() -> new RuntimeException("Student test not found"));
        
        if (questionId != null) {
            StudentQuestionStatus sqs = studentQuestionStatusRepository
                    .findByStudentIdAndQuestionId(st.getStudent().getId(), questionId)
                    .orElse(null);
            if (sqs != null) {
                sqs.setStatus("FAILED");
                studentQuestionStatusRepository.save(sqs);
            }
        } else {
            List<StudentQuestionStatus> allStatus = studentQuestionStatusRepository.findByStudentId(st.getStudent().getId());
            for (StudentQuestionStatus status : allStatus) {
                if ("PENDING_REATTEMPT".equals(status.getStatus())) {
                    status.setStatus("FAILED");
                    studentQuestionStatusRepository.save(status);
                }
            }
        }

        boolean hasMorePending = false;
        List<StudentQuestionStatus> allStatus = studentQuestionStatusRepository.findByStudentId(st.getStudent().getId());
        for (StudentQuestionStatus status : allStatus) {
            if ("PENDING_REATTEMPT".equals(status.getStatus())) {
                if (st.getTest().getQuestions().stream().anyMatch(q -> q.getId().equals(status.getQuestionId()))) {
                    hasMorePending = true;
                    break;
                }
            }
        }

        if (!hasMorePending) {
            st.setReattemptStatus("REJECTED");
        }
        
        studentTestRepository.save(st);

        com.chillcode.assessment.dto.StudentTestDto dto = convertToStudentTestDto(st);
        if (hasMorePending) {
            dto.setReattemptStatus("PENDING");
        } else {
            dto.setReattemptStatus("REJECTED");
        }
        return dto;
    }
}
