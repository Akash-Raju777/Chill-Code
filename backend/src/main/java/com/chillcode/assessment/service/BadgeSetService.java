package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.BadgeDefinitionDto;
import com.chillcode.assessment.dto.BadgeSetDto;
import com.chillcode.assessment.dto.LanguageMasterBadgeDto;
import com.chillcode.assessment.dto.StudentAchievementDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BadgeSetService {

    @Autowired
    private BadgeSetRepository badgeSetRepository;

    @Autowired
    private BadgeDefinitionRepository badgeDefinitionRepository;

    @Autowired
    private StudentAchievementRepository studentAchievementRepository;

    @Autowired
    private TestRepository testRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private LanguageMasterBadgeRepository languageMasterBadgeRepository;

    @Autowired
    private StudentBadgeRepository studentBadgeRepository;

    @Autowired
    private OverallLeaderboardService overallLeaderboardService;

    @Autowired
    private SubjectRankingRepository subjectRankingRepository;

    @Autowired
    private QuestionService questionService;

    // --- Admin Badge Set CRUD ---

    @Transactional
    public BadgeSetDto createBadgeSet(BadgeSetDto dto) {
        Test test = testRepository.findById(dto.getTestId())
                .orElseThrow(() -> new RuntimeException("Test not found: " + dto.getTestId()));

        Subject subject = test.getSubject();
        if (dto.getTestCode() != null && !dto.getTestCode().trim().isEmpty()) {
            test.setTestCode(dto.getTestCode().trim());
        }
        if (dto.getTestName() != null && !dto.getTestName().trim().isEmpty()) {
            test.setName(dto.getTestName().trim());
        }
        testRepository.save(test);

        String testCode = (test.getTestCode() != null && !test.getTestCode().trim().isEmpty()) 
                ? test.getTestCode() 
                : ((subject != null ? subject.getName().replaceAll("[^a-zA-Z]", "").toUpperCase() : "JAVA") + "-" + String.format("%03d", test.getId()));

        List<BadgeSet> existingSets = badgeSetRepository.findByTestId(test.getId());
        if (existingSets != null && !existingSets.isEmpty()) {
            return updateBadgeSet(existingSets.get(0).getId(), dto);
        }

        BadgeSet set = BadgeSet.builder()
                .name(dto.getName() != null ? dto.getName() : test.getName() + " Badge Set")
                .test(test)
                .testCode(testCode)
                .subject(subject)
                .admin(test.getAdmin())
                .numberOfWinners(dto.getNumberOfWinners() != null ? dto.getNumberOfWinners() : 3)
                .enableLanguageBadge(dto.getEnableLanguageBadge() != null ? dto.getEnableLanguageBadge() : false)
                .languageName(dto.getLanguageName())
                .languageBadgeName(dto.getLanguageBadgeName())
                .languageBadgeIcon(dto.getLanguageBadgeIcon() != null ? dto.getLanguageBadgeIcon() : "☕")
                .languageAwardRank(dto.getLanguageAwardRank() != null ? dto.getLanguageAwardRank() : 1)
                .status("ACTIVE")
                .build();

        BadgeSet savedSet = badgeSetRepository.save(set);

        if (dto.getBadges() != null && !dto.getBadges().isEmpty()) {
            for (BadgeDefinitionDto bDto : dto.getBadges()) {
                saveBadgeDefinition(savedSet, bDto);
            }
        } else {
            seedDefaultDefinitions(savedSet);
        }

        if (savedSet.getTest() != null) {
            try {
                allocateBadgesForTest(savedSet.getTest().getId());
            } catch (Exception ignored) {}
        }

        return getBadgeSetById(savedSet.getId());
    }

    @Transactional
    public BadgeSetDto updateBadgeSet(Long id, BadgeSetDto dto) {
        BadgeSet set = badgeSetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge Set not found: " + id));

        set.setName(dto.getName());
        if (dto.getNumberOfWinners() != null) set.setNumberOfWinners(dto.getNumberOfWinners());
        if (dto.getEnableLanguageBadge() != null) set.setEnableLanguageBadge(dto.getEnableLanguageBadge());
        if (dto.getLanguageName() != null) set.setLanguageName(dto.getLanguageName());
        if (dto.getLanguageBadgeName() != null) set.setLanguageBadgeName(dto.getLanguageBadgeName());
        if (dto.getLanguageBadgeIcon() != null) set.setLanguageBadgeIcon(dto.getLanguageBadgeIcon());
        if (dto.getLanguageAwardRank() != null) set.setLanguageAwardRank(dto.getLanguageAwardRank());
        if (dto.getStatus() != null && !dto.getStatus().trim().isEmpty()) {
            set.setStatus(dto.getStatus().trim());
        }

        if (dto.getTestId() != null) {
            Test newTest = testRepository.findById(dto.getTestId()).orElse(null);
            if (newTest != null) {
                set.setTest(newTest);
                set.setSubject(newTest.getSubject());
                if (newTest.getTestCode() != null && !newTest.getTestCode().trim().isEmpty()) {
                    set.setTestCode(newTest.getTestCode().trim());
                }
            }
        }

        BadgeSet savedSet = badgeSetRepository.save(set);

        if (dto.getBadges() != null) {
            set.getBadges().clear();
            badgeSetRepository.saveAndFlush(set);
            
            for (BadgeDefinitionDto bDto : dto.getBadges()) {
                BadgeDefinition def = BadgeDefinition.builder()
                        .badgeSet(set)
                        .rankPosition(bDto.getRankPosition() != null ? bDto.getRankPosition() : 1)
                        .badgeName(bDto.getBadgeName() != null ? bDto.getBadgeName() : "Rank Badge")
                        .badgeIcon(bDto.getBadgeIcon() != null ? bDto.getBadgeIcon() : "Award")
                        .badgeColor(bDto.getBadgeColor() != null ? bDto.getBadgeColor() : "#f59e0b")
                        .badgeOrder(bDto.getBadgeOrder() != null ? bDto.getBadgeOrder() : bDto.getRankPosition())
                        .status("ACTIVE")
                        .build();
                set.getBadges().add(def);
            }
            savedSet = badgeSetRepository.save(set);
        }

        if (savedSet.getTest() != null) {
            try {
                allocateBadgesForTest(savedSet.getTest().getId());
            } catch (Exception ignored) {}
        }

        return getBadgeSetById(savedSet.getId());
    }

    @Transactional
    public void deleteBadgeSet(Long id) {
        BadgeSet set = badgeSetRepository.findById(id).orElse(null);
        if (set != null && set.getTest() != null) {
            // Cascade-delete all student achievements linked to this test
            try {
                studentAchievementRepository.deleteByTestId(set.getTest().getId());
            } catch (Exception ignored) {}
            // Cascade-delete language master badges linked to this test
            try {
                languageMasterBadgeRepository.deleteByTestId(set.getTest().getId());
            } catch (Exception ignored) {}
        }
        badgeSetRepository.deleteById(id);
    }

    @Transactional
    public void toggleBadgeSetStatus(Long id, String status) {
        BadgeSet set = badgeSetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge Set not found: " + id));
        set.setStatus(status);
        badgeSetRepository.save(set);
    }

    @Transactional
    public List<BadgeSetDto> getAllBadgeSets() {
        try {
            questionService.cleanupOrphanedRecordsAndEmptyTests();
        } catch (Exception ignored) {}

        List<BadgeSet> sets = badgeSetRepository.findAll();
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        
        List<BadgeSet> validSets = new ArrayList<>();
        for (BadgeSet bs : sets) {
            if (bs.getTest() != null && bs.getTest().getAdmin() != null && adminId != null && !bs.getTest().getAdmin().getId().equals(adminId)) {
                continue;
            }
            if (bs.getTest() != null && bs.getTest().getQuestions() != null && !bs.getTest().getQuestions().isEmpty()) {
                validSets.add(bs);
            }
        }
        
        return validSets.stream().map(this::mapBadgeSetToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BadgeSetDto getBadgeSetById(Long id) {
        BadgeSet set = badgeSetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge Set not found: " + id));
        return mapBadgeSetToDto(set);
    }

    @Transactional
    public List<StudentAchievementDto> getBadgeSetWinners(Long badgeSetId) {
        BadgeSet set = badgeSetRepository.findById(badgeSetId)
                .orElseThrow(() -> new RuntimeException("Badge Set not found: " + badgeSetId));
        if (set.getTest() == null) return Collections.emptyList();

        try {
            allocateBadgesForTest(set.getTest().getId());
        } catch (Exception ignored) {}

        List<StudentAchievement> achievements = studentAchievementRepository.findByTestIdOrderByAwardedAtDesc(set.getTest().getId());
        return achievements.stream()
                .map(this::mapAchievementToDto)
                .collect(Collectors.toList());
    }

    // --- Automatic Badge Allocation Engine ---

    @Transactional
    public List<StudentAchievement> allocateBadgesForTest(Long testId) {
        try {
            return doAllocateBadgesForTest(testId);
        } catch (Exception e) {
            // Catch ALL exceptions to prevent poisoning the parent transaction (submitTest).
            // This method runs within the same transaction as the caller (REQUIRED propagation),
            // so an uncaught exception would mark the transaction as rollback-only.
            System.err.println("[BadgeSetService] Non-fatal error in allocateBadgesForTest for testId=" + testId + ": " + e.getMessage());
            return Collections.emptyList();
        }
    }

    /**
     * Core badge allocation engine. Recalculates the top-N ranked students for a test
     * and dynamically reassigns rank badges (🥇🥈🥉) based on current scores.
     *
     * Ranking criteria (in order):
     *   1. score DESC (higher is better)
     *   2. testCasesPassed DESC (more is better)
     *   3. timeTakenSeconds ASC (faster is better)
     *   4. submittedAt ASC (earlier submission wins ties)
     *
     * Key design decisions:
     *   - Matches existing StudentAchievement by (student_id, test_id) — NOT by rank.
     *     This allows in-place updates when a student's rank changes, preventing
     *     duplicate notifications and badge count flickering.
     *   - Students who drop out of the top N have their achievement DELETED.
     *   - Uses findByTestId() for scoped, efficient queries (not findAll()).
     */
    private List<StudentAchievement> doAllocateBadgesForTest(Long testId) {
        Optional<BadgeSet> badgeSetOpt = badgeSetRepository.findByTestIdAndStatus(testId, "ACTIVE");
        if (badgeSetOpt.isEmpty()) {
            // No active badge set → clean up any stale achievements for this test
            studentAchievementRepository.deleteByTestId(testId);
            languageMasterBadgeRepository.deleteByTestId(testId);
            return Collections.emptyList();
        }

        BadgeSet badgeSet = badgeSetOpt.get();
        List<BadgeDefinition> definitions = badgeDefinitionRepository.findByBadgeSetIdAndStatus(badgeSet.getId(), "ACTIVE");
        definitions.sort(Comparator.comparingInt(BadgeDefinition::getRankPosition));

        // 1. Fetch all student tests for THIS test only (scoped, efficient)
        List<StudentTest> studentTests = studentTestRepository.findByTestId(testId).stream()
                .filter(st -> st.getStudent() != null && st.getScore() != null
                        && ("SUBMITTED".equalsIgnoreCase(st.getStatus())
                            || "EVALUATED".equalsIgnoreCase(st.getStatus())
                            || "COMPLETED".equalsIgnoreCase(st.getStatus())
                            || "PENDING".equalsIgnoreCase(st.getStatus())))
                .collect(Collectors.toList());

        // 2. Sort by: score DESC → testCasesPassed DESC → timeTakenSeconds ASC → submittedAt ASC
        studentTests.sort((a, b) -> {
            int scoreCompare = Integer.compare(b.getScore() != null ? b.getScore() : 0, a.getScore() != null ? a.getScore() : 0);
            if (scoreCompare != 0) return scoreCompare;

            int tcCompare = Integer.compare(b.getTestCasesPassed() != null ? b.getTestCasesPassed() : 0, a.getTestCasesPassed() != null ? a.getTestCasesPassed() : 0);
            if (tcCompare != 0) return tcCompare;

            long timeA = a.getTimeTakenSeconds() != null ? a.getTimeTakenSeconds() : Long.MAX_VALUE;
            long timeB = b.getTimeTakenSeconds() != null ? b.getTimeTakenSeconds() : Long.MAX_VALUE;
            int timeCompare = Long.compare(timeA, timeB);
            if (timeCompare != 0) return timeCompare;

            LocalDateTime subA = a.getSubmittedAt() != null ? a.getSubmittedAt() : (a.getCreatedAt() != null ? a.getCreatedAt() : LocalDateTime.MAX);
            LocalDateTime subB = b.getSubmittedAt() != null ? b.getSubmittedAt() : (b.getCreatedAt() != null ? b.getCreatedAt() : LocalDateTime.MAX);
            return subA.compareTo(subB);
        });

        // 3. Load all existing achievements and language badges for this test
        List<StudentAchievement> existingSAs = studentAchievementRepository.findByTestIdOrderByAwardedAtDesc(testId);
        List<LanguageMasterBadge> existingLMBs = languageMasterBadgeRepository.findByTestId(testId);

        // Build a map of studentId → existing StudentAchievement for fast lookup
        Map<Long, StudentAchievement> existingSAByStudent = new HashMap<>();
        for (StudentAchievement sa : existingSAs) {
            if (sa.getStudent() != null) {
                existingSAByStudent.put(sa.getStudent().getId(), sa);
            }
        }

        // Build a map of studentId → existing LanguageMasterBadge for fast lookup
        Map<Long, LanguageMasterBadge> existingLMBByStudent = new HashMap<>();
        for (LanguageMasterBadge lmb : existingLMBs) {
            if (lmb.getStudent() != null) {
                existingLMBByStudent.put(lmb.getStudent().getId(), lmb);
            }
        }

        // Track which students SHOULD have badges after this recalculation
        Set<Long> currentValidStudentIds = new HashSet<>();
        Set<Long> currentValidLMBStudentIds = new HashSet<>();
        List<StudentAchievement> currentValidSAs = new ArrayList<>();

        // 4. Assign ranks to the top N students
        int rank = 1;
        for (StudentTest st : studentTests) {
            if (rank > badgeSet.getNumberOfWinners()) break;

            final int currentRank = rank;
            BadgeDefinition def = definitions.stream()
                    .filter(d -> d.getRankPosition() == currentRank)
                    .findFirst()
                    .orElse(null);

            if (def != null && st.getStudent() != null) {
                User student = st.getStudent();
                Test test = st.getTest();
                Long studentId = student.getId();
                currentValidStudentIds.add(studentId);

                // Check if this student already has an achievement for this TEST (any rank)
                StudentAchievement existingSA = existingSAByStudent.get(studentId);

                if (existingSA != null) {
                    // Student already has an achievement for this test — check if rank changed
                    String expectedRankStr = "Badge " + currentRank;
                    if (!expectedRankStr.equals(existingSA.getRankAchieved())
                            || !def.getBadgeName().equals(existingSA.getBadgeName())) {
                        // Rank changed — UPDATE IN-PLACE (no delete+recreate, no duplicate notification)
                        existingSA.setBadgeName(def.getBadgeName());
                        existingSA.setBadgeIcon(def.getBadgeIcon());
                        existingSA.setRankAchieved(expectedRankStr);
                        existingSA.setUpdatedAt(LocalDateTime.now());
                        studentAchievementRepository.save(existingSA);
                    }
                    // Rank unchanged — no action needed
                    currentValidSAs.add(existingSA);
                } else {
                    // Brand new achievement — create and notify
                    User correctAdmin = resolveAdmin(test, student);
                    if (correctAdmin == null) {
                        System.err.println("[BadgeSetService] Cannot award StudentAchievement: no admin found for student=" + studentId);
                        rank++;
                        continue;
                    }

                    StudentAchievement sa = StudentAchievement.builder()
                            .student(student)
                            .admin(correctAdmin)
                            .badgeName(def.getBadgeName())
                            .badgeIcon(def.getBadgeIcon())
                            .badgeCategory("TEST_WINNER")
                            .test(test)
                            .testCode(badgeSet.getTestCode())
                            .testName(test.getName())
                            .subjectName(test.getSubject() != null ? test.getSubject().getName() : "")
                            .rankAchieved("Badge " + currentRank)
                            .awardedAt(LocalDateTime.now())
                            .awardedBy("SYSTEM")
                            .status("ACTIVE")
                            .build();
                    studentAchievementRepository.save(sa);
                    currentValidSAs.add(sa);

                    // Notify winner
                    try {
                        Notification notification = Notification.builder()
                                .user(student)
                                .admin(test.getAdmin())
                                .title("🏆 Congratulations! You earned a Badge!")
                                .message("You achieved Rank " + currentRank + " in '" + test.getName() + "' and earned the badge '" + def.getBadgeName() + "'!")
                                .type("BADGE_ALERT")
                                .isRead(false)
                                .build();
                        notificationRepository.save(notification);
                    } catch (Exception ignored) {}
                }
            }

            // Language Master Badge Auto Awarding
            if (badgeSet.getEnableLanguageBadge() != null && badgeSet.getEnableLanguageBadge()
                    && rank <= (badgeSet.getLanguageAwardRank() != null ? badgeSet.getLanguageAwardRank() : 1)) {

                User student = st.getStudent();
                Test test = st.getTest();
                Long studentId = student.getId();
                currentValidLMBStudentIds.add(studentId);

                String langName = badgeSet.getLanguageName() != null ? badgeSet.getLanguageName() : "Java";
                String badgeName = badgeSet.getLanguageBadgeName() != null ? badgeSet.getLanguageBadgeName() : "☕ " + langName + " Expert";
                String badgeIcon = badgeSet.getLanguageBadgeIcon() != null ? badgeSet.getLanguageBadgeIcon() : "☕";

                LanguageMasterBadge existingLMB = existingLMBByStudent.get(studentId);

                if (existingLMB != null) {
                    // Update in-place if rank changed
                    if (existingLMB.getAwardedRank() == null || !existingLMB.getAwardedRank().equals(rank)) {
                        existingLMB.setAwardedRank(rank);
                        existingLMB.setBadgeName(badgeName);
                        existingLMB.setBadgeIcon(badgeIcon);
                        languageMasterBadgeRepository.save(existingLMB);
                    }
                } else {
                    LanguageMasterBadge lmb = LanguageMasterBadge.builder()
                            .student(student)
                            .test(test)
                            .subject(test.getSubject() != null ? test.getSubject().getName() : "")
                            .badgeName(badgeName)
                            .badgeIcon(badgeIcon)
                            .awardedRank(rank)
                            .awardedDate(LocalDateTime.now())
                            .build();
                    languageMasterBadgeRepository.save(lmb);

                    try {
                        Notification langNotification = Notification.builder()
                                .user(student)
                                .admin(test.getAdmin())
                                .title("🎖️ Language Master Badge Earned!")
                                .message("You were awarded the '" + badgeName + "' badge for your performance in " + test.getName() + "!")
                                .type("BADGE_ALERT")
                                .isRead(false)
                                .build();
                        notificationRepository.save(langNotification);
                    } catch (Exception ignored) {}
                }
            }

            rank++;
        }

        // 5. Delete achievements for students who dropped OUT of the top N
        for (StudentAchievement oldSa : existingSAs) {
            if (oldSa.getStudent() != null && !currentValidStudentIds.contains(oldSa.getStudent().getId())) {
                studentAchievementRepository.delete(oldSa);
            }
        }

        // Delete language badges for students who dropped out
        for (LanguageMasterBadge oldLmb : existingLMBs) {
            if (oldLmb.getStudent() != null && !currentValidLMBStudentIds.contains(oldLmb.getStudent().getId())) {
                languageMasterBadgeRepository.delete(oldLmb);
            }
        }

        return currentValidSAs;
    }

    /**
     * Resolves the admin user for a badge assignment, with multiple fallbacks.
     */
    private User resolveAdmin(Test test, User student) {
        if (test.getAdmin() != null) return test.getAdmin();
        if (student.getAdmin() != null) return student.getAdmin();
        try {
            Long currentAdminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
            if (currentAdminId != null) {
                User admin = userRepository.findById(currentAdminId).orElse(null);
                if (admin != null) return admin;
            }
        } catch (Exception ignored) {}
        User admin = userRepository.findByUsername("admin_demo").orElse(null);
        if (admin != null) return admin;
        return userRepository.findAll().stream()
                .filter(u -> u.getRole() != null && u.getRole().toString().contains("ADMIN"))
                .findFirst()
                .orElse(null);
    }

    // --- Student & Admin Achievements ---

    @Transactional
    public List<StudentAchievementDto> getStudentAchievements(Long studentId) {
        // Dynamically trigger allocation for all tests completed by this student to ensure sync
        try {
            List<StudentTest> completedTests = studentTestRepository.findByStudentId(studentId).stream()
                    .filter(st -> st.getTest() != null && st.getSubmittedAt() != null)
                    .collect(Collectors.toList());
            for (StudentTest st : completedTests) {
                allocateBadgesForTest(st.getTest().getId());
            }
        } catch (Exception ignored) {}

        List<StudentAchievementDto> achievements = studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(studentId).stream()
                .map(this::mapAchievementToDto)
                .collect(Collectors.toCollection(ArrayList::new));

        // Merge manual badges
        List<StudentBadge> manualBadges = studentBadgeRepository.findByStudentId(studentId);
        for (StudentBadge sb : manualBadges) {
            StudentAchievementDto dto = StudentAchievementDto.builder()
                    .id(sb.getId())
                    .studentId(studentId)
                    .studentName(sb.getStudent().getName())
                    .studentRegisterNumber(sb.getStudent().getRegisterNumber())
                    .badgeName(sb.getBadge().getName())
                    .badgeIcon(sb.getBadge().getIcon())
                    .badgeCategory(sb.getBadge().getType() != null ? sb.getBadge().getType() : "CUSTOM")
                    .testId(sb.getSourceTest() != null ? sb.getSourceTest().getId() : null)
                    .testCode(sb.getSourceTest() != null ? sb.getSourceTest().getTestCode() : null)
                    .testName(sb.getSourceTest() != null ? sb.getSourceTest().getName() : null)
                    .subjectName(sb.getSourceTest() != null && sb.getSourceTest().getSubject() != null ? sb.getSourceTest().getSubject().getName() : null)
                    .awardedAt(sb.getEarnedAt())
                    .awardedBy(sb.getBadge().getAdmin() != null ? sb.getBadge().getAdmin().getName() : "Administrator")
                    .status(sb.getStatus())
                    .build();
            achievements.add(dto);
        }

        achievements.sort((a, b) -> b.getAwardedAt().compareTo(a.getAwardedAt()));
        return achievements;
    }

    @Transactional(readOnly = true)
    public List<LanguageMasterBadgeDto> getStudentLanguageBadges(Long studentId) {
        return languageMasterBadgeRepository.findByStudentIdOrderByAwardedDateDesc(studentId).stream()
                .map(lmb -> {
                    String effectiveTestCode = null;
                    String effectiveTestName = lmb.getTest() != null ? lmb.getTest().getName() : null;
                    if (lmb.getTest() != null) {
                        if (lmb.getTest().getQuestions() != null && !lmb.getTest().getQuestions().isEmpty()) {
                            for (Question q : lmb.getTest().getQuestions()) {
                                if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty()) {
                                    effectiveTestCode = q.getQuestionCode().trim().toUpperCase();
                                    break;
                                }
                            }
                        }
                        if (effectiveTestCode == null || effectiveTestCode.trim().isEmpty()) {
                            effectiveTestCode = lmb.getTest().getTestCode();
                        }
                    }

                    return LanguageMasterBadgeDto.builder()
                            .id(lmb.getId())
                            .studentId(lmb.getStudent().getId())
                            .studentName(lmb.getStudent().getName())
                            .studentRegisterNumber(lmb.getStudent().getRegisterNumber())
                            .testId(lmb.getTest() != null ? lmb.getTest().getId() : null)
                            .testCode(effectiveTestCode)
                            .testName(effectiveTestName)
                            .subject(lmb.getSubject())
                            .badgeName(lmb.getBadgeName())
                            .badgeIcon(lmb.getBadgeIcon())
                            .awardedRank(lmb.getAwardedRank())
                            .awardedDate(lmb.getAwardedDate())
                            .build();
                })
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<StudentAchievementDto> getAllStudentAchievements() {
        // Fetch all overall leaderboard entries once to avoid N+1 problem
        List<com.chillcode.assessment.service.OverallLeaderboardService.OverallLeaderboardEntry> overallLeaderboard = overallLeaderboardService.getOverallLeaderboard("ALL", "ALL");
        Map<Long, Integer> overallRankMap = new HashMap<>();
        for (com.chillcode.assessment.service.OverallLeaderboardService.OverallLeaderboardEntry entry : overallLeaderboard) {
            if (entry.studentId != null) {
                overallRankMap.put(entry.studentId, entry.rankPosition);
            }
        }

        // Fetch all subject rankings and group by studentId and subjectName
        List<SubjectRanking> allSubjectRankings = subjectRankingRepository.findAll();
        Map<String, Integer> subjectRankMap = new HashMap<>();
        for (SubjectRanking sr : allSubjectRankings) {
            if (sr.getStudent() != null && sr.getSubject() != null) {
                String key = sr.getStudent().getId() + "-" + sr.getSubject().getName();
                subjectRankMap.put(key, sr.getRankPosition());
            }
        }

        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();

        List<StudentAchievementDto> list = studentAchievementRepository.findAll().stream()
                .filter(sa -> adminId == null || (sa.getTest() != null && sa.getTest().getAdmin() != null && sa.getTest().getAdmin().getId().equals(adminId)))
                .map(sa -> mapAchievementToDtoWithRanks(sa, overallRankMap, subjectRankMap))
                .collect(Collectors.toCollection(ArrayList::new));

        // Merge manual badges
        List<StudentBadge> manualBadges = studentBadgeRepository.findAll();
        for (StudentBadge sb : manualBadges) {
            Long badgeAdminId = sb.getBadge().getAdmin() != null ? sb.getBadge().getAdmin().getId() : null;
            if (adminId != null && badgeAdminId != null && !badgeAdminId.equals(adminId)) {
                continue;
            }

            StudentAchievementDto dto = StudentAchievementDto.builder()
                    .id(sb.getId() + 1000000L) // Avoid collision
                    .studentId(sb.getStudent().getId())
                    .studentName(sb.getStudent().getName())
                    .studentRegisterNumber(sb.getStudent().getRegisterNumber())
                    .badgeName(sb.getBadge().getName())
                    .badgeIcon(sb.getBadge().getIcon())
                    .badgeCategory(sb.getBadge().getType() != null ? sb.getBadge().getType() : "CUSTOM")
                    .testId(sb.getSourceTest() != null ? sb.getSourceTest().getId() : null)
                    .testCode(sb.getSourceTest() != null ? sb.getSourceTest().getTestCode() : null)
                    .testName(sb.getSourceTest() != null ? sb.getSourceTest().getName() : null)
                    .subjectName(sb.getSourceTest() != null && sb.getSourceTest().getSubject() != null ? sb.getSourceTest().getSubject().getName() : null)
                    .awardedAt(sb.getEarnedAt())
                    .awardedBy(sb.getBadge().getAdmin() != null ? sb.getBadge().getAdmin().getName() : "Administrator")
                    .status(sb.getStatus())
                    .build();
            list.add(dto);
        }

        list.sort((a, b) -> b.getAwardedAt().compareTo(a.getAwardedAt()));
        return list;
    }

    // --- Helper Methods ---

    private void seedDefaultDefinitions(BadgeSet set) {
        saveBadgeDefinition(set, BadgeDefinitionDto.builder().rankPosition(1).badgeName("🥇 Gold Champion").badgeIcon("Award").badgeColor("#f59e0b").badgeOrder(1).build());
        saveBadgeDefinition(set, BadgeDefinitionDto.builder().rankPosition(2).badgeName("🥈 Silver Champion").badgeIcon("Award").badgeColor("#94a3b8").badgeOrder(2).build());
        saveBadgeDefinition(set, BadgeDefinitionDto.builder().rankPosition(3).badgeName("🥉 Bronze Champion").badgeIcon("Award").badgeColor("#b45309").badgeOrder(3).build());
    }

    private void saveBadgeDefinition(BadgeSet set, BadgeDefinitionDto dto) {
        BadgeDefinition def = BadgeDefinition.builder()
                .badgeSet(set)
                .rankPosition(dto.getRankPosition() != null ? dto.getRankPosition() : 1)
                .badgeName(dto.getBadgeName() != null ? dto.getBadgeName() : "Rank Badge")
                .badgeIcon(dto.getBadgeIcon() != null ? dto.getBadgeIcon() : "Award")
                .badgeColor(dto.getBadgeColor() != null ? dto.getBadgeColor() : "#f59e0b")
                .badgeOrder(dto.getBadgeOrder() != null ? dto.getBadgeOrder() : dto.getRankPosition())
                .status("ACTIVE")
                .build();
        badgeDefinitionRepository.save(def);
    }

    private BadgeSetDto mapBadgeSetToDto(BadgeSet set) {
        List<BadgeDefinitionDto> badgeDtos = badgeDefinitionRepository.findByBadgeSetIdOrderByRankPositionAsc(set.getId()).stream()
                .map(b -> BadgeDefinitionDto.builder()
                        .id(b.getId())
                        .badgeSetId(set.getId())
                        .rankPosition(b.getRankPosition())
                        .badgeName(b.getBadgeName())
                        .badgeIcon(b.getBadgeIcon())
                        .badgeColor(b.getBadgeColor())
                        .badgeOrder(b.getBadgeOrder())
                        .status(b.getStatus())
                        .build())
                .collect(Collectors.toList());

        // Resolve effective testCode from Question's questionCode (the admin-entered Unique ID)
        String effectiveTestCode = null;
        String effectiveTestName = null;

        if (set.getTest() != null && set.getTest().getQuestions() != null) {
            for (Question q : set.getTest().getQuestions()) {
                // Use the Question's questionCode as the authoritative Test ID
                if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty()) {
                    effectiveTestCode = q.getQuestionCode().trim().toUpperCase();
                }
                // Use the Question's title as the test name
                if (q.getTitle() != null && !q.getTitle().trim().isEmpty()) {
                    effectiveTestName = q.getTitle();
                }
                break; // One question per test in the new model
            }
        }

        // Fallback to stored testCode on the BadgeSet/Test
        if (effectiveTestCode == null || effectiveTestCode.trim().isEmpty()) {
            effectiveTestCode = set.getTestCode();
        }
        if (effectiveTestCode == null || effectiveTestCode.trim().isEmpty()) {
            effectiveTestCode = set.getTest() != null ? set.getTest().getTestCode() : "N/A";
        }

        if (effectiveTestName == null || effectiveTestName.trim().isEmpty()) {
            effectiveTestName = (set.getTest() != null && set.getTest().getName() != null)
                    ? set.getTest().getName() : set.getName();
        }

        return BadgeSetDto.builder()
                .id(set.getId())
                .name(set.getName())
                .testId(set.getTest() != null ? set.getTest().getId() : null)
                .testCode(effectiveTestCode)
                .testName(effectiveTestName)
                .subjectId(set.getSubject() != null ? set.getSubject().getId() : null)
                .subjectName(set.getSubject() != null ? set.getSubject().getName() : "")
                .numberOfWinners(set.getNumberOfWinners())
                .enableLanguageBadge(set.getEnableLanguageBadge())
                .languageName(set.getLanguageName())
                .languageBadgeName(set.getLanguageBadgeName())
                .languageBadgeIcon(set.getLanguageBadgeIcon())
                .languageAwardRank(set.getLanguageAwardRank())
                .status(set.getStatus())
                .createdAt(set.getCreatedAt())
                .updatedAt(set.getUpdatedAt())
                .badges(badgeDtos)
                .build();
    }

    private StudentAchievementDto mapAchievementToDto(StudentAchievement sa) {
        return mapAchievementToDtoWithRanks(sa, new HashMap<>(), new HashMap<>());
    }

    private StudentAchievementDto mapAchievementToDtoWithRanks(StudentAchievement sa, Map<Long, Integer> overallRankMap, Map<String, Integer> subjectRankMap) {
        Long studentId = sa.getStudent() != null ? sa.getStudent().getId() : null;
        Integer overallRank = studentId != null ? overallRankMap.get(studentId) : null;
        
        Integer subjectRank = null;
        if (studentId != null && sa.getSubjectName() != null) {
            subjectRank = subjectRankMap.get(studentId + "-" + sa.getSubjectName());
        }

        String effectiveTestCode = sa.getTestCode();
        String effectiveTestName = sa.getTestName();
        if (sa.getTest() != null) {
            if (sa.getTest().getName() != null && !sa.getTest().getName().trim().isEmpty()) {
                effectiveTestName = sa.getTest().getName();
            }
            if (sa.getTest().getQuestions() != null && !sa.getTest().getQuestions().isEmpty()) {
                for (Question q : sa.getTest().getQuestions()) {
                    if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty()) {
                        effectiveTestCode = q.getQuestionCode().trim().toUpperCase();
                        break;
                    }
                }
            }
            if ((effectiveTestCode == null || effectiveTestCode.trim().isEmpty()) && sa.getTest().getTestCode() != null) {
                effectiveTestCode = sa.getTest().getTestCode();
            }
        }

        return StudentAchievementDto.builder()
                .id(sa.getId())
                .studentId(sa.getStudent() != null ? sa.getStudent().getId() : null)
                .studentName(sa.getStudent() != null ? sa.getStudent().getName() : "")
                .studentRegisterNumber(sa.getStudent() != null ? sa.getStudent().getRegisterNumber() : "")
                .badgeName(sa.getBadgeName())
                .badgeIcon(sa.getBadgeIcon())
                .badgeCategory(sa.getBadgeCategory())
                .testId(sa.getTest() != null ? sa.getTest().getId() : null)
                .testCode(effectiveTestCode)
                .testName(effectiveTestName)
                .subjectName(sa.getSubjectName())
                .subjectRank(subjectRank)
                .overallRank(overallRank)
                .rankAchieved(sa.getRankAchieved())
                .awardedAt(sa.getAwardedAt())
                .awardedBy(sa.getAwardedBy())
                .status(sa.getStatus())
                .build();
    }
}
