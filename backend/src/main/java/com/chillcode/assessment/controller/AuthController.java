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
        org.springframework.security.core.Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(loginRequest.getIdentifier(), loginRequest.getPassword())
            );
        } catch (Exception e) {
            return ResponseEntity.status(401).body("Invalid credentials");
        }

        // High-Performance: extract User directly from authenticated CustomUserDetails principal
        // Eliminates 2 redundant remote DB queries to Supabase on every login!
        com.chillcode.assessment.security.CustomUserDetails userDetails = 
                (com.chillcode.assessment.security.CustomUserDetails) authentication.getPrincipal();
        User user = userDetails.getUser();

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

    @PostMapping("/refresh")
    public ResponseEntity<?> refreshToken(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody(required = false) java.util.Map<String, String> body) {
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        } else if (body != null && body.containsKey("token")) {
            token = body.get("token");
        }

        if (token == null || token.trim().isEmpty()) {
            return ResponseEntity.status(401).body("Missing token for refresh");
        }

        String username = jwtUtils.extractUsernameEvenIfExpired(token);
        if (username == null) {
            return ResponseEntity.status(401).body("Invalid or untrusted token signature");
        }

        User user = userRepository.findByIdentifier(username).orElse(null);
        if (user == null) {
            return ResponseEntity.status(404).body("User record not found");
        }

        if (user.getStatus() == UserStatus.SUSPENDED) {
            return ResponseEntity.status(403).body("Your account is suspended.");
        }
        if (user.getStatus() == UserStatus.INACTIVE) {
            return ResponseEntity.status(403).body("Your account is inactive.");
        }

        UserDetails userDetails = new com.chillcode.assessment.security.CustomUserDetails(user, username);
        String newToken = jwtUtils.generateToken(userDetails, user.getRole().name());

        AuthResponse authResponse = AuthResponse.builder()
                .token(newToken)
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

    @GetMapping("/me")
    public ResponseEntity<?> getCurrentUserSession() {
        User user = com.chillcode.assessment.security.SecurityUtils.getCurrentUser();
        if (user == null) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.UNAUTHORIZED).body("Session invalid or expired");
        }
        if (user.getStatus() == UserStatus.INACTIVE || user.getStatus() == UserStatus.SUSPENDED) {
            return ResponseEntity.status(org.springframework.http.HttpStatus.FORBIDDEN)
                    .body("Your account is " + user.getStatus().name().toLowerCase() + ".");
        }
        AuthResponse authResponse = AuthResponse.builder()
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

    @GetMapping("/health")
    public ResponseEntity<?> healthCheck() {
        return ResponseEntity.ok(java.util.Map.of("status", "UP", "timestamp", System.currentTimeMillis()));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout() {
        org.springframework.security.core.context.SecurityContextHolder.clearContext();
        return ResponseEntity.ok(java.util.Map.of("message", "Logged out successfully"));
    }

    @GetMapping("/ping")
    public ResponseEntity<?> ping() {
        return ResponseEntity.ok("PONG");
    }
}
