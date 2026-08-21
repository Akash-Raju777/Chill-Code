package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.SubjectRankingDto;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.entity.SubjectRanking;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.StudentTestRepository;
import com.chillcode.assessment.repository.SubjectRankingRepository;
import com.chillcode.assessment.repository.SubjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class RankingService {

    @Autowired
    private SubjectRankingRepository subjectRankingRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubmissionRepository submissionRepository;

    @Autowired
    private BadgeSetService badgeSetService;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentAchievementRepository studentAchievementRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentBadgeRepository studentBadgeRepository;

    @Autowired
    private com.chillcode.assessment.repository.LanguageMasterBadgeRepository languageMasterBadgeRepository;

    private String getLanguageCodeForSubject(String subjectName) {
        if (subjectName == null) return "java";
        String lower = subjectName.toLowerCase();
        if (lower.contains("javascript") || lower.contains("js")) return "javascript";
        if (lower.contains("c++") || lower.contains("cpp")) return "cpp";
        if (lower.contains("python") || lower.contains("py")) return "python";
        if (lower.contains("java")) return "java";
        if (lower.contains("c")) return "c";
        return "java";
    }

    private boolean matchesLanguage(String subLang, String targetLang) {
        if (subLang == null || targetLang == null) return false;
        String s = subLang.trim().toLowerCase();
        String t = targetLang.trim().toLowerCase();
        if (s.equals(t)) return true;
        if ("c++".equals(s) && "cpp".equals(t)) return true;
        if ("cpp".equals(s) && "c++".equals(t)) return true;
        if ("js".equals(s) && "javascript".equals(t)) return true;
        if ("javascript".equals(s) && "js".equals(t)) return true;
        if ("py".equals(s) && "python".equals(t)) return true;
        if ("python".equals(s) && "py".equals(t)) return true;
        return false;
    }

    /**
     * Recalculates subject-wise rankings for a given subject based on strict criteria:
     * 1. Highest Marks
     * 2. Highest Test Cases Passed
     * 3. Lowest Time Taken
     * 4. Earliest Submission
     */
    @Transactional
    public List<SubjectRanking> updateSubjectRankings(Long subjectId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new RuntimeException("Subject not found: " + subjectId));

        String targetLang = getLanguageCodeForSubject(subject.getName());

        // Get all direct submissions for questions under this subject that match target language
        List<com.chillcode.assessment.entity.Submission> subjectSubmissions = submissionRepository.findAll().stream()
                .filter(sub -> sub.getQuestion() != null 
                        && sub.getQuestion().getSubject() != null 
                        && sub.getQuestion().getSubject().getId().equals(subjectId)
                        && (sub.getStudentTest() != null && sub.getStudentTest().getStudent() != null)
                        && matchesLanguage(sub.getLanguage(), targetLang)
                        && (sub.getScore() != null && sub.getScore() > 0 || "ACCEPTED".equalsIgnoreCase(sub.getStatus())))
                .collect(Collectors.toList());

        // studentId -> questionId -> bestSubmission
        Map<Long, Map<Long, com.chillcode.assessment.entity.Submission>> bestSubmissionsMap = new HashMap<>();

        // Aggregate stats ONLY for students who actually submitted code in the target language for this subject
        // Group by questionId to find the best attempt (max score) for each question to avoid duplicates
        for (com.chillcode.assessment.entity.Submission sub : subjectSubmissions) {
            User student = sub.getStudentTest().getStudent();
            if (student == null || sub.getQuestion() == null) continue;

            bestSubmissionsMap.putIfAbsent(student.getId(), new HashMap<>());
            Map<Long, com.chillcode.assessment.entity.Submission> studentSubs = bestSubmissionsMap.get(student.getId());

            Long qId = sub.getQuestion().getId();
            com.chillcode.assessment.entity.Submission existing = studentSubs.get(qId);

            int subScore = sub.getScore() != null ? sub.getScore() : 0;
            int existingScore = (existing != null && existing.getScore() != null) ? existing.getScore() : -1;

            if (existing == null || subScore > existingScore) {
                studentSubs.put(qId, sub);
            } else if (subScore == existingScore) {
                int subTests = sub.getPassedTests() != null ? sub.getPassedTests() : 0;
                int existingTests = existing.getPassedTests() != null ? existing.getPassedTests() : 0;
                if (subTests > existingTests) {
                    studentSubs.put(qId, sub);
                }
            }
        }

        Map<Long, StudentAggregatedStats> studentStatsMap = new HashMap<>();

        for (Map.Entry<Long, Map<Long, com.chillcode.assessment.entity.Submission>> entry : bestSubmissionsMap.entrySet()) {
            Long studentId = entry.getKey();
            Map<Long, com.chillcode.assessment.entity.Submission> bestSubs = entry.getValue();
            
            if (bestSubs.isEmpty()) continue;
            User student = bestSubs.values().iterator().next().getStudentTest().getStudent();
            
            StudentAggregatedStats stats = new StudentAggregatedStats(student);
            
            for (com.chillcode.assessment.entity.Submission bestSub : bestSubs.values()) {
                stats.totalScore += (bestSub.getScore() != null ? bestSub.getScore() : 0);
                stats.testCasesPassed += (bestSub.getPassedTests() != null ? bestSub.getPassedTests() : 0);
                
                // Note: runTimeMs is execution time. We can accumulate it as tie-breaker.
                stats.totalTimeTakenSeconds += (bestSub.getRunTimeMs() != null ? bestSub.getRunTimeMs() / 1000 : 0L);
                
                if (stats.lastSubmissionTime == null || (bestSub.getCreatedAt() != null && bestSub.getCreatedAt().isAfter(stats.lastSubmissionTime))) {
                    stats.lastSubmissionTime = bestSub.getCreatedAt();
                }
            }
            studentStatsMap.put(studentId, stats);
        }

        List<StudentAggregatedStats> sortedStats = new ArrayList<>(studentStatsMap.values());

        // Sort priority:
        // 1. Total Score (Highest First)
        // 2. Number of Test Cases Passed (Highest First)
        // 3. Total Time Taken (Lowest First)
        // 4. Earliest Submission Time as tie-breaker
        sortedStats.sort((a, b) -> {
            int scoreCompare = Integer.compare(b.totalScore, a.totalScore);
            if (scoreCompare != 0) return scoreCompare;

            int tcCompare = Integer.compare(b.testCasesPassed, a.testCasesPassed);
            if (tcCompare != 0) return tcCompare;

            int timeCompare = Long.compare(a.totalTimeTakenSeconds, b.totalTimeTakenSeconds);
            if (timeCompare != 0) return timeCompare;

            if (a.lastSubmissionTime == null && b.lastSubmissionTime == null) return 0;
            if (a.lastSubmissionTime == null) return 1;
            if (b.lastSubmissionTime == null) return -1;

            return a.lastSubmissionTime.compareTo(b.lastSubmissionTime);
        });

        // Fetch existing SubjectRanking records for this subject
        List<SubjectRanking> existingRankings = subjectRankingRepository.findBySubjectIdOrderByRankPositionAsc(subjectId);
        Map<Long, SubjectRanking> existingMap = existingRankings.stream()
                .collect(Collectors.toMap(r -> r.getStudent().getId(), r -> r, (r1, r2) -> r1));

        Set<Long> activeStudentIds = new HashSet<>();
        List<SubjectRanking> updatedRankings = new ArrayList<>();
        int rank = 1;

        for (StudentAggregatedStats stats : sortedStats) {
            Long studentId = stats.student.getId();
            activeStudentIds.add(studentId);

            SubjectRanking ranking = existingMap.get(studentId);
            if (ranking == null) {
                ranking = SubjectRanking.builder()
                        .subject(subject)
                        .student(stats.student)
                        .build();
            }

            ranking.setRankPosition(rank);
            ranking.setTotalScore(stats.totalScore);
            ranking.setTestCasesPassed(stats.testCasesPassed);
            ranking.setTotalTimeTakenSeconds(stats.totalTimeTakenSeconds);
            ranking.setLastSubmissionTime(stats.lastSubmissionTime);
            ranking.setStatus("ACTIVE");

            updatedRankings.add(subjectRankingRepository.save(ranking));
            rank++;
        }

        // Delete stale ranking entries for unattempted students
        for (SubjectRanking oldRanking : existingRankings) {
            if (!activeStudentIds.contains(oldRanking.getStudent().getId())) {
                subjectRankingRepository.delete(oldRanking);
            }
        }

        // Dynamically trigger badge allocation for all tests under this subject
        try {
            List<com.chillcode.assessment.entity.Test> tests = testRepository.findBySubjectId(subjectId);
            for (com.chillcode.assessment.entity.Test test : tests) {
                badgeSetService.allocateBadgesForTest(test.getId());
            }
        } catch (Exception e) {
            System.err.println("Error recalculating badges for subject " + subjectId + ": " + e.getMessage());
        }

        return updatedRankings;
    }

    @Transactional
    public List<SubjectRankingDto> getSubjectLeaderboard(Long subjectId) {
        updateSubjectRankings(subjectId);
        List<Long> validTestIds = testRepository.findTestIdsWithQuestions();
        List<SubjectRanking> rankings = subjectRankingRepository.findBySubjectIdOrderByRankPositionAsc(subjectId);
        return rankings.stream().map(r -> mapToDto(r, validTestIds)).collect(Collectors.toList());
    }

    public List<SubjectRankingDto> getTopSubjectRankings(Long subjectId, int limit) {
        return getSubjectLeaderboard(subjectId).stream().limit(limit).collect(Collectors.toList());
    }

    private SubjectRankingDto mapToDto(SubjectRanking ranking, List<Long> validTestIds) {
        String icon = null;
        if (ranking.getRankPosition() == 1) icon = "🥇";
        else if (ranking.getRankPosition() == 2) icon = "🥈";
        else if (ranking.getRankPosition() == 3) icon = "🥉";

        String regNo = ranking.getStudent() != null ? ranking.getStudent().getRegisterNumber() : null;
        if (regNo == null) regNo = "";

        String dept = ranking.getStudent() != null && ranking.getStudent().getDepartment() != null ? ranking.getStudent().getDepartment() : "CS";

        int totalBadgesForSubject = 0;
        try {
            Long studentId = ranking.getStudent().getId();
            String subjectName = ranking.getSubject().getName();

            long achievementsCount = studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(studentId).stream()
                    .filter(sa -> "ACTIVE".equalsIgnoreCase(sa.getStatus()) && sa.getSubjectName() != null && sa.getSubjectName().equalsIgnoreCase(subjectName))
                    .filter(sa -> sa.getTest() == null || validTestIds.contains(sa.getTest().getId()))
                    .count();

            long manualBadgesCount = studentBadgeRepository.findByStudentId(studentId).stream()
                    .filter(sb -> "ACTIVE".equalsIgnoreCase(sb.getStatus()) && sb.getSourceTest() != null && sb.getSourceTest().getSubject() != null && sb.getSourceTest().getSubject().getName().equalsIgnoreCase(subjectName))
                    .filter(sb -> sb.getSourceTest() == null || validTestIds.contains(sb.getSourceTest().getId()))
                    .count();

            long languageBadgesCount = languageMasterBadgeRepository.findByStudentIdOrderByAwardedDateDesc(studentId).stream()
                    .filter(lmb -> lmb.getSubject() != null && lmb.getSubject().equalsIgnoreCase(subjectName))
                    .filter(lmb -> lmb.getTest() == null || validTestIds.contains(lmb.getTest().getId()))
                    .count();

            totalBadgesForSubject = (int) (achievementsCount + manualBadgesCount);
        } catch (Exception ignored) {}

        return SubjectRankingDto.builder()
                .id(ranking.getId())
                .subjectId(ranking.getSubject().getId())
                .subjectName(ranking.getSubject().getName())
                .studentId(ranking.getStudent().getId())
                .studentName(ranking.getStudent().getName())
                .studentRegisterNumber(regNo)
                .registerNumber(regNo)
                .department(dept)
                .rankPosition(ranking.getRankPosition())
                .totalScore(ranking.getTotalScore())
                .testCasesPassed(ranking.getTestCasesPassed())
                .totalTimeTakenSeconds(ranking.getTotalTimeTakenSeconds())
                .lastSubmissionTime(ranking.getLastSubmissionTime())
                .badgeIcon(icon)
                .resultStatus(ranking.getTotalScore() > 0 ? "Pass" : "Not Attended")
                .totalBadges(totalBadgesForSubject)
                .badgesEarned(totalBadgesForSubject)
                .build();
    }

    private static class StudentAggregatedStats {
        User student;
        int totalScore = 0;
        int testCasesPassed = 0;
        long totalTimeTakenSeconds = 0L;
        LocalDateTime lastSubmissionTime;

        StudentAggregatedStats(User student) {
            this.student = student;
        }
    }
}
