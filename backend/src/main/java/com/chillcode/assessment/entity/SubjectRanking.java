package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "subject_rankings",
    uniqueConstraints = {@UniqueConstraint(columnNames = {"subject_id", "student_id"})},
    indexes = {
        @Index(name = "idx_subject_rankings_subject", columnList = "subject_id"),
        @Index(name = "idx_subject_rankings_student", columnList = "student_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubjectRanking {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(name = "rank_position", nullable = false)
    private Integer rankPosition;

    @Column(name = "total_score")
    @Builder.Default
    private Integer totalScore = 0;

    @Column(name = "test_cases_passed")
    @Builder.Default
    private Integer testCasesPassed = 0;

    @Column(name = "total_time_taken_seconds")
    @Builder.Default
    private Long totalTimeTakenSeconds = 0L;

    @Column(name = "last_submission_time")
    private LocalDateTime lastSubmissionTime;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "updated_at")
    @Builder.Default
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
