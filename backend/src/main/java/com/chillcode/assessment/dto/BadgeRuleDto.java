package com.chillcode.assessment.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BadgeRuleDto {
    private Long id;
    private Long badgeId;
    private String category; // 'LANGUAGE', 'SUBJECT', 'GENERAL'
    private Long targetSubjectId;
    private String targetSubjectName;
    private String targetLanguage;
    private Integer minAcceptedTests;
    private Double minAvgScore;
    private Integer minProblemsSolved;
    private Integer rankPosition;
    private String status;
}
