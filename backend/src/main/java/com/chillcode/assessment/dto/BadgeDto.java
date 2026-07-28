package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BadgeDto {
    private Long id;
    private String name;
    private String description;
    private String icon;
    private String type; // 'SUBJECT_RANKING', 'LANGUAGE_MASTER', 'CONTEST', 'CUSTOM'
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private List<BadgeRuleDto> rules;
    private Integer earnedCount;
    private Boolean isUnlocked;
    private LocalDateTime earnedAt;
}
