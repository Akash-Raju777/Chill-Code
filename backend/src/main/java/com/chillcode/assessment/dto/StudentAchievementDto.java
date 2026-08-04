package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentAchievementDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private String studentRegisterNumber;
    private String badgeName;
    private String badgeIcon;
    private String badgeCategory;
    private Long testId;
    private String testCode;
    private String testName;
    private String subjectName;
    private Integer subjectRank;
    private Integer overallRank;
    private String rankAchieved;
    private LocalDateTime awardedAt;
    private String awardedBy;
    private String status;
}
