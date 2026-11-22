package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.ActivityLog;
import com.chillcode.assessment.repository.ActivityLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/super-admin/audit-logs")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AuditLogController {

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @GetMapping
    public ResponseEntity<List<Map<String, Object>>> getAllAuditLogs(
            @RequestParam(required = false) Long userId,
            @RequestParam(defaultValue = "100") int limit) {
        List<ActivityLog> logs;
        if (userId != null) {
            logs = activityLogRepository.findByUserIdOrderByTimestampDesc(userId);
        } else {
            logs = activityLogRepository.findAll();
            logs.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        }
        List<Map<String, Object>> result = new ArrayList<>();
        int count = 0;
        for (ActivityLog log : logs) {
            if (count >= limit) break;
            Map<String, Object> item = new HashMap<>();
            item.put("id", log.getId());
            item.put("userId", log.getUser() != null ? log.getUser().getId() : null);
            item.put("userName", log.getUser() != null ? log.getUser().getName() : "Unknown");
            item.put("userRole", log.getUser() != null ? log.getUser().getRole() : "UNKNOWN");
            item.put("action", log.getAction());
            item.put("details", log.getDetails());
            item.put("ipAddress", log.getIpAddress());
            item.put("timestamp", log.getTimestamp());
            result.add(item);
            count++;
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/recent")
    public ResponseEntity<List<Map<String, Object>>> getRecentAuditLogs(
            @RequestParam(defaultValue = "20") int limit) {
        List<ActivityLog> logs = activityLogRepository.findAll();
        logs.sort((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()));
        List<Map<String, Object>> result = new ArrayList<>();
        int count = 0;
        for (ActivityLog log : logs) {
            if (count >= limit) break;
            Map<String, Object> item = new HashMap<>();
            item.put("id", log.getId());
            item.put("userName", log.getUser() != null ? log.getUser().getName() : "Unknown");
            item.put("userRole", log.getUser() != null ? log.getUser().getRole() : "UNKNOWN");
            item.put("action", log.getAction());
            item.put("details", log.getDetails());
            item.put("timestamp", log.getTimestamp());
            result.add(item);
            count++;
        }
        return ResponseEntity.ok(result);
    }
}
