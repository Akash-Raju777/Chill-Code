package com.chillcode.assessment.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestCaseResultDto {
    private Long testCaseId;
    private String status; // 'PASSED', 'FAILED', 'TLE', 'RTE'
    private Integer runTimeMs;
    private Integer memoryUsedKb;
    private String message;
    private String inputData;
    private String expectedOutput;
    private String actualOutput;
}
