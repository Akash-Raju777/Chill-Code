package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.BadgeSetDto;
import com.chillcode.assessment.dto.StudentAchievementDto;
import com.chillcode.assessment.security.CustomUserDetails;
import com.chillcode.assessment.service.BadgeSetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BadgeSetController {

    @Autowired
    private BadgeSetService badgeSetService;

    // --- Student Achievements (ONLY Earned Badges) ---

    @GetMapping("/student/achievements")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<StudentAchievementDto>> getMyAchievements(@AuthenticationPrincipal CustomUserDetails userDetails) {
        List<StudentAchievementDto> achievements = badgeSetService.getStudentAchievements(userDetails.getUser().getId());
        return ResponseEntity.ok(achievements);
    }

    @GetMapping("/student/language-badges")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<com.chillcode.assessment.dto.LanguageMasterBadgeDto>> getMyLanguageBadges(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return ResponseEntity.ok(badgeSetService.getStudentLanguageBadges(userDetails.getUser().getId()));
    }

    // --- Admin Badge Sets Management & Achievements ---

    @GetMapping("/admin/badge-sets")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<BadgeSetDto>> getAllBadgeSets() {
        return ResponseEntity.ok(badgeSetService.getAllBadgeSets());
    }

    @PostMapping("/admin/badge-sets")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BadgeSetDto> createBadgeSet(@RequestBody BadgeSetDto dto) {
        return ResponseEntity.ok(badgeSetService.createBadgeSet(dto));
    }

    @PutMapping("/admin/badge-sets/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BadgeSetDto> updateBadgeSet(@PathVariable Long id, @RequestBody BadgeSetDto dto) {
        return ResponseEntity.ok(badgeSetService.updateBadgeSet(id, dto));
    }

    @DeleteMapping("/admin/badge-sets/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> deleteBadgeSet(@PathVariable Long id) {
        badgeSetService.deleteBadgeSet(id);
        return ResponseEntity.ok().build();
    }

    @PatchMapping("/admin/badge-sets/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> toggleBadgeSetStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        String status = body.getOrDefault("status", "ACTIVE");
        badgeSetService.toggleBadgeSetStatus(id, status);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/admin/achievements")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<StudentAchievementDto>> getAllStudentAchievements() {
        return ResponseEntity.ok(badgeSetService.getAllStudentAchievements());
    }

    @GetMapping("/admin/badge-sets/{id}/winners")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<StudentAchievementDto>> getBadgeSetWinners(@PathVariable Long id) {
        return ResponseEntity.ok(badgeSetService.getBadgeSetWinners(id));
    }
}
