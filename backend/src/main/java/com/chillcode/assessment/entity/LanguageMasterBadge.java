package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "language_master_badges",
    indexes = {
        @Index(name = "idx_lang_badge_student", columnList = "student_id"),
        @Index(name = "idx_lang_badge_test", columnList = "test_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class LanguageMasterBadge {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id", nullable = false)
    private Test test;

    @Column(nullable = false, length = 100)
    private String subject;

    @Column(name = "badge_name", nullable = false, length = 150)
    private String badgeName;

    @Column(name = "badge_icon", length = 50)
    @Builder.Default
    private String badgeIcon = "☕";

    @Column(name = "awarded_rank")
    @Builder.Default
    private Integer awardedRank = 1;

    @Column(name = "awarded_date", nullable = false)
    @Builder.Default
    private LocalDateTime awardedDate = LocalDateTime.now();

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (awardedDate == null) {
            awardedDate = LocalDateTime.now();
        }
        createdAt = LocalDateTime.now();
    }
}
