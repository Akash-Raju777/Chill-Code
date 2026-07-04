package com.chillcode.assessment.controller;

import com.chillcode.assessment.service.AshBotService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/ash")
@PreAuthorize("hasRole('ADMIN')")
public class AshBotController {

    @Autowired
    private AshBotService ashBotService;

    @PostMapping("/chat")
    public ResponseEntity<Map<String, String>> chatWithAsh(@RequestBody Map<String, String> request) {
        String userQuery = request.get("message");
        if (userQuery == null || userQuery.trim().isBlank()) {
            Map<String, String> err = new HashMap<>();
            err.put("error", "Message cannot be empty.");
            return ResponseEntity.badRequest().body(err);
        }

        String ashResponse = ashBotService.askAsh(userQuery);
        
        Map<String, String> responseMap = new HashMap<>();
        responseMap.put("response", ashResponse);
        return ResponseEntity.ok(responseMap);
    }
}
