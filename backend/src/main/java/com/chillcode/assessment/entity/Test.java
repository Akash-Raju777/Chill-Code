package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "tests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Test {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User admin;

    @Column(nullable = false, length = 150)
    private String name;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalDateTime endTime;

    @Column(name = "max_marks")
    private Integer maxMarks = 100;

    @Column(columnDefinition = "TEXT")
    private String instructions;

    @Column(name = "shuffle_questions")
    private Boolean shuffleQuestions = false;

    @Column(name = "auto_submit")
    private Boolean autoSubmit = true;

    @Column(name = "negative_marking")
    private Boolean negativeMarking = false;

    @Column(name = "security_shield_enabled")
    @Builder.Default
    private Boolean securityShieldEnabled = false;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "test_questions",
        joinColumns = @JoinColumn(name = "test_id"),
        inverseJoinColumns = @JoinColumn(name = "question_id")
    )
    @Builder.Default
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Set<Question> questions = new HashSet<>();

    @Column(name = "test_code", length = 50)
    private String testCode;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (testCode == null || testCode.trim().isEmpty()) {
            String prefix = (subject != null && subject.getName() != null) ? 
                    subject.getName().replaceAll("[^a-zA-Z]", "").toUpperCase() : "TEST";
            if (prefix.length() > 6) prefix = prefix.substring(0, 6);
            testCode = prefix + "-" + String.format("%03d", id != null ? id : System.currentTimeMillis() % 1000);
        }
    }
}
