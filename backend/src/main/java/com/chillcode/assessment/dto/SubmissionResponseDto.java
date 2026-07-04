package com.chillcode.assessment.dto;

import lombok.*;

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
}
