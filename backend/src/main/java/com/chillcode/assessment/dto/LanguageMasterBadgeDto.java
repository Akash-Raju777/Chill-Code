package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LanguageMasterBadgeDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private String studentRegisterNumber;
    private Long testId;
    private String testCode;
    private String testName;
    private String subject;
    private String badgeName;
    private String badgeIcon;
    private Integer awardedRank;
    private LocalDateTime awardedDate;
}
