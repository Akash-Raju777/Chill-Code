package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.BadgeDto;
import com.chillcode.assessment.dto.BadgeRuleDto;
import com.chillcode.assessment.dto.StudentBadgeDto;
import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class BadgeService {

    @Autowired
    private BadgeRepository badgeRepository;

    @Autowired
    private BadgeRuleRepository badgeRuleRepository;

    @Autowired
    private StudentBadgeRepository studentBadgeRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private TestRepository testRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SubjectRankingRepository subjectRankingRepository;

    // --- Admin Badge CRUD ---

    @Transactional
    public BadgeDto createBadge(BadgeDto dto) {
        User admin = com.chillcode.assessment.security.SecurityUtils.getCurrentUser();
        Badge badge = Badge.builder()
                .name(dto.getName())
                .description(dto.getDescription())
                .icon(dto.getIcon() != null ? dto.getIcon() : "Award")
                .type(dto.getType() != null ? dto.getType() : "CUSTOM")
                .status(dto.getStatus() != null ? dto.getStatus() : "ACTIVE")
                .admin(admin)
                .build();
        badge = badgeRepository.save(badge);

        if (dto.getRules() != null && !dto.getRules().isEmpty()) {
            for (BadgeRuleDto rDto : dto.getRules()) {
                saveRule(badge, rDto);
            }
        }
        return getBadgeById(badge.getId());
    }

    @Transactional
    public BadgeDto updateBadge(Long id, BadgeDto dto) {
        Badge badge = badgeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge not found: " + id));

        badge.setName(dto.getName());
        badge.setDescription(dto.getDescription());
        if (dto.getIcon() != null) badge.setIcon(dto.getIcon());
        if (dto.getType() != null) badge.setType(dto.getType());
        if (dto.getStatus() != null) badge.setStatus(dto.getStatus());
        badge = badgeRepository.save(badge);

        if (dto.getRules() != null) {
            // Remove existing rules and re-add
            List<BadgeRule> existing = badgeRuleRepository.findByBadgeId(id);
            badgeRuleRepository.deleteAll(existing);
            for (BadgeRuleDto rDto : dto.getRules()) {
                saveRule(badge, rDto);
            }
        }
        return getBadgeById(badge.getId());
    }

    @Transactional
    public void deleteBadge(Long id) {
        badgeRepository.deleteById(id);
    }

    @Transactional
    public void toggleBadgeStatus(Long id, String status) {
        Badge badge = badgeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge not found: " + id));
        badge.setStatus(status);
        badgeRepository.save(badge);
    }

    public List<BadgeDto> getAllBadges() {
        return badgeRepository.findAll().stream().map(this::mapBadgeToDto).collect(Collectors.toList());
    }

    public BadgeDto getBadgeById(Long id) {
        Badge badge = badgeRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Badge not found: " + id));
        return mapBadgeToDto(badge);
    }

    // --- Student & Admin Achievements ---

    public List<StudentBadgeDto> getStudentBadges(Long studentId) {
        return studentBadgeRepository.findByStudentId(studentId).stream()
                .filter(sb -> sb.getSourceTest() == null || (sb.getSourceTest().getQuestions() != null && !sb.getSourceTest().getQuestions().isEmpty()))
                .map(this::mapStudentBadgeToDto)
                .collect(Collectors.toList());
    }

    public List<BadgeDto> getBadgesForStudentWithLockStatus(Long studentId) {
        Set<Long> earnedBadgeIds = studentBadgeRepository.findByStudentId(studentId).stream()
                .map(sb -> sb.getBadge().getId())
                .collect(Collectors.toSet());

        Map<Long, LocalDateTime> earnedDateMap = studentBadgeRepository.findByStudentId(studentId).stream()
                .collect(Collectors.toMap(sb -> sb.getBadge().getId(), StudentBadge::getEarnedAt, (a, b) -> a));

        return badgeRepository.findByStatus("ACTIVE").stream().map(badge -> {
            BadgeDto dto = mapBadgeToDto(badge);
            boolean unlocked = earnedBadgeIds.contains(badge.getId());
            dto.setIsUnlocked(unlocked);
            if (unlocked) {
                dto.setEarnedAt(earnedDateMap.get(badge.getId()));
            }
            return dto;
        }).collect(Collectors.toList());
    }

    public List<StudentBadgeDto> getAllEarnedBadges() {
        return studentBadgeRepository.findAll().stream()
                .map(this::mapStudentBadgeToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public StudentBadgeDto assignBadgeManually(Long studentId, Long badgeId) {
        return assignBadgeManually(studentId, badgeId, null);
    }

    @Transactional
    public StudentBadgeDto assignBadgeManually(Long studentId, Long badgeId, Long testId) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new RuntimeException("Student not found: " + studentId));
        Badge badge = badgeRepository.findById(badgeId)
                .orElseThrow(() -> new RuntimeException("Badge not found: " + badgeId));

        Test test = null;
        if (testId != null) {
            test = testRepository.findById(testId).orElse(null);
        }

        User admin = badge.getAdmin();
        if (admin == null) {
            admin = com.chillcode.assessment.security.SecurityUtils.getCurrentUser();
        }
        if (admin == null && student.getAdmin() != null) {
            admin = student.getAdmin();
        }
        if (admin == null && test != null) {
            admin = test.getAdmin();
        }
        if (admin == null) {
            admin = userRepository.findAll().stream()
                    .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.ADMIN)
                    .findFirst()
                    .orElse(null);
        }
        if (admin == null) {
            throw new RuntimeException("Could not determine admin_id to fulfill the database constraint.");
        }

        final User resolvedAdmin = admin;

        StudentBadge sb = studentBadgeRepository.findByStudentIdAndBadgeId(studentId, badgeId)
                .orElseGet(() -> StudentBadge.builder()
                        .student(student)
                        .badge(badge)
                        .admin(resolvedAdmin)
                        .earnedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .build());

        sb.setAdmin(resolvedAdmin);
        sb.setSourceTest(test);
        sb.setStatus("ACTIVE");
        sb.setEarnedAt(LocalDateTime.now());
        sb = studentBadgeRepository.save(sb);

        Long resolvedAdminId = resolvedAdmin.getId();
        System.out.println(String.format(
            "[BadgeAssignment] adminId=%d studentId=%d badgeId=%d testId=%s assignmentId=%d",
            resolvedAdminId,
            studentId,
            badgeId,
            testId != null ? testId.toString() : "null",
            sb.getId()
        ));

        createBadgeNotification(student, badge);
        return mapStudentBadgeToDto(sb);
    }

    @Transactional
    public void removeBadgeManually(Long studentId, Long badgeId) {
        studentBadgeRepository.deleteByStudentIdAndBadgeId(studentId, badgeId);
    }

    // --- Automatic Badge Evaluation Engine ---

    @Transactional
    public List<Badge> evaluateAndAwardBadges(Long studentId, Long testId) {
        User student = userRepository.findById(studentId).orElse(null);
        if (student == null) return Collections.emptyList();

        Test test = testId != null ? testRepository.findById(testId).orElse(null) : null;
        List<Badge> newlyAwardedBadges = new ArrayList<>();
        List<BadgeRule> activeRules = badgeRuleRepository.findByStatus("ACTIVE");

        for (BadgeRule rule : activeRules) {
            Badge badge = rule.getBadge();
            if (badge == null || !"ACTIVE".equalsIgnoreCase(badge.getStatus())) continue;

            // Check if student already earned this badge
            if (studentBadgeRepository.findByStudentIdAndBadgeId(studentId, badge.getId()).isPresent()) {
                continue;
            }

            boolean isEligible = false;

            if ("LANGUAGE".equalsIgnoreCase(rule.getCategory())) {
                isEligible = checkLanguageBadgeRule(studentId, rule);
            } else if ("SUBJECT".equalsIgnoreCase(rule.getCategory())) {
                isEligible = checkSubjectBadgeRule(studentId, rule);
            } else if ("GENERAL".equalsIgnoreCase(rule.getCategory())) {
                isEligible = checkGeneralBadgeRule(studentId, rule);
            }

            if (isEligible) {
                StudentBadge sb = StudentBadge.builder()
                        .student(student)
                        .badge(badge)
                        .sourceTest(test)
                        .earnedAt(LocalDateTime.now())
                        .status("ACTIVE")
                        .build();
                studentBadgeRepository.save(sb);
                newlyAwardedBadges.add(badge);
                createBadgeNotification(student, badge);
            }
        }

        return newlyAwardedBadges;
    }

    private boolean checkLanguageBadgeRule(Long studentId, BadgeRule rule) {
        String lang = rule.getTargetLanguage();
        if (lang == null || lang.isEmpty()) return false;

        List<Submission> langSubmissions = submissionRepository.findAll().stream()
                .filter(s -> s.getStudentTest() != null 
                        && s.getStudentTest().getStudent() != null 
                        && s.getStudentTest().getStudent().getId().equals(studentId)
                        && lang.equalsIgnoreCase(s.getLanguage()))
                .collect(Collectors.toList());

        long acceptedCount = langSubmissions.stream()
                .filter(s -> "ACCEPTED".equalsIgnoreCase(s.getStatus()))
                .count();

        long solvedQuestionsCount = langSubmissions.stream()
                .filter(s -> "ACCEPTED".equalsIgnoreCase(s.getStatus()))
                .map(s -> s.getQuestion().getId())
                .distinct()
                .count();

        double avgScore = langSubmissions.isEmpty() ? 0.0 :
                langSubmissions.stream().mapToInt(s -> s.getScore() != null ? s.getScore() : 0).average().orElse(0.0);

        boolean matchAccepted = rule.getMinAcceptedTests() == null || acceptedCount >= rule.getMinAcceptedTests();
        boolean matchAvgScore = rule.getMinAvgScore() == null || avgScore >= rule.getMinAvgScore();
        boolean matchSolved = rule.getMinProblemsSolved() == null || solvedQuestionsCount >= rule.getMinProblemsSolved();

        return matchAccepted && matchAvgScore && matchSolved;
    }

    private boolean checkSubjectBadgeRule(Long studentId, BadgeRule rule) {
        if (rule.getTargetSubject() == null) return false;
        Long subjectId = rule.getTargetSubject().getId();

        Optional<SubjectRanking> rankingOpt = subjectRankingRepository.findBySubjectIdAndStudentId(subjectId, studentId);
        if (rankingOpt.isEmpty()) return false;

        SubjectRanking ranking = rankingOpt.get();
        if (rule.getRankPosition() != null && rule.getRankPosition() > 0) {
            return ranking.getRankPosition().equals(rule.getRankPosition());
        }

        return true;
    }

    private boolean checkGeneralBadgeRule(Long studentId, BadgeRule rule) {
        List<StudentTest> studentTests = studentTestRepository.findAll().stream()
                .filter(st -> st.getStudent() != null && st.getStudent().getId().equals(studentId))
                .collect(Collectors.toList());

        long completedCount = studentTests.stream()
                .filter(st -> "SUBMITTED".equalsIgnoreCase(st.getStatus()) || "EVALUATED".equalsIgnoreCase(st.getStatus()))
                .count();

        double avgScore = studentTests.isEmpty() ? 0.0 :
                studentTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);

        boolean matchAccepted = rule.getMinAcceptedTests() == null || completedCount >= rule.getMinAcceptedTests();
        boolean matchAvgScore = rule.getMinAvgScore() == null || avgScore >= rule.getMinAvgScore();

        return matchAccepted && matchAvgScore;
    }

    private void createBadgeNotification(User student, Badge badge) {
        Notification notification = Notification.builder()
                .user(student)
                .admin(student.getAdmin())
                .title("🎉 Badge Unlocked: " + badge.getName())
                .message("Congratulations! You earned the badge '" + badge.getName() + "'. Check your Achievements page!")
                .type("ACHIEVEMENT")
                .isRead(false)
                .build();
        notificationRepository.save(notification);
    }

    private void saveRule(Badge badge, BadgeRuleDto rDto) {
        Subject targetSub = rDto.getTargetSubjectId() != null ?
                subjectRepository.findById(rDto.getTargetSubjectId()).orElse(null) : null;

        BadgeRule rule = BadgeRule.builder()
                .badge(badge)
                .category(rDto.getCategory() != null ? rDto.getCategory() : "GENERAL")
                .targetSubject(targetSub)
                .targetLanguage(rDto.getTargetLanguage())
                .minAcceptedTests(rDto.getMinAcceptedTests() != null ? rDto.getMinAcceptedTests() : 0)
                .minAvgScore(rDto.getMinAvgScore() != null ? rDto.getMinAvgScore() : 0.0)
                .minProblemsSolved(rDto.getMinProblemsSolved() != null ? rDto.getMinProblemsSolved() : 0)
                .rankPosition(rDto.getRankPosition())
                .status(rDto.getStatus() != null ? rDto.getStatus() : "ACTIVE")
                .build();

        badgeRuleRepository.save(rule);
    }

    private BadgeDto mapBadgeToDto(Badge badge) {
        List<BadgeRuleDto> ruleDtos = badgeRuleRepository.findByBadgeId(badge.getId()).stream()
                .map(r -> BadgeRuleDto.builder()
                        .id(r.getId())
                        .badgeId(badge.getId())
                        .category(r.getCategory())
                        .targetSubjectId(r.getTargetSubject() != null ? r.getTargetSubject().getId() : null)
                        .targetSubjectName(r.getTargetSubject() != null ? r.getTargetSubject().getName() : null)
                        .targetLanguage(r.getTargetLanguage())
                        .minAcceptedTests(r.getMinAcceptedTests())
                        .minAvgScore(r.getMinAvgScore())
                        .minProblemsSolved(r.getMinProblemsSolved())
                        .rankPosition(r.getRankPosition())
                        .status(r.getStatus())
                        .build())
                .collect(Collectors.toList());

        int count = studentBadgeRepository.findByBadgeId(badge.getId()).size();

        return BadgeDto.builder()
                .id(badge.getId())
                .name(badge.getName())
                .description(badge.getDescription())
                .icon(badge.getIcon())
                .type(badge.getType())
                .status(badge.getStatus())
                .createdAt(badge.getCreatedAt())
                .updatedAt(badge.getUpdatedAt())
                .rules(ruleDtos)
                .earnedCount(count)
                .build();
    }

    private StudentBadgeDto mapStudentBadgeToDto(StudentBadge sb) {
        return StudentBadgeDto.builder()
                .id(sb.getId())
                .studentId(sb.getStudent().getId())
                .studentName(sb.getStudent().getName())
                .studentRegisterNumber(sb.getStudent().getRegisterNumber())
                .badge(mapBadgeToDto(sb.getBadge()))
                .earnedAt(sb.getEarnedAt())
                .sourceTestId(sb.getSourceTest() != null ? sb.getSourceTest().getId() : null)
                .sourceTestName(sb.getSourceTest() != null ? sb.getSourceTest().getName() : null)
                .status(sb.getStatus())
                .build();
    }
}
