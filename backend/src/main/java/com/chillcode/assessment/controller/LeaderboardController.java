package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.SubjectRankingDto;
import com.chillcode.assessment.service.RankingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class LeaderboardController {

    @Autowired
    private RankingService rankingService;

    @GetMapping("/student/leaderboard/subject/{subjectId}")
    public ResponseEntity<List<SubjectRankingDto>> getSubjectLeaderboard(@PathVariable Long subjectId) {
        return ResponseEntity.ok(rankingService.getSubjectLeaderboard(subjectId));
    }

    @GetMapping("/student/leaderboard/top/{subjectId}")
    public ResponseEntity<List<SubjectRankingDto>> getTopSubjectRankings(
            @PathVariable Long subjectId,
            @RequestParam(defaultValue = "10") int limit) {
        return ResponseEntity.ok(rankingService.getTopSubjectRankings(subjectId, limit));
    }

    @PostMapping("/admin/leaderboard/recalculate/{subjectId}")
    public ResponseEntity<List<SubjectRankingDto>> recalculateRankings(@PathVariable Long subjectId) {
        rankingService.updateSubjectRankings(subjectId);
        return ResponseEntity.ok(rankingService.getSubjectLeaderboard(subjectId));
    }
}
