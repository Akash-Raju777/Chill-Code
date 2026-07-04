package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.QuestionDto;
import com.chillcode.assessment.service.QuestionService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class QuestionController {

    private static final Logger log = LoggerFactory.getLogger(QuestionController.class);

    @Autowired
    private QuestionService questionService;

    // Both Admin and Student can get questions list of a subject
    @GetMapping({"/admin/subjects/{subjectId}/questions", "/student/subjects/{subjectId}/questions"})
    public ResponseEntity<List<QuestionDto>> getQuestionsBySubject(@PathVariable("subjectId") Long subjectId) {
        log.info("API Request: Load questions for subject ID: {}", subjectId);
        return ResponseEntity.ok(questionService.getQuestionsBySubject(subjectId));
    }

    @GetMapping({"/admin/questions", "/student/questions"})
    public ResponseEntity<List<QuestionDto>> getAllQuestions() {
        log.info("API Request: Load all questions");
        return ResponseEntity.ok(questionService.getAllQuestions());
    }

    @GetMapping({"/admin/questions/{id}", "/student/questions/{id}"})
    public ResponseEntity<QuestionDto> getQuestionById(@PathVariable("id") Long id) {
        log.info("API Request: Load question by ID: {}", id);
        return ResponseEntity.ok(questionService.getQuestionById(id));
    }

    @PostMapping("/admin/questions")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<QuestionDto> createQuestion(@RequestBody QuestionDto questionDto) {
        log.info("API Request: Create question with title: {}", questionDto.getTitle());
        return ResponseEntity.ok(questionService.createQuestion(questionDto));
    }

    @PutMapping("/admin/questions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<QuestionDto> updateQuestion(@PathVariable("id") Long id, @RequestBody QuestionDto questionDto) {
        log.info("API Request: Update question ID: {} with title: {}", id, questionDto.getTitle());
        return ResponseEntity.ok(questionService.updateQuestion(id, questionDto));
    }

    @DeleteMapping("/admin/questions/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteQuestion(@PathVariable("id") Long id) {
        log.info("API Request: Delete question ID: {}", id);
        questionService.deleteQuestion(id);
        return ResponseEntity.noContent().build();
    }
}
