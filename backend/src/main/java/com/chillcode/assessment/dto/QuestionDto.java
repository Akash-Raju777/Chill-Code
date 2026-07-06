package com.chillcode.assessment.dto;

import com.chillcode.assessment.entity.Difficulty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionDto {
    private Long id;
    private Long subjectId;
    private String title;
    private Difficulty difficulty;
    private String problemStatement;
    private String constraints;
    private String inputFormat;
    private String outputFormat;
    private String allowedLanguages;
    private String tags;
    private List<TestCaseDto> testCases;
    
    // Status tracking fields
    private String status; // 'COMPLETED', 'NOT_COMPLETED'
    private Integer attemptCount;
    private String lastAttemptAt;
}
