package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BadgeSetDto {
    private Long id;
    private String name;
    private Long testId;
    private String testCode;
    private String testName;
    private Long subjectId;
    private String subjectName;
    private Integer numberOfWinners;
    private Boolean enableLanguageBadge;
    private String languageName;
    private String languageBadgeName;
    private String languageBadgeIcon;
    private Integer languageAwardRank;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<BadgeDefinitionDto> badges;
}
