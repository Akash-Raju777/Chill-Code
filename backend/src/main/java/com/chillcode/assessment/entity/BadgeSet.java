package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "badge_sets")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class BadgeSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 150)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id", nullable = false)
    private Test test;

    @Column(name = "test_code", nullable = false, length = 50)
    private String testCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @Column(name = "number_of_winners")
    @Builder.Default
    private Integer numberOfWinners = 3;

    @Column(name = "enable_language_badge")
    @Builder.Default
    private Boolean enableLanguageBadge = false;

    @Column(name = "language_name", length = 50)
    private String languageName;

    @Column(name = "language_badge_name", length = 150)
    private String languageBadgeName;

    @Column(name = "language_badge_icon", length = 50)
    @Builder.Default
    private String languageBadgeIcon = "☕";

    @Column(name = "language_award_rank")
    @Builder.Default
    private Integer languageAwardRank = 1;

    @Column(length = 20)
    @Builder.Default
    private String status = "ACTIVE";

    @OneToMany(mappedBy = "badgeSet", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<BadgeDefinition> badges = new ArrayList<>();

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
