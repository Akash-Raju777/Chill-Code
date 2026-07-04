package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_hint_cache")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiHintCache {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String hash; // SHA-256 hash of code + compiler/runtime/WA context

    @Column(name = "ai_hint", nullable = false, columnDefinition = "TEXT")
    private String aiHint;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
