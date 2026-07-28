package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentTestDto {
    private Long id;
    private String status;
    private Integer score;
    private Integer warningsCount;
    private Boolean isSuspended;
    private LocalDateTime submittedAt;
    private LocalDateTime startedAt;
    private TestDetailsDto test;
    private String reattemptStatus;
    private String studentRegisterNumber;
    private String studentName;
    private Long reattemptQuestionId;
    private String reattemptQuestionTitle;
    private String displayTitle;

    // Feature 1, 3, 4 additions
    private Long timeTakenSeconds;
    private Boolean autoSubmitted;
    private String passFailStatus; // 'PASS', 'FAIL', 'PENDING'
    private Integer testCasesPassed;
    private Integer totalTestCases;
    private Long remainingTimeSeconds;

    public StudentTestDto(Long id, String status, Integer score, Integer warningsCount, Boolean isSuspended, TestDetailsDto test) {
        this.id = id;
        this.status = status;
        this.score = score;
        this.warningsCount = warningsCount;
        this.isSuspended = isSuspended;
        this.test = test;
    }

    public StudentTestDto(Long id, String status, Integer score, Integer warningsCount, Boolean isSuspended, TestDetailsDto test, LocalDateTime submittedAt) {
        this(id, status, score, warningsCount, isSuspended, test);
        this.submittedAt = submittedAt;
    }

    public StudentTestDto(Long id, String status, Integer score, Integer warningsCount, Boolean isSuspended, TestDetailsDto test, LocalDateTime submittedAt, LocalDateTime startedAt) {
        this(id, status, score, warningsCount, isSuspended, test, submittedAt);
        this.startedAt = startedAt;
    }

    public StudentTestDto(Long id, String status, Integer score, Integer warningsCount, Boolean isSuspended, TestDetailsDto test, LocalDateTime submittedAt, LocalDateTime startedAt, String reattemptStatus) {
        this(id, status, score, warningsCount, isSuspended, test, submittedAt, startedAt);
        this.reattemptStatus = reattemptStatus;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class TestDetailsDto {
        private Long id;
        private String testCode;
        private String name;
        private Integer durationMinutes;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private Integer maxMarks;
        private String instructions;
        private Boolean securityShieldEnabled;
        private SubjectDetailsDto subject;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class SubjectDetailsDto {
        private Long id;
        private String name;
        private String color;
    }
}
