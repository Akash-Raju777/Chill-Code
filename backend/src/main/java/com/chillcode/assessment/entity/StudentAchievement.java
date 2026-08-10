package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "student_achievements",
    indexes = {
        @Index(name = "idx_student_achievements_student", columnList = "student_id"),
        @Index(name = "idx_student_achievements_test", columnList = "test_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class StudentAchievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User admin;

    @Column(name = "badge_name", nullable = false, length = 150)
    private String badgeName;

    @Column(name = "badge_icon", length = 100)
    @Builder.Default
    private String badgeIcon = "Award";

    @Column(name = "badge_category", length = 50)
    @Builder.Default
    private String badgeCategory = "Test Ranking";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id")
    private Test test;

    @Column(name = "test_code", length = 50)
    private String testCode;

    @Column(name = "test_name", length = 150)
    private String testName;

    @Column(name = "subject_name", length = 100)
    private String subjectName;

    @Column(name = "rank_achieved", length = 50)
    private String rankAchieved;

    @Column(name = "awarded_at", nullable = false)
    @Builder.Default
    private LocalDateTime awardedAt = LocalDateTime.now();

    @Column(name = "awarded_by", length = 100)
    @Builder.Default
    private String awardedBy = "Automatic System";

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
        if (awardedAt == null) {
            awardedAt = LocalDateTime.now();
        }
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
