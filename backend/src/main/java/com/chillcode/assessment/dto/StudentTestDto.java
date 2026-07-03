package com.chillcode.assessment.dto;

import java.time.LocalDateTime;

public class StudentTestDto {
    private Long id;
    private String status;
    private Integer score;
    private Integer warningsCount;
    private Boolean isSuspended;
    private LocalDateTime submittedAt;
    private TestDetailsDto test;

    public StudentTestDto() {}

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getScore() { return score; }
    public void setScore(Integer score) { this.score = score; }

    public Integer getWarningsCount() { return warningsCount; }
    public void setWarningsCount(Integer warningsCount) { this.warningsCount = warningsCount; }

    public Boolean getIsSuspended() { return isSuspended; }
    public void setIsSuspended(Boolean isSuspended) { this.isSuspended = isSuspended; }

    public LocalDateTime getSubmittedAt() { return submittedAt; }
    public void setSubmittedAt(LocalDateTime submittedAt) { this.submittedAt = submittedAt; }

    public TestDetailsDto getTest() { return test; }
    public void setTest(TestDetailsDto test) { this.test = test; }

    public static class TestDetailsDto {
        private Long id;
        private String name;
        private Integer durationMinutes;
        private LocalDateTime startTime;
        private LocalDateTime endTime;
        private Integer maxMarks;
        private String instructions;
        private SubjectDetailsDto subject;

        public TestDetailsDto() {}

        public TestDetailsDto(Long id, String name, Integer durationMinutes, LocalDateTime startTime, LocalDateTime endTime, 
                              Integer maxMarks, String instructions, SubjectDetailsDto subject) {
            this.id = id;
            this.name = name;
            this.durationMinutes = durationMinutes;
            this.startTime = startTime;
            this.endTime = endTime;
            this.maxMarks = maxMarks;
            this.instructions = instructions;
            this.subject = subject;
        }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public Integer getDurationMinutes() { return durationMinutes; }
        public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

        public LocalDateTime getStartTime() { return startTime; }
        public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }

        public LocalDateTime getEndTime() { return endTime; }
        public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }

        public Integer getMaxMarks() { return maxMarks; }
        public void setMaxMarks(Integer maxMarks) { this.maxMarks = maxMarks; }

        public String getInstructions() { return instructions; }
        public void setInstructions(String instructions) { this.instructions = instructions; }

        public SubjectDetailsDto getSubject() { return subject; }
        public void setSubject(SubjectDetailsDto subject) { this.subject = subject; }
    }

    public static class SubjectDetailsDto {
        private Long id;
        private String name;
        private String color;

        public SubjectDetailsDto() {}

        public SubjectDetailsDto(Long id, String name, String color) {
            this.id = id;
            this.name = name;
            this.color = color;
        }

        public Long getId() { return id; }
        public void setId(Long id) { this.id = id; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getColor() { return color; }
        public void setColor(String color) { this.color = color; }
    }
}
