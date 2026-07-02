package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.service.SubjectService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class SubjectController {

    @Autowired
    private SubjectService subjectService;

    // Both Admin and Student can get subjects list
    @GetMapping({"/admin/subjects", "/student/subjects"})
    public ResponseEntity<List<Subject>> getAllSubjects() {
        return ResponseEntity.ok(subjectService.getAllSubjects());
    }

    @PostMapping("/admin/subjects")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Subject> createSubject(@RequestBody Subject subject) {
        return ResponseEntity.ok(subjectService.createSubject(subject));
    }

    @PutMapping("/admin/subjects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Subject> updateSubject(@PathVariable("id") Long id, @RequestBody Subject subjectDetails) {
        return ResponseEntity.ok(subjectService.updateSubject(id, subjectDetails));
    }

    @DeleteMapping("/admin/subjects/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<String> deleteSubject(@PathVariable("id") Long id) {
        subjectService.deleteSubject(id);
        return ResponseEntity.ok("Subject deleted successfully");
    }

    @GetMapping("/admin/subjects/{id}/stats")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<com.chillcode.assessment.dto.SubjectStatsDto> getSubjectStats(@PathVariable("id") Long id) {
        return ResponseEntity.ok(subjectService.getSubjectStats(id));
    }
}
