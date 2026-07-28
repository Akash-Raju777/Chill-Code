package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SubjectRankingDto {
    private Long id;
    private Long subjectId;
    private String subjectName;
    private Long studentId;
    private String studentName;
    private String studentRegisterNumber;
    private Integer rankPosition;
    private Integer totalScore;
    private Integer testCasesPassed;
    private Long totalTimeTakenSeconds;
    private LocalDateTime lastSubmissionTime;
    private String badgeIcon; // 🥇, 🥈, 🥉
}
