package com.chillcode.assessment.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestCaseDto {
    private Long id;
    private String inputData;
    private String expectedOutput;
    private Boolean isHidden;
}
