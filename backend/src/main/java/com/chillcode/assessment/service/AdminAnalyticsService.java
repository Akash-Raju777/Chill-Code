package com.chillcode.assessment.service;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.StudentAchievementRepository;
import com.chillcode.assessment.repository.StudentTestRepository;
import com.chillcode.assessment.repository.TestRepository;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminAnalyticsService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private StudentAchievementRepository studentAchievementRepository;

    @Autowired
    private TestRepository testRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getOverviewStats() {
        Map<String, Object> stats = new HashMap<>();
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        if (adminId == null) return stats;

        long totalStudents = userRepository.countByRoleAndAdminId(Role.STUDENT, adminId);
        long totalTests = testRepository.countByAdminId(adminId);
        long totalBadges = studentAchievementRepository.countByAdminId(adminId);

        // High-Performance: single-pass native aggregation instead of fetching 1400+ entity graphs over WAN
        java.time.LocalDateTime todayStart = LocalDate.now().atStartOfDay();
        List<Object[]> summaryList = studentTestRepository.getAdminAnalyticsSummary(adminId, todayStart);

        long totalAssignments = 0;
        long totalAttempts = 0;
        long totalPassed = 0;
        long activeStudentsToday = 0;

        if (summaryList != null && !summaryList.isEmpty() && summaryList.get(0) != null) {
            Object[] row = summaryList.get(0);
            totalAssignments = row[0] != null ? ((Number) row[0]).longValue() : 0;
            totalAttempts = row[1] != null ? ((Number) row[1]).longValue() : 0;
            totalPassed = row[2] != null ? ((Number) row[2]).longValue() : 0;
            activeStudentsToday = row[3] != null ? ((Number) row[3]).longValue() : 0;
        }

        long totalFailed = Math.max(0, totalAttempts - totalPassed);
        long totalNotAttended = Math.max(0, totalAssignments - totalAttempts);

        double passRate = totalAttempts > 0 ? ((double) totalPassed / totalAttempts) * 100 : 0.0;
        double failRate = totalAttempts > 0 ? 100.0 - passRate : 0.0;

        stats.put("totalStudents", totalStudents);
        stats.put("totalTests", totalTests);
        stats.put("totalAttempts", totalAttempts);
        stats.put("totalPassed", totalPassed);
        stats.put("totalFailed", totalFailed);
        stats.put("totalNotAttended", totalNotAttended);
        stats.put("overallPassRate", Math.round(passRate * 10.0) / 10.0);
        stats.put("overallFailRate", Math.round(failRate * 10.0) / 10.0);
        stats.put("totalBadgesAwarded", totalBadges);
        stats.put("activeStudentsToday", activeStudentsToday);

        return stats;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getChartData() {
        Map<String, Object> charts = new HashMap<>();
        Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
        if (adminId == null) return charts;

        List<StudentTest> allAssignments = studentTestRepository.findAllCompletedWithStudentsByAdminId(adminId);

        // 1. Pass vs Fail
        long passed = allAssignments.stream()
                .filter(st -> "PASS".equalsIgnoreCase(st.getPassFailStatus()) || "COMPLETED".equalsIgnoreCase(st.getStatus()))
                .count();
        long failed = allAssignments.size() - passed; // Simplified for completed tests

        charts.put("passVsFail", Arrays.asList(
                Map.of("name", "Pass", "value", passed),
                Map.of("name", "Fail", "value", failed)
        ));

        // 2. Daily Attempts (Last 7 days)
        LocalDate today = LocalDate.now();
        List<Map<String, Object>> dailyAttempts = new ArrayList<>();
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd");
        
        for (int i = 6; i >= 0; i--) {
            LocalDate date = today.minusDays(i);
            long count = allAssignments.stream()
                    .filter(st -> st.getSubmittedAt() != null && st.getSubmittedAt().toLocalDate().equals(date))
                    .count();
            dailyAttempts.add(Map.of(
                    "date", date.format(formatter),
                    "attempts", count
            ));
        }
        charts.put("dailyAttempts", dailyAttempts);

        return charts;
    }
}
