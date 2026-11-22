package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.WorkAssignment;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.repository.WorkAssignmentRepository;
import com.chillcode.assessment.security.SecurityUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api/super-admin/work-assignments")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class WorkAssignmentController {

    @Autowired
    private WorkAssignmentRepository workAssignmentRepository;

    @Autowired
    private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllAssignments() {
        List<WorkAssignment> assignments = workAssignmentRepository.findAll();
        List<Map<String, Object>> result = new ArrayList<>();
        for (WorkAssignment a : assignments) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", a.getId());
            item.put("title", a.getTitle());
            item.put("description", a.getDescription());
            item.put("assignedToId", a.getAssignedTo() != null ? a.getAssignedTo().getId() : null);
            item.put("assignedToName", a.getAssignedTo() != null ? a.getAssignedTo().getName() : "Unassigned");
            item.put("assignedToStaffId", a.getAssignedTo() != null ? a.getAssignedTo().getUsername() : "N/A");
            item.put("assignedById", a.getAssignedBy() != null ? a.getAssignedBy().getId() : null);
            item.put("assignedByName", a.getAssignedBy() != null ? a.getAssignedBy().getName() : "N/A");
            item.put("priority", a.getPriority());
            item.put("startDate", a.getStartDate());
            item.put("dueDate", a.getDueDate());
            item.put("status", a.getStatus());
            item.put("createdAt", a.getCreatedAt());
            item.put("updatedAt", a.getUpdatedAt());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getAssignmentById(@PathVariable Long id) {
        WorkAssignment a = workAssignmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assignment not found"));
        Map<String, Object> item = new HashMap<>();
        item.put("id", a.getId());
        item.put("title", a.getTitle());
        item.put("description", a.getDescription());
        item.put("assignedToId", a.getAssignedTo() != null ? a.getAssignedTo().getId() : null);
        item.put("assignedToName", a.getAssignedTo() != null ? a.getAssignedTo().getName() : "Unassigned");
        item.put("assignedById", a.getAssignedBy() != null ? a.getAssignedBy().getId() : null);
        item.put("assignedByName", a.getAssignedBy() != null ? a.getAssignedBy().getName() : "N/A");
        item.put("priority", a.getPriority());
        item.put("startDate", a.getStartDate());
        item.put("dueDate", a.getDueDate());
        item.put("status", a.getStatus());
        item.put("createdAt", a.getCreatedAt());
        item.put("updatedAt", a.getUpdatedAt());
        return ResponseEntity.ok(item);
    }

    @PostMapping
    public ResponseEntity<?> createAssignment(@RequestBody Map<String, Object> payload) {
        String title = (String) payload.get("title");
        String description = (String) payload.get("description");
        Long assignedToId = ((Number) payload.get("assignedToId")).longValue();
        String priority = (String) payload.get("priority");
        String dueDateStr = (String) payload.get("dueDate");

        User assignedTo = userRepository.findById(assignedToId)
                .orElseThrow(() -> new RuntimeException("Assigned staff not found"));
        User assignedBy = userRepository.findById(SecurityUtils.getCurrentAdminId())
                .orElseThrow(() -> new RuntimeException("Current user not found"));

        WorkAssignment assignment = new WorkAssignment();
        assignment.setTitle(title);
        assignment.setDescription(description);
        assignment.setAssignedTo(assignedTo);
        assignment.setAssignedBy(assignedBy);
        assignment.setPriority(priority != null ? priority : "MEDIUM");
        assignment.setStartDate(LocalDateTime.now());
        assignment.setDueDate(dueDateStr != null ? LocalDateTime.parse(dueDateStr) : LocalDateTime.now().plusDays(7));
        assignment.setStatus("PENDING");

        WorkAssignment saved = workAssignmentRepository.save(assignment);
        return ResponseEntity.ok(saved);
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> updateAssignment(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        WorkAssignment assignment = workAssignmentRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Assignment not found"));
        if (payload.containsKey("title")) assignment.setTitle((String) payload.get("title"));
        if (payload.containsKey("description")) assignment.setDescription((String) payload.get("description"));
        if (payload.containsKey("priority")) assignment.setPriority((String) payload.get("priority"));
        if (payload.containsKey("status")) assignment.setStatus((String) payload.get("status"));
        if (payload.containsKey("dueDate")) {
            assignment.setDueDate(LocalDateTime.parse((String) payload.get("dueDate")));
        }
        if (payload.containsKey("assignedToId")) {
            User assignedTo = userRepository.findById(((Number) payload.get("assignedToId")).longValue())
                    .orElseThrow(() -> new RuntimeException("Assigned staff not found"));
            assignment.setAssignedTo(assignedTo);
        }
        workAssignmentRepository.save(assignment);
        return ResponseEntity.ok(assignment);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAssignment(@PathVariable Long id) {
        workAssignmentRepository.deleteById(id);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/staff/{staffId}")
    public ResponseEntity<List<Map<String, Object>>> getAssignmentsByStaff(@PathVariable Long staffId) {
        List<WorkAssignment> assignments = workAssignmentRepository.findByAssignedToId(staffId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (WorkAssignment a : assignments) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", a.getId());
            item.put("title", a.getTitle());
            item.put("priority", a.getPriority());
            item.put("dueDate", a.getDueDate());
            item.put("status", a.getStatus());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }
}
