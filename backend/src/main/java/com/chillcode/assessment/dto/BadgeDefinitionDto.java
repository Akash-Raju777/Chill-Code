package com.chillcode.assessment.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BadgeDefinitionDto {
    private Long id;
    private Long badgeSetId;
    private Integer rankPosition;
    private String badgeName;
    private String badgeIcon;
    private String badgeColor;
    private Integer badgeOrder;
    private String status;
}
