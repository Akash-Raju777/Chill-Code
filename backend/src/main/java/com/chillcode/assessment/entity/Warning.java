package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "warnings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Warning {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_test_id", nullable = false)
    private StudentTest studentTest;

    @Column(nullable = false, length = 50)
    private String type; // 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'DEVTOOLS_OPEN'

    @Column(nullable = false, length = 255)
    private String reason;

    @Column(name = "timestamp", nullable = false, updatable = false)
    private LocalDateTime timestamp = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        timestamp = LocalDateTime.now();
    }
}
