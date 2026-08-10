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
    private String questionCode;
    private Integer timer;
    private String allowedLanguages;
    private String tags;
    private Integer totalMarks;
    private Integer passingMarks;
    private Double negativeMarks;
    private Boolean partialMarksEnabled;
    private List<TestCaseDto> testCases;
    
    // Status tracking fields
    private String status; // 'COMPLETED', 'NOT_COMPLETED'
    private Integer attemptCount;
    private String lastAttemptAt;
    private Integer score;
    private String overallResult;

    // Test & Badge Management fields (Question-specific single source of truth)
    private Long testId;
    private Boolean enableBadgeManagement;
    private Long badgeSetId;
    private String badgeSetName;
    private Integer badgeWinnersCount;
    private Boolean enableLanguageBadge;
    private String languageName;
    private String languageBadgeName;
    private String languageBadgeIcon;
    private Integer languageAwardRank;
    private List<BadgeDefinitionDto> badgeDefs;
    private BadgeSetDto badgeSet;
}
