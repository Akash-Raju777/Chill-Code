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

        List<StudentTest> allStudentTests = studentTestRepository.findAll().stream()
                .filter(st -> st.getTest() != null 
                        && st.getTest().getSubject() != null 
                        && st.getTest().getSubject().getId().equals(subjectId)
                        && ("SUBMITTED".equalsIgnoreCase(st.getStatus()) || "EVALUATED".equalsIgnoreCase(st.getStatus())))
                .collect(Collectors.toList());

        // Group by student and aggregate total score, test cases passed, time taken, last submission time
        Map<Long, StudentAggregatedStats> studentStatsMap = new HashMap<>();

        for (StudentTest st : allStudentTests) {
            User student = st.getStudent();
            if (student == null) continue;
            Long studentId = student.getId();

            StudentAggregatedStats stats = studentStatsMap.computeIfAbsent(studentId, k -> new StudentAggregatedStats(student));
            stats.totalScore += (st.getScore() != null ? st.getScore() : 0);
            stats.testCasesPassed += (st.getTestCasesPassed() != null ? st.getTestCasesPassed() : 0);
            stats.totalTimeTakenSeconds += (st.getTimeTakenSeconds() != null ? st.getTimeTakenSeconds() : 0L);

            LocalDateTime subTime = st.getSubmittedAt() != null ? st.getSubmittedAt() : st.getCreatedAt();
            if (stats.lastSubmissionTime == null || subTime.isAfter(stats.lastSubmissionTime)) {
                stats.lastSubmissionTime = subTime;
            }
        }

        List<StudentAggregatedStats> sortedStats = new ArrayList<>(studentStatsMap.values());

        // Sort by Priority: 1. Highest Marks, 2. Highest Test Cases Passed, 3. Lowest Time Taken, 4. Earliest Submission
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

        List<SubjectRanking> updatedRankings = new ArrayList<>();
        int rank = 1;

        for (StudentAggregatedStats stats : sortedStats) {
            SubjectRanking ranking = subjectRankingRepository.findBySubjectIdAndStudentId(subjectId, stats.student.getId())
                    .orElse(SubjectRanking.builder()
                            .subject(subject)
                            .student(stats.student)
                            .build());

            ranking.setRankPosition(rank);
            ranking.setTotalScore(stats.totalScore);
            ranking.setTestCasesPassed(stats.testCasesPassed);
            ranking.setTotalTimeTakenSeconds(stats.totalTimeTakenSeconds);
            ranking.setLastSubmissionTime(stats.lastSubmissionTime);
            ranking.setStatus("ACTIVE");

            updatedRankings.add(subjectRankingRepository.save(ranking));
            rank++;
        }

        return updatedRankings;
    }

    public List<SubjectRankingDto> getSubjectLeaderboard(Long subjectId) {
        List<SubjectRanking> rankings = subjectRankingRepository.findBySubjectIdOrderByRankPositionAsc(subjectId);
        return rankings.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public List<SubjectRankingDto> getTopSubjectRankings(Long subjectId, int limit) {
        return getSubjectLeaderboard(subjectId).stream().limit(limit).collect(Collectors.toList());
    }

    private SubjectRankingDto mapToDto(SubjectRanking ranking) {
        String icon = null;
        if (ranking.getRankPosition() == 1) icon = "🥇";
        else if (ranking.getRankPosition() == 2) icon = "🥈";
        else if (ranking.getRankPosition() == 3) icon = "🥉";

        return SubjectRankingDto.builder()
                .id(ranking.getId())
                .subjectId(ranking.getSubject().getId())
                .subjectName(ranking.getSubject().getName())
                .studentId(ranking.getStudent().getId())
                .studentName(ranking.getStudent().getName())
                .studentRegisterNumber(ranking.getStudent().getRegisterNumber())
                .rankPosition(ranking.getRankPosition())
                .totalScore(ranking.getTotalScore())
                .testCasesPassed(ranking.getTestCasesPassed())
                .totalTimeTakenSeconds(ranking.getTotalTimeTakenSeconds())
                .lastSubmissionTime(ranking.getLastSubmissionTime())
                .badgeIcon(icon)
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
