package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import com.chillcode.assessment.repository.UserRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class AdminControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private UserRepository userRepository;

    private Long createdUserId;

    @AfterEach
    public void cleanup() {
        if (createdUserId != null) {
            try {
                userRepository.deleteById(createdUserId);
            } catch (Exception ignored) {}
            createdUserId = null;
        }
    }

    @Test
    @WithMockUser(username = "admin_demo", roles = {"ADMIN"})
    public void testCreateStudentSuccess() throws Exception {
        User student = User.builder()
                .name("Integration Admin Student")
                .email("it_admin_student@test.com")
                .registerNumber("it_admin_student_reg")
                .password("password")
                .role(Role.STUDENT)
                .status(UserStatus.ACTIVE)
                .build();

        String response = mockMvc.perform(post("/api/admin/students")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(student)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.email").value("it_admin_student@test.com"))
                .andReturn().getResponse().getContentAsString();

        User created = objectMapper.readValue(response, User.class);
        createdUserId = created.getId();
    }

    @Test
    @WithMockUser(username = "admin_demo", roles = {"ADMIN"})
    public void testForgiveStudentSuccess() throws Exception {
        // Given a suspended student
        User student = User.builder()
                .name("Suspended Student")
                .email("suspended_student@test.com")
                .registerNumber("suspended_reg")
                .password("password")
                .role(Role.STUDENT)
                .status(UserStatus.SUSPENDED)
                .build();
        User saved = userRepository.save(student);
        createdUserId = saved.getId();

        // When/Then forgive endpoint is called
        mockMvc.perform(post("/api/admin/student/forgive")
                .param("registerNumber", "suspended_reg"))
                .andExpect(status().isOk());

        Optional<User> updated = userRepository.findById(saved.getId());
        assertThat(updated.isPresent()).isTrue();
        assertThat(updated.get().getStatus()).isEqualTo(UserStatus.ACTIVE);
    }
}
