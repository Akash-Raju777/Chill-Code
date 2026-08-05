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

        long totalStudents = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .count();

        long totalTests = testRepository.count();

        List<StudentTest> allAssignments = studentTestRepository.findAll();
        
        long totalAttempts = allAssignments.stream()
                .filter(st -> st.getStartedAt() != null || !"ASSIGNED".equalsIgnoreCase(st.getStatus()))
                .count();

        long totalPassed = allAssignments.stream()
                .filter(st -> "PASS".equalsIgnoreCase(st.getPassFailStatus()) || "COMPLETED".equalsIgnoreCase(st.getStatus()))
                .count();

        long totalFailed = Math.max(0, totalAttempts - totalPassed);
        long totalNotAttended = Math.max(0, allAssignments.size() - totalAttempts);

        double passRate = totalAttempts > 0 ? ((double) totalPassed / totalAttempts) * 100 : 0.0;
        double failRate = totalAttempts > 0 ? 100.0 - passRate : 0.0;

        long totalBadges = studentAchievementRepository.count();

        // Active Students Today (Students who have a submission today)
        LocalDate today = LocalDate.now();
        long activeStudentsToday = allAssignments.stream()
                .filter(st -> st.getSubmittedAt() != null && st.getSubmittedAt().toLocalDate().equals(today))
                .map(st -> st.getStudent().getId())
                .distinct()
                .count();

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

        List<StudentTest> allAssignments = studentTestRepository.findAllCompletedWithStudents();

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
