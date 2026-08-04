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
    private NotificationRepository notificationRepository;

    @Autowired
    private LanguageMasterBadgeRepository languageMasterBadgeRepository;

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
        if (dto.getStatus() != null) set.setStatus(dto.getStatus());

        if (set.getTest() != null) {
            Test test = set.getTest();
            boolean updated = false;
            if (dto.getTestCode() != null && !dto.getTestCode().trim().isEmpty()) {
                test.setTestCode(dto.getTestCode().trim());
                set.setTestCode(dto.getTestCode().trim());
                updated = true;
            }
            if (dto.getTestName() != null && !dto.getTestName().trim().isEmpty()) {
                test.setName(dto.getTestName().trim());
                updated = true;
            }
            if (updated) {
                testRepository.save(test);
            }
        }

        BadgeSet savedSet = badgeSetRepository.save(set);

        if (dto.getBadges() != null) {
            List<BadgeDefinition> existing = badgeDefinitionRepository.findByBadgeSetIdOrderByRankPositionAsc(id);
            badgeDefinitionRepository.deleteAll(existing);
            for (BadgeDefinitionDto bDto : dto.getBadges()) {
                saveBadgeDefinition(savedSet, bDto);
            }
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
                    if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty() && !q.getQuestionCode().trim().startsWith("TEST-")) {
                        String qCode = q.getQuestionCode().trim().toUpperCase();
                        if (!qCode.equals(bs.getTestCode())) {
                            bs.setTestCode(qCode);
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
            User student = st.getStudent();
            if (student == null) continue;

            final int currentRank = rank;
            Optional<BadgeDefinition> defOpt = definitions.stream().filter(d -> d.getRankPosition().equals(currentRank)).findFirst();
            if (defOpt.isPresent()) {
                BadgeDefinition def = defOpt.get();
                String rankAchievedStr = "Badge " + currentRank;

                // Idempotent allocation check for standard winner badges
                if (studentAchievementRepository.findByStudentIdAndTestIdAndRankAchieved(student.getId(), testId, rankAchievedStr).isEmpty()) {
                    StudentAchievement sa = StudentAchievement.builder()
                            .student(student)
                            .badgeName(def.getBadgeName())
                            .badgeIcon(def.getBadgeIcon())
                            .badgeCategory("Test Ranking")
                            .test(st.getTest())
                            .testCode(st.getTest().getTestCode())
                            .testName(st.getTest().getName())
                            .subjectName(st.getTest().getSubject() != null ? st.getTest().getSubject().getName() : "")
                            .rankAchieved(rankAchievedStr)
                            .awardedAt(LocalDateTime.now())
                            .awardedBy("Automatic System")
                            .status("ACTIVE")
                            .build();

                    sa = studentAchievementRepository.save(sa);
                    allocated.add(sa);

                    // Notify winner
                    Notification notification = Notification.builder()
                            .user(student)
                            .title("🎉 Badge Unlocked: " + def.getBadgeName())
                            .message("Congratulations! You achieved Rank " + currentRank + " in '" + st.getTest().getName() + "' and earned '" + def.getBadgeName() + "'!")
                            .type("ACHIEVEMENT")
                            .isRead(false)
                            .build();
                    notificationRepository.save(notification);
                }
            }

            // Language Master Badge Allocation Engine
            if (Boolean.TRUE.equals(badgeSet.getEnableLanguageBadge())) {
                int targetRank = badgeSet.getLanguageAwardRank() != null ? badgeSet.getLanguageAwardRank() : 1;
                if (currentRank == targetRank) {
                    String langBadgeName = badgeSet.getLanguageBadgeName() != null ? badgeSet.getLanguageBadgeName() : "Language Master";
                    if (languageMasterBadgeRepository.findByStudentIdAndTestIdAndBadgeName(student.getId(), testId, langBadgeName).isEmpty()) {
                        LanguageMasterBadge lmb = LanguageMasterBadge.builder()
                                .student(student)
                                .test(st.getTest())
                                .subject(st.getTest().getSubject() != null ? st.getTest().getSubject().getName() : "General")
                                .badgeName(langBadgeName)
                                .badgeIcon(badgeSet.getLanguageBadgeIcon() != null ? badgeSet.getLanguageBadgeIcon() : "☕")
                                .awardedRank(currentRank)
                                .awardedDate(LocalDateTime.now())
                                .build();
                        languageMasterBadgeRepository.save(lmb);

                        Notification notification = Notification.builder()
                                .user(student)
                                .title("🎉 Language Master Badge Unlocked: " + langBadgeName)
                                .message("Awarded for securing Rank " + currentRank + " in '" + st.getTest().getName() + "'.")
                                .type("ACHIEVEMENT")
                                .isRead(false)
                                .build();
                        notificationRepository.save(notification);
                    }
                }
            }

            rank++;
        }

        return allocated;
    }

    // --- Student & Admin Achievements ---

    @Transactional(readOnly = true)
    public List<StudentAchievementDto> getStudentAchievements(Long studentId) {
        return studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(studentId).stream()
                .map(this::mapAchievementToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LanguageMasterBadgeDto> getStudentLanguageBadges(Long studentId) {
        return languageMasterBadgeRepository.findByStudentIdOrderByAwardedDateDesc(studentId).stream()
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
        return studentAchievementRepository.findAll().stream()
                .map(this::mapAchievementToDto)
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

        if (set.getTestCode() != null && !set.getTestCode().trim().isEmpty() && !set.getTestCode().trim().startsWith("TEST-") && !set.getTestCode().trim().startsWith("JAVAPR-")) {
            effectiveTestCode = set.getTestCode().trim();
        }

        if ((effectiveTestCode == null || effectiveTestCode.startsWith("TEST-") || effectiveTestCode.startsWith("JAVAPR-")) && set.getTest() != null && set.getTest().getQuestions() != null) {
            for (Question q : set.getTest().getQuestions()) {
                if (q.getQuestionCode() != null && !q.getQuestionCode().trim().isEmpty() && !q.getQuestionCode().trim().startsWith("TEST-")) {
                    effectiveTestCode = q.getQuestionCode().trim();
                    break;
                }
            }
        }

        if ((effectiveTestCode == null || effectiveTestCode.startsWith("TEST-")) && set.getTestCode() != null && !set.getTestCode().trim().isEmpty()) {
            effectiveTestCode = set.getTestCode().trim();
        }

        if ((effectiveTestCode == null || effectiveTestCode.startsWith("TEST-")) && set.getTest() != null && set.getTest().getTestCode() != null && !set.getTest().getTestCode().trim().isEmpty()) {
            effectiveTestCode = set.getTest().getTestCode().trim();
        }

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
                .rankAchieved(sa.getRankAchieved())
                .awardedAt(sa.getAwardedAt())
                .awardedBy(sa.getAwardedBy())
                .status(sa.getStatus())
                .build();
    }
}
