package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NoArgsConstructor;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "student_question_status", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"student_id", "question_id"})
})
@Getter
@Setter
public class StudentQuestionStatus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "question_id", nullable = false)
    private Long questionId;

    @Column(nullable = false, length = 30)
    private String status = "NOT_STARTED"; // 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'

    @Column(name = "attempt_count", nullable = false)
    private Integer attemptCount = 0;

    @Column(name = "last_submission_id")
    private Long lastSubmissionId;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "last_attempt_at")
    private LocalDateTime lastAttemptAt;

    public StudentQuestionStatus() {}

    @Builder
    public StudentQuestionStatus(Long id, Long studentId, Long questionId, String status, Integer attemptCount, Long lastSubmissionId, LocalDateTime completedAt, LocalDateTime lastAttemptAt) {
        this.id = id;
        this.studentId = studentId;
        this.questionId = questionId;
        this.status = status;
        this.attemptCount = attemptCount;
        this.lastSubmissionId = lastSubmissionId;
        this.completedAt = completedAt;
        this.lastAttemptAt = lastAttemptAt;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getStudentId() { return studentId; }
    public void setStudentId(Long studentId) { this.studentId = studentId; }

    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long questionId) { this.questionId = questionId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Integer getAttemptCount() { return attemptCount; }
    public void setAttemptCount(Integer attemptCount) { this.attemptCount = attemptCount; }

    public Long getLastSubmissionId() { return lastSubmissionId; }
    public void setLastSubmissionId(Long lastSubmissionId) { this.lastSubmissionId = lastSubmissionId; }

    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }

    public LocalDateTime getLastAttemptAt() { return lastAttemptAt; }
    public void setLastAttemptAt(LocalDateTime lastAttemptAt) { this.lastAttemptAt = lastAttemptAt; }
}
