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
    private OverallLeaderboardService overallLeaderboardService;

    @Autowired
    private SubjectRankingRepository subjectRankingRepository;

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

        return getBadgeSetById(savedSet.getId());
    }

    @Transactional
    public void deleteBadgeSet(Long id) {
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
        List<BadgeSet> sets = badgeSetRepository.findAll();
        for (BadgeSet bs : sets) {
            if (bs.getTest() != null && bs.getTest().getQuestions() != null) {
                for (Question q : bs.getTest().getQuestions()) {
                    if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty()) {
                        String qCode = q.getQuestionCode().trim().toUpperCase();
                        if (!qCode.equals(bs.getTestCode())) {
                            bs.setTestCode(qCode);
                            if (bs.getTest() != null) {
                                bs.getTest().setTestCode(qCode);
                                testRepository.save(bs.getTest());
                            }
                            badgeSetRepository.save(bs);
                        }
                        break;
                    }
                }
            }
        }
        return sets.stream().map(this::mapBadgeSetToDto).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public BadgeSetDto getBadgeSetById(Long id) {
        BadgeSet set = badgeSetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge Set not found: " + id));
        return mapBadgeSetToDto(set);
    }

    // --- Automatic Badge Allocation Engine ---

    @Transactional
    public List<StudentAchievement> allocateBadgesForTest(Long testId) {
        Optional<BadgeSet> badgeSetOpt = badgeSetRepository.findByTestIdAndStatus(testId, "ACTIVE");
        if (badgeSetOpt.isEmpty()) return Collections.emptyList();

        BadgeSet badgeSet = badgeSetOpt.get();
        List<BadgeDefinition> definitions = badgeDefinitionRepository.findByBadgeSetIdAndStatus(badgeSet.getId(), "ACTIVE");

        definitions.sort(Comparator.comparingInt(BadgeDefinition::getRankPosition));

        // Fetch all evaluated / submitted student tests for this test
        List<StudentTest> studentTests = studentTestRepository.findAll().stream()
                .filter(st -> st.getTest() != null && st.getTest().getId().equals(testId)
                        && ("SUBMITTED".equalsIgnoreCase(st.getStatus()) || "EVALUATED".equalsIgnoreCase(st.getStatus()) || "COMPLETED".equalsIgnoreCase(st.getStatus())))
                .collect(Collectors.toList());

        // Sort by Priority: 1. Highest Marks, 2. Highest Test Cases Passed, 3. Lowest Time Taken, 4. Earliest Submission
        studentTests.sort((a, b) -> {
            int scoreCompare = Integer.compare(b.getScore() != null ? b.getScore() : 0, a.getScore() != null ? a.getScore() : 0);
            if (scoreCompare != 0) return scoreCompare;

            int tcCompare = Integer.compare(b.getTestCasesPassed() != null ? b.getTestCasesPassed() : 0, a.getTestCasesPassed() != null ? a.getTestCasesPassed() : 0);
            if (tcCompare != 0) return tcCompare;

            long timeA = a.getTimeTakenSeconds() != null ? a.getTimeTakenSeconds() : Long.MAX_VALUE;
            long timeB = b.getTimeTakenSeconds() != null ? b.getTimeTakenSeconds() : Long.MAX_VALUE;
            int timeCompare = Long.compare(timeA, timeB);
            if (timeCompare != 0) return timeCompare;

            LocalDateTime subA = a.getSubmittedAt() != null ? a.getSubmittedAt() : a.getCreatedAt();
            LocalDateTime subB = b.getSubmittedAt() != null ? b.getSubmittedAt() : b.getCreatedAt();
            return subA.compareTo(subB);
        });

        List<StudentAchievement> allocated = new ArrayList<>();
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

                boolean alreadyAwarded = studentAchievementRepository
                        .findByStudentIdAndTestId(student.getId(), test.getId()).stream()
                        .anyMatch(sa -> sa.getRankAchieved() != null && sa.getRankAchieved().equals("Badge " + currentRank));

                if (!alreadyAwarded) {
                    StudentAchievement sa = StudentAchievement.builder()
                            .student(student)
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
                    allocated.add(sa);

                    // Notify winner
                    Notification notification = Notification.builder()
                            .user(student)
                            .title("🏆 Congratulations! You earned a Badge!")
                            .message("You achieved Rank " + currentRank + " in '" + test.getName() + "' and earned the badge '" + def.getBadgeName() + "'!")
                            .type("BADGE_ALERT")
                            .isRead(false)
                            .build();
                    notificationRepository.save(notification);
                }
            }

            // Language Master Badge Auto Awarding
            if (badgeSet.getEnableLanguageBadge() != null && badgeSet.getEnableLanguageBadge()
                    && rank <= (badgeSet.getLanguageAwardRank() != null ? badgeSet.getLanguageAwardRank() : 1)) {

                User student = st.getStudent();
                Test test = st.getTest();
                String langName = badgeSet.getLanguageName() != null ? badgeSet.getLanguageName() : "Java";
                String badgeName = badgeSet.getLanguageBadgeName() != null ? badgeSet.getLanguageBadgeName() : "☕ " + langName + " Expert";
                String badgeIcon = badgeSet.getLanguageBadgeIcon() != null ? badgeSet.getLanguageBadgeIcon() : "☕";

                boolean alreadyAwardedLang = languageMasterBadgeRepository
                        .findByStudentIdOrderByAwardedDateDesc(student.getId()).stream()
                        .anyMatch(lmb -> lmb.getTest() != null && lmb.getTest().getId().equals(test.getId()) && lmb.getAwardedRank() != null && lmb.getAwardedRank() == currentRank);

                if (!alreadyAwardedLang) {
                    LanguageMasterBadge lmb = LanguageMasterBadge.builder()
                            .student(student)
                            .test(test)
                            .subject(test.getSubject() != null ? test.getSubject().getName() : "")
                            .badgeName(badgeName)
                            .badgeIcon(badgeIcon)
                            .awardedRank(currentRank)
                            .awardedDate(LocalDateTime.now())
                            .build();
                    languageMasterBadgeRepository.save(lmb);

                    Notification langNotification = Notification.builder()
                            .user(student)
                            .title("🎖️ Language Master Badge Earned!")
                            .message("You were awarded the '" + badgeName + "' badge for your performance in " + test.getName() + "!")
                            .type("BADGE_ALERT")
                            .isRead(false)
                            .build();
                    notificationRepository.save(langNotification);
                }
            }

            rank++;
        }

        return allocated;
    }

    // --- Student & Admin Achievements ---

    @Transactional(readOnly = true)
    public List<StudentAchievementDto> getStudentAchievements(Long studentId) {
        List<Submission> subs = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(studentId);
        return studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(studentId).stream()
                .filter(sa -> sa.getTest() != null && sa.getTest().getQuestions() != null && !sa.getTest().getQuestions().isEmpty())
                .filter(sa -> subs.stream().anyMatch(sub -> sub.getQuestion() != null && 
                        sa.getTest().getQuestions().contains(sub.getQuestion()) && 
                        ("ACCEPTED".equals(sub.getStatus()) || "PASS".equalsIgnoreCase(sub.getOverallResult()))))
                .map(this::mapAchievementToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LanguageMasterBadgeDto> getStudentLanguageBadges(Long studentId) {
        List<Submission> subs = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(studentId);
        return languageMasterBadgeRepository.findByStudentIdOrderByAwardedDateDesc(studentId).stream()
                .filter(lmb -> lmb.getTest() != null && lmb.getTest().getQuestions() != null && !lmb.getTest().getQuestions().isEmpty())
                .filter(lmb -> subs.stream().anyMatch(sub -> sub.getQuestion() != null && 
                        lmb.getTest().getQuestions().contains(sub.getQuestion()) && 
                        ("ACCEPTED".equals(sub.getStatus()) || "PASS".equalsIgnoreCase(sub.getOverallResult()))))
                .map(lmb -> LanguageMasterBadgeDto.builder()
                        .id(lmb.getId())
                        .studentId(lmb.getStudent().getId())
                        .studentName(lmb.getStudent().getName())
                        .studentRegisterNumber(lmb.getStudent().getRegisterNumber())
                        .testId(lmb.getTest().getId())
                        .testCode(lmb.getTest().getTestCode())
                        .testName(lmb.getTest().getName())
                        .subject(lmb.getSubject())
                        .badgeName(lmb.getBadgeName())
                        .badgeIcon(lmb.getBadgeIcon())
                        .awardedRank(lmb.getAwardedRank())
                        .awardedDate(lmb.getAwardedDate())
                        .build())
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

        return studentAchievementRepository.findAll().stream()
                .filter(sa -> sa.getTest() != null && sa.getTest().getQuestions() != null && !sa.getTest().getQuestions().isEmpty())
                .map(sa -> mapAchievementToDtoWithRanks(sa, overallRankMap, subjectRankMap))
                .collect(Collectors.toList());
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

        String effectiveTestCode = null;

        // Top Priority: Custom Question ID (questionCode, e.g. "JAVA-2") set on any question linked to this test
        if (set.getTest() != null && set.getTest().getQuestions() != null) {
            for (Question q : set.getTest().getQuestions()) {
                if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty()) {
                    effectiveTestCode = q.getQuestionCode().trim().toUpperCase();
                    break;
                }
            }
        }

        // Second Priority: Test Code set on BadgeSet or Test
        if ((effectiveTestCode == null || effectiveTestCode.trim().isEmpty()) && set.getTestCode() != null && !set.getTestCode().trim().isEmpty()) {
            effectiveTestCode = set.getTestCode().trim().toUpperCase();
        }

        if ((effectiveTestCode == null || effectiveTestCode.trim().isEmpty()) && set.getTest() != null && set.getTest().getTestCode() != null && !set.getTest().getTestCode().trim().isEmpty()) {
            effectiveTestCode = set.getTest().getTestCode().trim().toUpperCase();
        }

        // Fallback: Subject name prefix + Test ID
        if (effectiveTestCode == null || effectiveTestCode.trim().isEmpty() || effectiveTestCode.startsWith("TEST-")) {
            String subName = set.getSubject() != null ? set.getSubject().getName() : (set.getTest() != null && set.getTest().getSubject() != null ? set.getTest().getSubject().getName() : "JAVA");
            String prefix = subName.replaceAll("[^a-zA-Z]", "").toUpperCase();
            if (prefix.length() > 6) prefix = prefix.substring(0, 6);
            if (prefix.isEmpty()) prefix = "JAVA";
            effectiveTestCode = prefix + "-" + String.format("%03d", (set.getTest() != null ? set.getTest().getId() : set.getId()));
        }

        String effectiveTestName = (set.getTest() != null && set.getTest().getName() != null && !set.getTest().getName().trim().isEmpty())
                ? set.getTest().getName()
                : "";

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

        return StudentAchievementDto.builder()
                .id(sa.getId())
                .studentId(sa.getStudent() != null ? sa.getStudent().getId() : null)
                .studentName(sa.getStudent() != null ? sa.getStudent().getName() : "")
                .studentRegisterNumber(sa.getStudent() != null ? sa.getStudent().getRegisterNumber() : "")
                .badgeName(sa.getBadgeName())
                .badgeIcon(sa.getBadgeIcon())
                .badgeCategory(sa.getBadgeCategory())
                .testId(sa.getTest() != null ? sa.getTest().getId() : null)
                .testCode(sa.getTestCode())
                .testName(sa.getTestName())
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
