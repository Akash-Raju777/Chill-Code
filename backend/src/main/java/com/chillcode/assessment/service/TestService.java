package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.TestDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class TestService {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(TestService.class);

    // Atomic JVM-level deduplication guards to prevent concurrent double-clicks / retries
    // from creating duplicate submissions before PostgreSQL commits READ_COMMITTED transactions.
    private final ConcurrentHashMap<String, Long> recentSubmissionTimestamps = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> recentSubmissionIds = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Long> processedRequestIds = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Integer> recentAttemptCounts = new ConcurrentHashMap<>();

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
    private TestCaseRepository testCaseRepository;

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
        List<Test> tests = testRepository.findByAdminIdWithSubjectAndStaff(adminId);
        Map<Long, String> questionCodeByTestId = new HashMap<>();
        try {
            for (Object[] row : testRepository.findTestIdAndQuestionCodes()) {
                if (row != null && row.length >= 2 && row[0] != null && row[1] != null) {
                    String qCode = row[1].toString().trim().toUpperCase();
                    if (!qCode.isEmpty() && !qCode.startsWith("TEST-")) {
                        questionCodeByTestId.putIfAbsent(((Number) row[0]).longValue(), qCode);
                    }
                }
            }
        } catch (Exception ignored) {}

        List<Test> toSave = new ArrayList<>();
        for (Test t : tests) {
            String foundQCode = questionCodeByTestId.get(t.getId());
            if (foundQCode != null) {
                if (!foundQCode.equals(t.getTestCode())) {
                    t.setTestCode(foundQCode);
                    toSave.add(t);
                }
            } else if (t.getTestCode() == null || t.getTestCode().trim().isEmpty() || t.getTestCode().startsWith("TEST-")) {
                String prefix = (t.getSubject() != null && t.getSubject().getName() != null) ?
                        t.getSubject().getName().replaceAll("[^a-zA-Z]", "").toUpperCase() : "TEST";
                if (prefix.length() > 6) prefix = prefix.substring(0, 6);
                t.setTestCode(prefix + "-" + String.format("%03d", t.getId()));
                toSave.add(t);
            }
        }
        if (!toSave.isEmpty()) {
            testRepository.saveAll(toSave);
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
    public Test updateAssignedStaff(Long testId, Long staffId) {
        Test test = testRepository.findById(testId)
                .orElseThrow(() -> new RuntimeException("Test not found with id: " + testId));
        if (staffId != null) {
            User staff = userRepository.findById(staffId)
                    .orElseThrow(() -> new RuntimeException("Staff member not found with id: " + staffId));
            test.setAssignedStaff(staff);
        } else {
            test.setAssignedStaff(null);
        }
        return testRepository.save(test);
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

        User currentUser = com.chillcode.assessment.security.SecurityUtils.getCurrentUser();
        User staff = null;
        if (dto.getAssignedStaffId() != null) {
            staff = userRepository.findById(dto.getAssignedStaffId()).orElse(null);
        }
        if (staff == null && subject.getEffectiveStaff() != null) {
            staff = subject.getEffectiveStaff();
        }
        if (staff == null) {
            staff = currentUser;
        }

        Test test = Test.builder()
                .admin(currentUser)
                .assignedStaff(staff)
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

        // Do not allow resuming or resetting an already exited/pending non-practice test without admin reattempt approval
        if ("PENDING".equals(st.getStatus()) && !isPracticeArena) {
            return st;
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
        
        Test test = null;
        try {
            test = st.getTest();
        } catch (Exception ignored) {}

        com.chillcode.assessment.dto.StudentTestDto.SubjectDetailsDto subjectDto = null;
        if (test != null) {
            try {
                com.chillcode.assessment.entity.Subject subject = test.getSubject();
                if (subject != null) {
                    Long subId = subject.getId();
                    String subName = null;
                    String subColor = null;
                    try {
                        subName = subject.getName();
                        subColor = subject.getColor();
                    } catch (Exception proxyEx) {
                        if (subId != null && subjectRepository != null) {
                            com.chillcode.assessment.entity.Subject loaded = subjectRepository.findById(subId).orElse(null);
                            if (loaded != null) {
                                subName = loaded.getName();
                                subColor = loaded.getColor();
                            }
                        }
                    }
                    if (subId != null) {
                        subjectDto = new com.chillcode.assessment.dto.StudentTestDto.SubjectDetailsDto(
                            subId,
                            subName != null ? subName : "Subject",
                            subColor
                        );
                    }
                }
            } catch (Exception ignored) {}
        }

        com.chillcode.assessment.dto.StudentTestDto.TestDetailsDto testDto = null;
        if (test != null) {
            try {
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
            } catch (Exception ignored) {}
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

        String displayTitle = (test != null && test.getName() != null) ? test.getName() : "";
        try {
            if (test != null && test.getName() != null && test.getName().toLowerCase().contains("practice arena") && st.getStudent() != null) {
                Long subId = null;
                if (test.getSubject() != null) {
                    subId = test.getSubject().getId();
                }
                if (subId != null) {
                    List<Question> questions = null;
                    if (questionsBySubjectMap != null) {
                        questions = questionsBySubjectMap.get(subId);
                    } else {
                        questions = questionRepository.findBySubjectId(subId);
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
            }
        } catch (Exception ignored) {}
        dto.setDisplayTitle(displayTitle);

        try {
            if (st.getStudent() != null) {
                String regNo = null;
                String name = null;
                try {
                    regNo = st.getStudent().getRegisterNumber();
                    name = st.getStudent().getName();
                } catch (Exception proxyEx) {
                    if (st.getStudent().getId() != null) {
                        User u = userRepository.findById(st.getStudent().getId()).orElse(null);
                        if (u != null) {
                            regNo = u.getRegisterNumber();
                            name = u.getName();
                        }
                    }
                }
                dto.setStudentRegisterNumber(regNo);
                dto.setStudentName(name);
            }
        } catch (Exception ignored) {}
        
        String rStatus = st.getReattemptStatus();
        if (rStatus != null && rStatus.contains(":")) {
            String[] parts = rStatus.split(":");
            if (parts.length == 2) {
                dto.setReattemptStatus(parts[0]);
                try {
                    Long qId = Long.parseLong(parts[1]);
                    String matchedTitle = null;
                    if (questionsBySubjectMap != null) {
                        for (List<Question> qList : questionsBySubjectMap.values()) {
                            for (Question q : qList) {
                                if (qId.equals(q.getId())) {
                                    matchedTitle = q.getTitle();
                                    break;
                                }
                            }
                            if (matchedTitle != null) break;
                        }
                    }
                    if (matchedTitle != null) {
                        dto.setReattemptQuestionTitle(matchedTitle);
                    } else {
                        questionRepository.findById(qId).ifPresent(q -> dto.setReattemptQuestionTitle(q.getTitle()));
                    }
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
            List<StudentTest> unsuspended = new java.util.ArrayList<>();
            for (StudentTest st : studentTests) {
                if (Boolean.TRUE.equals(st.getIsSuspended()) || "SUSPENDED".equals(st.getStatus())) {
                    st.setIsSuspended(false);
                    st.setWarningsCount(0);
                    st.setStatus("STARTED");
                    unsuspended.add(st);
                }
            }
            if (!unsuspended.isEmpty()) {
                studentTestRepository.saveAll(unsuspended);
                for (StudentTest st : unsuspended) {
                    List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
                    if (warnings != null && !warnings.isEmpty()) {
                        warningRepository.deleteAll(warnings);
                    }
                }
            }
        }
        
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        List<com.chillcode.assessment.entity.Test> allTests = adminId != null
                ? testRepository.findByAdminIdWithSubjectAndStaff(adminId)
                : testRepository.findAllWithSubjectAndStaff();

        List<StudentTest> existingStudentTests = studentTestRepository.findByStudentIdWithTestAndSubject(studentId);
        java.util.Set<Long> assignedTestIds = existingStudentTests.stream()
                .map(st -> st.getTest().getId())
                .collect(Collectors.toSet());

        // Batch-create missing assignments (saveAll = one flush instead of one
        // round trip per test; first-load with ~180 tests used to take ~67s).
        boolean savedAny = false;
        List<StudentTest> newAssignments = new java.util.ArrayList<>();
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
                newAssignments.add(st);
            }
        }
        if (!newAssignments.isEmpty()) {
            studentTestRepository.saveAll(newAssignments);
            savedAny = true;
        }

        // Auto-unsuspend practice tests / tests with security shield disabled
        List<StudentTest> studentTests = savedAny
                ? studentTestRepository.findByStudentIdWithTestAndSubject(studentId)
                : existingStudentTests;
        List<StudentTest> autoUnsuspended = new java.util.ArrayList<>();
        for (StudentTest st : studentTests) {
            st.setStudent(student);
            if (Boolean.FALSE.equals(st.getTest().getSecurityShieldEnabled())) {
                if (Boolean.TRUE.equals(st.getIsSuspended()) || "SUSPENDED".equals(st.getStatus())) {
                    st.setIsSuspended(false);
                    st.setWarningsCount(0);
                    if ("SUSPENDED".equals(st.getStatus())) {
                        st.setStatus("STARTED");
                    }
                    autoUnsuspended.add(st);
                }
            }
        }
        if (!autoUnsuspended.isEmpty()) {
            studentTestRepository.saveAll(autoUnsuspended);
            for (StudentTest st : autoUnsuspended) {
                List<Warning> warnings = warningRepository.findByStudentTestId(st.getId());
                if (warnings != null && !warnings.isEmpty()) {
                    warningRepository.deleteAll(warnings);
                }
            }
        }

        boolean needsPracticeArenaQuestions = studentTests.stream().anyMatch(st ->
                st.getTest() != null && st.getTest().getName() != null
                        && st.getTest().getName().toLowerCase().contains("practice arena"));
        boolean needsReattemptQuestionTitles = studentTests.stream().anyMatch(st ->
                st.getReattemptStatus() != null && st.getReattemptStatus().contains(":"));

        java.util.Map<Long, StudentQuestionStatus> sqsMap = java.util.Collections.emptyMap();
        java.util.Map<Long, List<Question>> questionsBySubjectMap = java.util.Collections.emptyMap();
        if (needsPracticeArenaQuestions || needsReattemptQuestionTitles) {
            List<StudentQuestionStatus> sqsList = studentQuestionStatusRepository.findByStudentId(studentId);
            sqsMap = sqsList.stream()
                    .collect(Collectors.toMap(StudentQuestionStatus::getQuestionId, s -> s, (s1, s2) -> s1));

            List<Question> scopedQuestions = adminId != null
                    ? questionRepository.findByAdminId(adminId)
                    : questionRepository.findAll();
            questionsBySubjectMap = scopedQuestions.stream()
                    .filter(q -> q.getSubject() != null)
                    .collect(Collectors.groupingBy(q -> q.getSubject().getId()));
        }

        final java.util.Map<Long, StudentQuestionStatus> finalSqsMap = sqsMap;
        final java.util.Map<Long, List<Question>> finalQuestionsBySubjectMap = questionsBySubjectMap;
        return studentTests.stream()
                .map(st -> convertToStudentTestDto(st, finalSqsMap, finalQuestionsBySubjectMap))
                .collect(Collectors.toList());
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto startTestDto(Long testId, Long studentId, Long questionId) {
        StudentTest st = startTest(testId, studentId, questionId);
        return convertToStudentTestDto(st);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto exitTestDto(Long testId, Long studentId, Long questionId, Long timeTakenSeconds) {
        return exitTestDto(testId, studentId, questionId, timeTakenSeconds, null);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto exitTestDto(Long testId, Long studentId, Long questionId, Long timeTakenSeconds, java.util.Map<String, java.util.Map<String, String>> questionCodes) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                .orElseGet(() -> studentTestRepository.findById(testId)
                        .orElseThrow(() -> new RuntimeException("Student test not found")));

        boolean questionInProgress = questionId != null && studentQuestionStatusRepository
                .findByStudentIdAndQuestionId(studentId, questionId)
                .map(s -> "IN_PROGRESS".equals(s.getStatus()))
                .orElse(false);
        boolean testWasStarted = st.getStartedAt() != null || !"ASSIGNED".equals(st.getStatus()) || questionInProgress;
        if (!testWasStarted) {
            return convertToStudentTestDto(st);
        }
        if (st.getStartedAt() == null) {
            st.setStartedAt(LocalDateTime.now());
        }

        Long actualTimeTaken = (timeTakenSeconds != null && timeTakenSeconds > 0) ? timeTakenSeconds : 1L;
        st.setTimeTakenSeconds(actualTimeTaken);

        boolean isPractice = st.getTest() != null && st.getTest().getName() != null &&
                st.getTest().getName().toLowerCase().contains("practice");

        if (!isPractice) {
            st.setSubmittedAt(LocalDateTime.now());
            st.setStatus("PENDING");
            st.setPassFailStatus("FAIL");
            st.setAutoSubmitted(false);
        } else {
            // In a practice arena, keep session active so other questions are not blocked
            st.setStatus("STARTED");
        }
        StudentTest savedSt = studentTestRepository.save(st);

        // Record exited attempt for questions:
        // If questionId is provided, only target that specific question session.
        // Otherwise, target all questions in the test.
        List<Question> targetQuestions = new ArrayList<>();
        if (savedSt.getTest() != null && savedSt.getTest().getQuestions() != null) {
            if (questionId != null) {
                for (Question q : savedSt.getTest().getQuestions()) {
                    if (q.getId().equals(questionId)) {
                        targetQuestions.add(q);
                        break;
                    }
                }
            }
            if (targetQuestions.isEmpty() && questionId == null) {
                targetQuestions.addAll(savedSt.getTest().getQuestions());
            }
        }
        if (targetQuestions.isEmpty() && questionId != null) {
            questionRepository.findById(questionId).ifPresent(targetQuestions::add);
        }

        LocalDateTime now = LocalDateTime.now();
        for (Question q : targetQuestions) {
            final Question finalQ = q;
            StudentQuestionStatus sqs = studentQuestionStatusRepository
                    .findByStudentIdAndQuestionId(studentId, q.getId())
                    .orElseGet(() -> {
                        StudentQuestionStatus n = new StudentQuestionStatus();
                        n.setAdminId(studentQuestionStatusService.resolveAdminId(savedSt, finalQ));
                        n.setStudentId(studentId);
                        n.setQuestionId(finalQ.getId());
                        n.setStatus("NOT_STARTED");
                        n.setAttemptCount(0);
                        return n;
                    });

            List<Submission> subs = submissionRepository.findByStudentIdAndQuestionIdOrderByCreatedAtDesc(studentId, q.getId());
            boolean hasCompleted = "COMPLETED".equals(sqs.getStatus()) || (subs != null && subs.stream().anyMatch(sub ->
                    (sub.getActive() == null || Boolean.TRUE.equals(sub.getActive())) &&
                    ("ACCEPTED".equals(sub.getStatus()) || "PASS".equals(sub.getOverallResult()))
            ));

            if (hasCompleted) {
                // Already passed -> do not downgrade
                sqs.setStatus("COMPLETED");
            } else {
                // Explicit confirmed exit (new or resumed IN_PROGRESS session):
                // Create an EXITED submission record so Results shows "EXITED (FAIL)"
                // and transition StudentQuestionStatus to PENDING.
                // Idempotency guard: skip if an active EXITED record was created within last 10 seconds.
                LocalDateTime dedupeWindow = now.minusSeconds(10);
                long recentExitCount = submissionRepository.countRecentExitedByStudentAndQuestion(
                        studentId, q.getId(), dedupeWindow);

                if (recentExitCount == 0) {
                    // Determine language from questionCodes payload or default to java
                    String exitLang = "java";
                    String exitCode = "// No code submitted";
                    if (questionCodes != null && questionCodes.containsKey(String.valueOf(q.getId()))) {
                        java.util.Map<String, String> codeEntry = questionCodes.get(String.valueOf(q.getId()));
                        if (codeEntry != null) {
                            if (codeEntry.get("language") != null) exitLang = codeEntry.get("language");
                            if (codeEntry.get("code") != null && !codeEntry.get("code").trim().isEmpty()) {
                                exitCode = codeEntry.get("code");
                            }
                        }
                    }

                    submissionRepository.deactivatePreviousSubmissions(savedSt.getId(), q.getId());

                    int totalTc = testCaseRepository.countByQuestionId(q.getId());
                    int qTotalMarks = q.getTotalMarks() != null ? q.getTotalMarks() : 20;
                    int qPassingMarks = q.getPassingMarks() != null ? q.getPassingMarks() : 10;
                    Submission exitSub = Submission.builder()
                            .studentTest(savedSt)
                            .question(q)
                            .admin(savedSt.getAdmin() != null ? savedSt.getAdmin() : q.getAdmin())
                            .language(exitLang)
                            .code(exitCode)
                            .status("EXITED")
                            .overallResult("FAIL")
                            .score(0)
                            .totalMarks(qTotalMarks)
                            .passingMarks(qPassingMarks)
                            .percentage(0.0)
                            .timeTakenSeconds(actualTimeTaken)
                            .passedTests(0)
                            .totalTests(totalTc)
                            .active(true)
                            .createdAt(now)
                            .build();
                    exitSub = submissionRepository.save(exitSub);
                    sqs.setLastSubmissionId(exitSub.getId());
                }

                // Count total attempts (EXITED records are included in countByStudentIdAndQuestionId)
                long totalAttempts = submissionRepository.countByStudentIdAndQuestionId(studentId, q.getId());

                sqs.setStatus(!("PENDING_REATTEMPT".equals(sqs.getStatus())) ? "PENDING" : sqs.getStatus());
                sqs.setAttemptCount((int) Math.max(1, totalAttempts));
                sqs.setLastAttemptAt(now);
                studentQuestionStatusRepository.save(sqs);
                log.info("[ExitTest] studentId={}, testId={}, questionId={}, status={}, attempts={}",
                        studentId, savedSt.getId(), q.getId(), sqs.getStatus(), sqs.getAttemptCount());
                continue; // skip the shared save below
            }

            long actualAttempts = submissionRepository.countByStudentIdAndQuestionId(studentId, q.getId());
            sqs.setAttemptCount((int) actualAttempts);
            sqs.setLastAttemptAt(now);
            studentQuestionStatusRepository.save(sqs);
        }

        return convertToStudentTestDto(savedSt);
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
        return submitTestDto(testId, studentId, questionCodes, isAutoSubmitted, timeTakenSeconds, null);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId, java.util.Map<String, java.util.Map<String, String>> questionCodes, boolean isAutoSubmitted, Long timeTakenSeconds, Long questionId) {
        return submitTestDto(testId, studentId, questionCodes, isAutoSubmitted, timeTakenSeconds, questionId, null);
    }

    @Transactional
    public com.chillcode.assessment.dto.StudentTestDto submitTestDto(Long testId, Long studentId, java.util.Map<String, java.util.Map<String, String>> questionCodes, boolean isAutoSubmitted, Long timeTakenSeconds, Long questionId, String requestId) {
        StudentTest st = studentTestRepository.findByStudentIdAndTestIdWithTestAndStudent(studentId, testId)
                .orElseGet(() -> studentTestRepository.findByIdWithTestAndStudent(testId)
                        .orElseGet(() -> studentTestRepository.findByStudentIdAndTestId(studentId, testId)
                                .orElseGet(() -> studentTestRepository.findById(testId)
                                        .orElseThrow(() -> new RuntimeException("Student-Test mapping not found.")))));

        boolean isPractice = st.getTest() != null && st.getTest().getName() != null &&
                st.getTest().getName().toLowerCase().contains("practice");

        // Fast idempotency check by client requestId before creating any DB records
        if (requestId != null && !requestId.isBlank() && questionId != null) {
            String reqKey = studentId + ":" + questionId + ":" + requestId;
            Long existingSubId = processedRequestIds.get(reqKey);
            if (existingSubId != null) {
                log.info("[Submit] Idempotent hit for requestId={}, returning existing submissionId={}", requestId, existingSubId);
                return com.chillcode.assessment.dto.StudentTestDto.builder()
                        .id(st.getId())
                        .status(st.getStatus())
                        .submittedAt(st.getSubmittedAt())
                        .timeTakenSeconds(st.getTimeTakenSeconds())
                        .autoSubmitted(st.getAutoSubmitted())
                        .submissionId(existingSubId)
                        .attemptCount(recentAttemptCounts.getOrDefault(studentId + ":" + questionId, 1))
                        .build();
            }
        }

        // Guard against duplicate submissions from double clicks or network retries (only for non-practice full test submissions)
        if (!isPractice && ("SUBMITTED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))) {
            log.info("Test {} for student {} is already in status {}, returning existing result", testId, studentId, st.getStatus());
            return com.chillcode.assessment.dto.StudentTestDto.builder()
                    .id(st.getId())
                    .status(st.getStatus())
                    .submittedAt(st.getSubmittedAt())
                    .timeTakenSeconds(st.getTimeTakenSeconds())
                    .autoSubmitted(st.getAutoSubmitted())
                    .submissionId(questionId != null ? recentSubmissionIds.get(studentId + ":" + questionId) : null)
                    .attemptCount(questionId != null ? recentAttemptCounts.get(studentId + ":" + questionId) : null)
                    .build();
        }

        Long actualTimeTaken = (timeTakenSeconds != null && timeTakenSeconds > 0) ? timeTakenSeconds : 1L;
        st.setTimeTakenSeconds(actualTimeTaken);
        st.setSubmittedAt(LocalDateTime.now());
        st.setAutoSubmitted(isAutoSubmitted);
        if (!isPractice) {
            st.setStatus("SUBMITTED");
        } else {
            st.setStatus("STARTED");
        }
        st = studentTestRepository.save(st);

        final StudentTest finalSt = st;
        final Long studentTestId = st.getId();

        Map<Long, com.chillcode.assessment.dto.SubmitRequest> requestsToEvaluate = new LinkedHashMap<>();

        List<Question> questionsToProcess = new ArrayList<>();
        if (questionId != null) {
            questionRepository.findById(questionId).ifPresent(questionsToProcess::add);
        } else if (questionCodes != null && !questionCodes.isEmpty()) {
            for (String qIdStr : questionCodes.keySet()) {
                try {
                    Long qId = Long.parseLong(qIdStr);
                    questionRepository.findById(qId).ifPresent(questionsToProcess::add);
                } catch (Exception ignored) {}
            }
        } else if (st.getTest() != null && st.getTest().getQuestions() != null) {
            try {
                questionsToProcess.addAll(st.getTest().getQuestions());
            } catch (Exception ignored) {}
        }

        Long createdSubmissionId = null;
        Integer latestAttemptCount = null;

        for (Question q : questionsToProcess) {
            final Question finalQ = q;
            final String sqKey = studentId + ":" + q.getId();
            final long nowMs = System.currentTimeMillis();

            // Atomic in-memory guard: prevent concurrent requests within 3s for the same student+question
            final boolean[] blockedConcurrent = {false};
            recentSubmissionTimestamps.compute(sqKey, (k, lastTs) -> {
                if (lastTs != null && (nowMs - lastTs) < 3000L) {
                    blockedConcurrent[0] = true;
                    return lastTs;
                }
                return nowMs;
            });
            if (blockedConcurrent[0]) {
                log.info("[Submit] Ignoring concurrent duplicate submission within 3s for {}", sqKey);
                createdSubmissionId = recentSubmissionIds.get(sqKey);
                latestAttemptCount = recentAttemptCounts.get(sqKey);
                continue;
            }

            // DB guard against duplicate rapid submissions or an active evaluation running within last 2 minutes
            List<Submission> recentSubs = submissionRepository.findByStudentIdAndQuestionIdOrderByCreatedAtDesc(studentId, q.getId());
            if (recentSubs != null && !recentSubs.isEmpty()) {
                Submission latest = recentSubs.get(0);
                if (latest.getCreatedAt() != null && latest.getCreatedAt().isAfter(LocalDateTime.now().minusSeconds(3))) {
                    log.info("Ignoring duplicate rapid DB submission for studentId={}, questionId={}", studentId, q.getId());
                    createdSubmissionId = latest.getId();
                    latestAttemptCount = recentSubs.size();
                    continue;
                }
                if (("PENDING".equals(latest.getStatus()) || "EVALUATING".equals(latest.getStatus()))
                        && latest.getCreatedAt() != null
                        && latest.getCreatedAt().isAfter(LocalDateTime.now().minusMinutes(2))) {
                    log.info("Question {} for student {} is currently EVALUATING (subId={}), skipping duplicate submission", q.getId(), studentId, latest.getId());
                    createdSubmissionId = latest.getId();
                    latestAttemptCount = recentSubs.size();
                    continue;
                }
            }

            String code = null;
            String lang = "java";

            if (questionCodes != null && questionCodes.containsKey(String.valueOf(q.getId()))) {
                java.util.Map<String, String> details = questionCodes.get(String.valueOf(q.getId()));
                if (details != null) {
                    code = details.get("code");
                    if (details.get("language") != null) lang = details.get("language");
                }
            }

            if (code == null || code.trim().isEmpty()) {
                code = "// No code submitted";
            }

            submissionRepository.deactivatePreviousSubmissions(studentTestId, q.getId());

            int totalTc = testCaseRepository.countByQuestionId(q.getId());
            Submission sub = Submission.builder()
                    .studentTest(finalSt)
                    .question(q)
                    .admin(finalSt.getAdmin() != null ? finalSt.getAdmin() : q.getAdmin())
                    .language(lang)
                    .code(code)
                    .status("PENDING")
                    .overallResult("PENDING")
                    .score(0)
                    .timeTakenSeconds(actualTimeTaken)
                    .passedTests(0)
                    .totalTests(totalTc)
                    .active(true)
                    .createdAt(LocalDateTime.now())
                    .build();
            sub = submissionRepository.save(sub);
            createdSubmissionId = sub.getId();
            recentSubmissionIds.put(sqKey, sub.getId());

            StudentQuestionStatus sqs = studentQuestionStatusRepository
                    .findByStudentIdAndQuestionId(studentId, q.getId())
                    .orElseGet(() -> {
                        StudentQuestionStatus n = new StudentQuestionStatus();
                        n.setAdminId(studentQuestionStatusService.resolveAdminId(finalSt, finalQ));
                        n.setStudentId(studentId);
                        n.setQuestionId(finalQ.getId());
                        n.setStatus("IN_PROGRESS");
                        n.setAttemptCount(0);
                        return n;
                    });

            long actualSubCount = submissionRepository.countByStudentIdAndQuestionId(studentId, q.getId());
            int attemptNum = (int) Math.max(1, actualSubCount);
            latestAttemptCount = attemptNum;
            recentAttemptCounts.put(sqKey, attemptNum);
            if (requestId != null && !requestId.isBlank()) {
                processedRequestIds.put(studentId + ":" + q.getId() + ":" + requestId, sub.getId());
                if (processedRequestIds.size() > 5000) {
                    processedRequestIds.clear();
                }
            }

            sqs.setAttemptCount(attemptNum);
            sqs.setStatus("IN_PROGRESS");
            sqs.setLastAttemptAt(LocalDateTime.now());
            sqs.setLastSubmissionId(sub.getId());
            studentQuestionStatusRepository.save(sqs);

            com.chillcode.assessment.dto.SubmitRequest submitReq = new com.chillcode.assessment.dto.SubmitRequest();
            submitReq.setQuestionId(q.getId());
            submitReq.setStudentTestId(studentTestId);
            submitReq.setCode(code);
            submitReq.setLanguage(lang);
            submitReq.setRunOnly(false);
            submitReq.setTimeTakenSeconds(actualTimeTaken);
            requestsToEvaluate.put(sub.getId(), submitReq);
        }

        if (!requestsToEvaluate.isEmpty()) {
            final Runnable asyncTask = () -> CompletableFuture.runAsync(() -> {
                try {
                    for (Map.Entry<Long, com.chillcode.assessment.dto.SubmitRequest> entry : requestsToEvaluate.entrySet()) {
                        Long submissionId = entry.getKey();
                        com.chillcode.assessment.dto.SubmitRequest req = entry.getValue();
                        try {
                            codeExecutionService.evaluateExistingSubmission(submissionId, req);
                        } catch (Exception ex) {
                            log.error("Async evaluation error for submission {}: {}", submissionId, ex.getMessage(), ex);
                        }
                    }
                    finalizeStudentTestAfterEvaluation(studentTestId, actualTimeTaken, isAutoSubmitted);
                } catch (Exception e) {
                    log.error("Async evaluation overall error for studentTestId {}: {}", studentTestId, e.getMessage(), e);
                }
            });

            // Launch evaluation ONLY AFTER the transaction commits the PENDING submission row to Postgres
            if (TransactionSynchronizationManager.isSynchronizationActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        asyncTask.run();
                    }
                });
            } else {
                asyncTask.run();
            }
        }

        // Return lightweight acknowledgment DTO immediately without N+1 subject/status queries
        return com.chillcode.assessment.dto.StudentTestDto.builder()
                .id(st.getId())
                .status(st.getStatus())
                .submittedAt(st.getSubmittedAt())
                .timeTakenSeconds(st.getTimeTakenSeconds())
                .autoSubmitted(st.getAutoSubmitted())
                .submissionId(createdSubmissionId)
                .attemptCount(latestAttemptCount)
                .build();
    }

    @Transactional
    public void finalizeStudentTestAfterEvaluation(Long studentTestId, Long frontendTimeTakenSeconds, boolean isAutoSubmitted) {
        StudentTest st = studentTestRepository.findByIdWithTestAndStudent(studentTestId)
                .orElseGet(() -> studentTestRepository.findById(studentTestId).orElse(null));
        if (st == null) return;

        com.chillcode.assessment.entity.Test test = null;
        try {
            test = st.getTest();
            if (test != null) {
                test.getMaxMarks();
            }
        } catch (Exception e) {
            if (st.getTest() != null && st.getTest().getId() != null) {
                test = testRepository.findById(st.getTest().getId()).orElse(null);
            }
        }

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

        if (totalPassingMarks == 0) {
            int maxMarks = test != null && test.getMaxMarks() != null ? test.getMaxMarks() : 100;
            totalPassingMarks = maxMarks / 2;
        }

        st.setScore(totalEarnedScore);
        st.setTestCasesPassed(totalTestCasesPassed);
        st.setTotalTestCases(totalTestCasesCount);

        boolean isPracticeArena = test != null && test.getName() != null && test.getName().toLowerCase().contains("practice");
        if (!isPracticeArena) {
            if (totalEarnedScore >= totalPassingMarks) {
                st.setStatus("COMPLETED");
                st.setPassFailStatus("PASS");
            } else {
                st.setStatus("PENDING");
                st.setPassFailStatus("FAIL");
                st.setWarningsCount(0);
                st.setIsSuspended(false);
            }
        } else {
            st.setStatus("STARTED");
        }

        st.setAutoSubmitted(isAutoSubmitted);
        st.setSubmittedAt(LocalDateTime.now());
        if (frontendTimeTakenSeconds != null && frontendTimeTakenSeconds > 0) {
            st.setTimeTakenSeconds(frontendTimeTakenSeconds);
        }

        StudentTest savedSt = studentTestRepository.save(st);

        final Long asyncSubjectId = (test != null && test.getSubject() != null) ? test.getSubject().getId() : null;
        final Long asyncStudentId = st.getStudent() != null ? st.getStudent().getId() : null;
        final Long asyncTestId = test != null ? test.getId() : null;
        Runnable badgeAndRankTask = () -> CompletableFuture.runAsync(() -> {
            try {
                if (asyncSubjectId != null) {
                    rankingService.updateSubjectRankings(asyncSubjectId);
                }
                if (asyncStudentId != null && asyncTestId != null) {
                    badgeService.evaluateAndAwardBadges(asyncStudentId, asyncTestId);
                }
                if (asyncTestId != null) {
                    badgeSetService.allocateBadgesForTest(asyncTestId);
                }
            } catch (Exception e) {
                System.err.println("Non-fatal error updating ranking/badges: " + e.getMessage());
            }
        });
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    badgeAndRankTask.run();
                }
            });
        } else {
            badgeAndRankTask.run();
        }
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
        if (pendingStatusList == null || pendingStatusList.isEmpty()) {
            return java.util.Collections.emptyList();
        }

        java.util.Set<Long> studentIds = pendingStatusList.stream()
                .map(StudentQuestionStatus::getStudentId)
                .collect(java.util.stream.Collectors.toSet());
        java.util.Set<Long> questionIds = pendingStatusList.stream()
                .map(StudentQuestionStatus::getQuestionId)
                .collect(java.util.stream.Collectors.toSet());

        java.util.Map<Long, Question> questionMap = questionRepository.findAllById(questionIds).stream()
                .collect(java.util.stream.Collectors.toMap(Question::getId, q -> q, (a, b) -> a));

        List<StudentTest> studentTests = studentTestRepository.findByStudentIdInWithTestAndStudent(studentIds);
        java.util.Map<Long, List<StudentTest>> studentTestsMap = studentTests.stream()
                .filter(st -> st.getStudent() != null)
                .collect(java.util.stream.Collectors.groupingBy(st -> st.getStudent().getId()));

        List<com.chillcode.assessment.dto.StudentTestDto> dtos = new ArrayList<>();
        java.util.Set<String> processedKeys = new java.util.HashSet<>();

        for (StudentQuestionStatus sqs : pendingStatusList) {
            List<StudentTest> testsForStudent = studentTestsMap.getOrDefault(sqs.getStudentId(), java.util.Collections.emptyList());
            for (StudentTest st : testsForStudent) {
                if (st.getTest() != null && st.getTest().getAdmin() != null && st.getTest().getAdmin().getId().equals(adminId)) {
                    boolean matchesQuestion = st.getTest().getQuestions() != null &&
                            st.getTest().getQuestions().stream().anyMatch(q -> q.getId().equals(sqs.getQuestionId()));
                    if (matchesQuestion) {
                        String key = sqs.getStudentId() + "_" + sqs.getQuestionId();
                        if (!processedKeys.contains(key)) {
                            processedKeys.add(key);
                            com.chillcode.assessment.dto.StudentTestDto dto = convertToStudentTestDto(st);
                            dto.setReattemptStatus("PENDING");
                            dto.setReattemptQuestionId(sqs.getQuestionId());
                            Question q = questionMap.get(sqs.getQuestionId());
                            if (q != null) {
                                dto.setReattemptQuestionTitle(q.getTitle());
                            }
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
