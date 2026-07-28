package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "badge_rules")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BadgeRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "badge_id", nullable = false)
    private Badge badge;

    @Column(nullable = false, length = 50)
    private String category; // 'LANGUAGE', 'SUBJECT', 'GENERAL'

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "target_subject_id")
    private Subject targetSubject;

    @Column(name = "target_language", length = 30)
    private String targetLanguage; // 'java', 'python', 'c', 'cpp', 'javascript'

    @Column(name = "min_accepted_tests")
    @Builder.Default
    private Integer minAcceptedTests = 0;

    @Column(name = "min_avg_score")
    @Builder.Default
    private Double minAvgScore = 0.0;

    @Column(name = "min_problems_solved")
    @Builder.Default
    private Integer minProblemsSolved = 0;

    @Column(name = "rank_position")
    private Integer rankPosition; // 1 for Gold, 2 for Silver, 3 for Bronze

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
