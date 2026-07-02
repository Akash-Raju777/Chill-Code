package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "submission_test_cases")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionTestCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submission_id", nullable = false)
    private Submission submission;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "test_case_id", nullable = false)
    private TestCase testCase;

    @Column(nullable = false, length = 30)
    private String status; // 'PASSED', 'FAILED', 'TLE', 'RTE'

    @Column(name = "run_time_ms")
    private Integer runTimeMs = 0;

    @Column(name = "memory_used_kb")
    private Integer memoryUsedKb = 0;

    @Column(length = 255)
    private String message;
}
