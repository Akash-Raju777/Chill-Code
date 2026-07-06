package com.chillcode.assessment.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionResponseDto {
    private String status;
    private String compilerOutput;
    private String runtimeOutput;
    private String aiHint;
    private List<TestCaseResultDto> testCaseResults;
    
    // New fields for judging metrics
    private Integer executionTimeMs;
    private Integer memoryUsedKb;
    private Integer passedTests;
    private Integer totalTests;
    private String expectedOutput;
    private String actualOutput;
    private Integer failedTestCaseNumber;
    private String judge0Status;
}
