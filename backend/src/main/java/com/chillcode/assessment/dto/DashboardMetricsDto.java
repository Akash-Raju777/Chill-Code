package com.chillcode.assessment.dto;

import lombok.*;
import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardMetricsDto {
    private long totalStudents;
    private long totalSubjects;
    private long totalTests;
    private long totalQuestions;
    private long todayActiveTests;
    private long pendingEvaluations;

    private List<Map<String, Object>> monthlyTests;
    private List<Map<String, Object>> studentParticipation;
    private List<Map<String, Object>> languagePerformance;
    private List<Map<String, Object>> recentActivities;
}
