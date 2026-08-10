package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "submissions",
    indexes = {
        @Index(name = "idx_submissions_student_test", columnList = "student_test_id"),
        @Index(name = "idx_submissions_question", columnList = "question_id")
    }
)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Submission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "student_test_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private StudentTest studentTest;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private Question question;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User admin;

    @Column(nullable = false, length = 20)
    private String language;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String code;

    @Column(nullable = false, length = 30)
    private String status = "PENDING"; // 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'COMPILATION_ERROR', 'RUNTIME_ERROR'

    @Column(name = "run_time_ms")
    private Integer runTimeMs = 0;

    @Column(name = "memory_used_kb")
    private Integer memoryUsedKb = 0;

    private Integer score = 0;

    @Column(name = "total_marks")
    private Integer totalMarks = 0;

    @Column(name = "passing_marks")
    private Integer passingMarks = 0;

    @Column(name = "percentage")
    private Double percentage = 0.0;

    @Column(name = "overall_result", length = 20)
    private String overallResult; // 'PASS' or 'FAIL'

    @Column(name = "compile_error", columnDefinition = "TEXT")
    private String compileError;

    @Column(columnDefinition = "TEXT")
    private String stdout;

    @Column(columnDefinition = "TEXT")
    private String stderr;

    @Column(name = "expected_output", columnDefinition = "TEXT")
    private String expectedOutput;

    @Column(name = "actual_output", columnDefinition = "TEXT")
    private String actualOutput;

    @Column(name = "failed_test_case_number")
    private Integer failedTestCaseNumber;

    @Column(name = "passed_tests")
    private Integer passedTests = 0;

    @Column(name = "total_tests")
    private Integer totalTests = 0;

    @Column(name = "judge0_token", length = 100)
    private String judge0Token;

    @OneToMany(mappedBy = "submission")
    private java.util.List<SubmissionTestCase> submissionTestCases;

    @Column(name = "active")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
