package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudentBadgeDto {
    private Long id;
    private Long studentId;
    private String studentName;
    private String studentRegisterNumber;
    private BadgeDto badge;
    private LocalDateTime earnedAt;
    private Long sourceTestId;
    private String sourceTestName;
    private String status;
}
