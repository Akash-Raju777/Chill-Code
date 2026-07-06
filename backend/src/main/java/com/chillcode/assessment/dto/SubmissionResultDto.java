package com.chillcode.assessment.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubmissionResultDto {
    private String status; // 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'COMPILATION_ERROR', 'RUNTIME_ERROR'
    private Integer runTimeMs;
    private Integer memoryUsedKb;
    private String compileError;
    private List<TestCaseResultDto> testCaseResults;
    private String stdout;
    private String stderr;
    private Integer exitCode;
    private String aiExplanation;
    
    // New fields for judging metrics
    private Integer passedTests;
    private Integer totalTests;
    private String expectedOutput;
    private String actualOutput;
    private Integer failedTestCaseNumber;
    private String judge0Status;
    private Long submissionId;
}


