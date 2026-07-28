package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "badge_definitions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class BadgeDefinition {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "badge_set_id", nullable = false)
    private BadgeSet badgeSet;

    @Column(name = "rank_position", nullable = false)
    private Integer rankPosition;

    @Column(name = "badge_name", nullable = false, length = 150)
    private String badgeName;

    @Column(name = "badge_icon", length = 100)
    @Builder.Default
    private String badgeIcon = "Award";

    @Column(name = "badge_color", length = 30)
    @Builder.Default
    private String badgeColor = "#f59e0b";

    @Column(name = "badge_order")
    @Builder.Default
    private Integer badgeOrder = 1;

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
