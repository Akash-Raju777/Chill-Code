package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.BadgeDto;
import com.chillcode.assessment.dto.StudentBadgeDto;
import com.chillcode.assessment.security.CustomUserDetails;
import com.chillcode.assessment.service.BadgeService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BadgeController {

    @Autowired
    private BadgeService badgeService;

    // --- Student Endpoints ---

    @GetMapping("/student/badges/locked-unlocked")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<BadgeDto>> getMyAchievements(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<BadgeDto> badges = badgeService.getBadgesForStudentWithLockStatus(userDetails.getUser().getId());
        return ResponseEntity.ok(badges);
    }

    @GetMapping("/student/badges/earned")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<StudentBadgeDto>> getMyEarnedBadges(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<StudentBadgeDto> badges = badgeService.getStudentBadges(userDetails.getUser().getId());
        return ResponseEntity.ok(badges);
    }

    // --- Admin Endpoints ---

    @GetMapping("/admin/badges")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<BadgeDto>> getAllBadges() {
        return ResponseEntity.ok(badgeService.getAllBadges());
    }

    @PostMapping("/admin/badges")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BadgeDto> createBadge(@RequestBody BadgeDto dto) {
        return ResponseEntity.ok(badgeService.createBadge(dto));
    }

    @PutMapping("/admin/badges/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BadgeDto> updateBadge(@PathVariable Long id, @RequestBody BadgeDto dto) {
        return ResponseEntity.ok(badgeService.updateBadge(id, dto));
    }

    @DeleteMapping("/admin/badges/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteBadge(@PathVariable Long id) {
        badgeService.deleteBadge(id);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/admin/badges/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleBadgeStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "ACTIVE");
        badgeService.toggleBadgeStatus(id, status);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/admin/badges/student-badges")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<StudentBadgeDto>> getAllStudentAchievements() {
        return ResponseEntity.ok(badgeService.getAllEarnedBadges());
    }

    @PostMapping("/admin/badges/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<StudentBadgeDto> assignBadgeManually(@RequestBody Map<String, Object> payload) {
        Long studentId = ((Number) payload.get("studentId")).longValue();
        Long badgeId = ((Number) payload.get("badgeId")).longValue();
        Long testId = null;
        if (payload.containsKey("testId") && payload.get("testId") != null) {
            testId = ((Number) payload.get("testId")).longValue();
        }
        return ResponseEntity.ok(badgeService.assignBadgeManually(studentId, badgeId, testId));
    }

    @PostMapping("/admin/badges/remove")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> removeBadgeManually(@RequestBody Map<String, Object> payload) {
        Long studentId = ((Number) payload.get("studentId")).longValue();
        Long badgeId = ((Number) payload.get("badgeId")).longValue();
        badgeService.removeBadgeManually(studentId, badgeId);
        return ResponseEntity.ok().build();
    }
}
