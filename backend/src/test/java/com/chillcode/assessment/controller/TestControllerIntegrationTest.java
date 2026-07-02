package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.repository.SubjectRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
public class TestControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private SubjectRepository subjectRepository;

    private Long createdSubjectId;

    @AfterEach
    public void cleanup() {
        if (createdSubjectId != null) {
            try {
                subjectRepository.deleteById(createdSubjectId);
            } catch (Exception ignored) {}
            createdSubjectId = null;
        }
    }

    @Test
    @WithMockUser(username = "admin_demo", roles = {"ADMIN"})
    public void testCreateSubjectSuccess() throws Exception {
        Subject subject = Subject.builder()
                .name("Integration Test Subject")
                .description("IT Subject Description")
                .build();

        String response = mockMvc.perform(post("/api/admin/subjects")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(subject)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").exists())
                .andExpect(jsonPath("$.name").value("Integration Test Subject"))
                .andReturn().getResponse().getContentAsString();

        Subject created = objectMapper.readValue(response, Subject.class);
        createdSubjectId = created.getId();
    }

    @Test
    @WithMockUser(username = "student_demo", roles = {"STUDENT"})
    public void testGetStudentTestsSuccess() throws Exception {
        mockMvc.perform(get("/api/student/tests"))
                .andExpect(status().isOk());
    }
}
