package com.chillcode.assessment.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SubmitRequest {
    private String code;
    private String language;
    private Long questionId;
    private Long studentTestId;
    private String customInput;
    private String customInput2;
    private String customInput3;
    private Boolean runOnly;
}
