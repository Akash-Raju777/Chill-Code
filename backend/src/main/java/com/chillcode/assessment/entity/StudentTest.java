package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "student_tests",
    uniqueConstraints = {@UniqueConstraint(columnNames = {"student_id", "test_id"})},
    indexes = {
        @Index(name = "idx_student_tests_student", columnList = "student_id"),
        @Index(name = "idx_student_tests_test", columnList = "test_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class StudentTest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_id", nullable = false)
    private User student;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_id", nullable = false)
    private Test test;

    private Integer score = 0;

    @Column(length = 30)
    private String status = "ASSIGNED"; // 'ASSIGNED', 'STARTED', 'SUBMITTED', 'SUSPENDED', 'EVALUATED'

    @Column(name = "started_at")
    private LocalDateTime startedAt;

    @Column(name = "submitted_at")
    private LocalDateTime submittedAt;

    @Column(name = "warnings_count")
    private Integer warningsCount = 0;

    @Column(name = "is_suspended")
    private Boolean isSuspended = false;

    @Column(name = "ai_requests_count")
    private Integer aiRequestsCount = 0;

    @Column(name = "reattempt_status", length = 30)
    private String reattemptStatus;

    @Column(name = "time_taken_seconds")
    @Builder.Default
    private Long timeTakenSeconds = 0L;

    @Column(name = "auto_submitted")
    @Builder.Default
    private Boolean autoSubmitted = false;

    @Column(name = "pass_fail_status", length = 10)
    @Builder.Default
    private String passFailStatus = "PENDING"; // 'PASS', 'FAIL', 'PENDING'

    @Column(name = "test_cases_passed")
    @Builder.Default
    private Integer testCasesPassed = 0;

    @Column(name = "total_test_cases")
    @Builder.Default
    private Integer totalTestCases = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
