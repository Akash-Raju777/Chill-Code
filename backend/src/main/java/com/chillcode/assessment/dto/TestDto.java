package com.chillcode.assessment.dto;

import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TestDto {
    private Long id;
    private Long subjectId;
    private String name;
    private Integer durationMinutes;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer maxMarks;
    private String instructions;
    private Boolean shuffleQuestions;
    private Boolean autoSubmit;
    private Boolean negativeMarking;
    private List<Long> questionIds;
    private List<Long> studentIds; // Assign to specific students
    private String targetBatch;    // Or assign to batch/department
}
