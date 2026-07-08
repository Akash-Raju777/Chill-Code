package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.AuthResponse;
import com.chillcode.assessment.dto.LoginRequest;
import com.chillcode.assessment.dto.RegisterRequest;
import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.security.JwtUtils;
import com.chillcode.assessment.security.UserDetailsServiceImpl;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserDetailsServiceImpl userDetailsService;

    @Autowired
    private JwtUtils jwtUtils;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest registerRequest) {
        if (registerRequest.getRole() == Role.STUDENT) {
            if (registerRequest.getRegisterNumber() == null || registerRequest.getRegisterNumber().isBlank()) {
                return ResponseEntity.badRequest().body("Register number is required for students.");
            }
            if (userRepository.existsByRegisterNumber(registerRequest.getRegisterNumber())) {
                return ResponseEntity.badRequest().body("Register number is already taken.");
            }
        } else if (registerRequest.getRole() == Role.ADMIN) {
            if (registerRequest.getUsername() == null || registerRequest.getUsername().isBlank()) {
                return ResponseEntity.badRequest().body("Username is required for admins.");
            }
            if (userRepository.existsByUsername(registerRequest.getUsername())) {
                return ResponseEntity.badRequest().body("Username is already taken.");
            }
        }

        if (userRepository.existsByEmail(registerRequest.getEmail())) {
            return ResponseEntity.badRequest().body("Email is already registered.");
        }

        User user = User.builder()
                .name(registerRequest.getName())
                .email(registerRequest.getEmail())
                .phone(registerRequest.getPhone())
                .password(passwordEncoder.encode(registerRequest.getPassword()))
                .role(registerRequest.getRole())
                .registerNumber(registerRequest.getRole() == Role.STUDENT ? registerRequest.getRegisterNumber() : null)
                .username(registerRequest.getRole() == Role.ADMIN ? registerRequest.getUsername() : null)
                .status(UserStatus.ACTIVE)
                .build();

        userRepository.save(user);
        return ResponseEntity.ok("User registered successfully");
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@Valid @RequestBody LoginRequest loginRequest) {
        try {
            authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getIdentifier(), loginRequest.getPassword())
            );
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }

        UserDetails userDetails = userDetailsService.loadUserByUsername(loginRequest.getIdentifier());
        
        // Load User from DB to send details
        User user = null;
        if (userRepository.existsByRegisterNumber(userDetails.getUsername())) {
            user = userRepository.findByRegisterNumber(userDetails.getUsername()).orElse(null);
        } else if (userRepository.existsByUsername(userDetails.getUsername())) {
            user = userRepository.findByUsername(userDetails.getUsername()).orElse(null);
        } else {
            user = userRepository.findByEmail(userDetails.getUsername()).orElse(null);
        }

        if (user == null) {
            return ResponseEntity.status(404).body("User record not found");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            return ResponseEntity.status(403).body("Your account is suspended.");
        }
        if (user.getStatus() == UserStatus.INACTIVE) {
            return ResponseEntity.status(403).body("Your account is inactive.");
        }

        String token = jwtUtils.generateToken(userDetails, user.getRole().name());

        AuthResponse authResponse = AuthResponse.builder()
                .token(token)
                .id(user.getId())
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole().name())
                .registerNumber(user.getRegisterNumber())
                .username(user.getUsername())
                .status(user.getStatus().name())
                .department(user.getDepartment())
                .build();

        return ResponseEntity.ok(authResponse);
    }
}
