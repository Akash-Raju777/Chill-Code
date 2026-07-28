package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.SubjectRankingDto;
import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.StudentAchievementRepository;
import com.chillcode.assessment.repository.StudentTestRepository;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class OverallLeaderboardService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private StudentAchievementRepository studentAchievementRepository;

    @Transactional(readOnly = true)
    public List<OverallLeaderboardEntry> getOverallLeaderboard(String timeFilter, String departmentFilter) {
        List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .collect(Collectors.toList());

        if (departmentFilter != null && !departmentFilter.trim().isEmpty() && !"ALL".equalsIgnoreCase(departmentFilter)) {
            students = students.stream()
                    .filter(s -> s.getDepartment() != null && s.getDepartment().equalsIgnoreCase(departmentFilter))
                    .collect(Collectors.toList());
        }

        List<StudentTest> allStudentTests = studentTestRepository.findAll().stream()
                .filter(st -> "SUBMITTED".equalsIgnoreCase(st.getStatus()) || "EVALUATED".equalsIgnoreCase(st.getStatus()) || "COMPLETED".equalsIgnoreCase(st.getStatus()))
                .collect(Collectors.toList());

        List<OverallLeaderboardEntry> entries = new ArrayList<>();

        for (User student : students) {
            List<StudentTest> myTests = allStudentTests.stream()
                    .filter(st -> st.getStudent() != null && st.getStudent().getId().equals(student.getId()))
                    .collect(Collectors.toList());

            int totalMarks = myTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
            long totalTestsPassed = myTests.stream()
                    .filter(st -> "PASS".equalsIgnoreCase(st.getPassFailStatus()) || "COMPLETED".equalsIgnoreCase(st.getStatus()))
                    .count();

            int totalBadges = studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(student.getId()).size();

            double avgScore = myTests.isEmpty() ? 0.0 :
                    myTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);

            double avgTimeSec = myTests.isEmpty() ? 0.0 :
                    myTests.stream().mapToLong(st -> st.getTimeTakenSeconds() != null ? st.getTimeTakenSeconds() : 0L).average().orElse(0.0);

            entries.add(new OverallLeaderboardEntry(
                    student.getId(),
                    student.getName(),
                    student.getRegisterNumber(),
                    student.getDepartment(),
                    totalMarks,
                    (int) totalTestsPassed,
                    totalBadges,
                    avgScore,
                    avgTimeSec
            ));
        }

        // Sort priority: 1. Total Marks, 2. Total Tests Passed, 3. Total Badges, 4. Average Score, 5. Lowest Avg Completion Time
        entries.sort((a, b) -> {
            int scoreComp = Integer.compare(b.totalMarks, a.totalMarks);
            if (scoreComp != 0) return scoreComp;

            int passComp = Integer.compare(b.totalTestsPassed, a.totalTestsPassed);
            if (passComp != 0) return passComp;

            int badgeComp = Integer.compare(b.totalBadges, a.totalBadges);
            if (badgeComp != 0) return badgeComp;

            int avgComp = Double.compare(b.avgScore, a.avgScore);
            if (avgComp != 0) return avgComp;

            return Double.compare(a.avgTimeSec, b.avgTimeSec);
        });

        int rank = 1;
        for (OverallLeaderboardEntry entry : entries) {
            entry.rankPosition = rank++;
        }

        return entries;
    }

    public String generateCsvExport(List<OverallLeaderboardEntry> entries) {
        StringBuilder sb = new StringBuilder();
        sb.append("Rank,Register Number,Student Name,Department,Total Marks,Tests Passed,Total Badges,Avg Score,Avg Time (s)\n");
        for (OverallLeaderboardEntry e : entries) {
            sb.append(e.rankPosition).append(",")
              .append("\"").append(e.registerNumber != null ? e.registerNumber : "").append("\",")
              .append("\"").append(e.studentName != null ? e.studentName : "").append("\",")
              .append("\"").append(e.department != null ? e.department : "").append("\",")
              .append(e.totalMarks).append(",")
              .append(e.totalTestsPassed).append(",")
              .append(e.totalBadges).append(",")
              .append(String.format("%.2f", e.avgScore)).append(",")
              .append(String.format("%.2f", e.avgTimeSec)).append("\n");
        }
        return sb.toString();
    }

    public static class OverallLeaderboardEntry {
        public int rankPosition;
        public Long studentId;
        public String studentName;
        public String registerNumber;
        public String department;
        public int totalMarks;
        public int totalTestsPassed;
        public int totalBadges;
        public double avgScore;
        public double avgTimeSec;

        public OverallLeaderboardEntry(Long studentId, String studentName, String registerNumber, String department, int totalMarks, int totalTestsPassed, int totalBadges, double avgScore, double avgTimeSec) {
            this.studentId = studentId;
            this.studentName = studentName;
            this.registerNumber = registerNumber;
            this.department = department;
            this.totalMarks = totalMarks;
            this.totalTestsPassed = totalTestsPassed;
            this.totalBadges = totalBadges;
            this.avgScore = avgScore;
            this.avgTimeSec = avgTimeSec;
        }
    }
}
