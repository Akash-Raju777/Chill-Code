package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "achievements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Achievement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @Column(nullable = false, length = 100)
    private String title;

    @Column(nullable = false, length = 50)
    private String type; // 'GOLD', 'SILVER', 'BRONZE', 'LANGUAGE_SPECIALIST', 'CONSISTENCY'

    @Column(name = "badge_icon", length = 50)
    private String badgeIcon = "Award";

    @Column(name = "earned_at", nullable = false, updatable = false)
    private LocalDateTime earnedAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        earnedAt = LocalDateTime.now();
    }
}
