package com.chillcode.assessment.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class LoginRequest {
    @NotBlank(message = "Username or register number is required")
    private String identifier;

    @NotBlank(message = "Password is required")
    private String password;
}
