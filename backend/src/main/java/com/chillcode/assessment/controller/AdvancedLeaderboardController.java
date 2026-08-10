package com.chillcode.assessment.controller;

import com.chillcode.assessment.dto.StudentAchievementDto;
import com.chillcode.assessment.dto.LanguageMasterBadgeDto;
import com.chillcode.assessment.security.CustomUserDetails;
import com.chillcode.assessment.service.BadgeSetService;
import com.chillcode.assessment.service.OverallLeaderboardService;
import com.chillcode.assessment.service.OverallLeaderboardService.OverallLeaderboardEntry;
import com.chillcode.assessment.service.RankingService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class AdvancedLeaderboardController {

    private final OverallLeaderboardService overallLeaderboardService;
    private final BadgeSetService badgeSetService;
    private final RankingService rankingService;

    public AdvancedLeaderboardController(OverallLeaderboardService overallLeaderboardService,
                                         BadgeSetService badgeSetService,
                                         RankingService rankingService) {
        this.overallLeaderboardService = overallLeaderboardService;
        this.badgeSetService = badgeSetService;
        this.rankingService = rankingService;
    }

    @GetMapping("/student/leaderboard/overall")
    public ResponseEntity<List<OverallLeaderboardEntry>> getOverallLeaderboard(
            @RequestParam(required = false, defaultValue = "ALL") String timeFilter,
            @RequestParam(required = false, defaultValue = "ALL") String departmentFilter) {
        return ResponseEntity.ok(overallLeaderboardService.getOverallLeaderboard(timeFilter, departmentFilter));
    }

    @GetMapping("/student/leaderboard/summary")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<Map<String, Object>> getStudentSummaryMetrics(@AuthenticationPrincipal CustomUserDetails userDetails) {
        Long studentId = userDetails.getUser().getId();

        List<OverallLeaderboardEntry> overall = overallLeaderboardService.getOverallLeaderboard("ALL", "ALL");
        int myOverallRank = 0;
        for (OverallLeaderboardEntry e : overall) {
            if (e.studentId.equals(studentId)) {
                myOverallRank = e.rankPosition;
                break;
            }
        }

        List<StudentAchievementDto> achievements = badgeSetService.getStudentAchievements(studentId);
        List<LanguageMasterBadgeDto> langBadges = badgeSetService.getStudentLanguageBadges(studentId);

        int totalBadgesEarned = achievements.size();

        Object recent = null;
        java.time.LocalDateTime recentTime = null;

        if (!achievements.isEmpty()) {
            recent = achievements.get(0);
            recentTime = achievements.get(0).getAwardedAt();
        }

        if (langBadges != null && !langBadges.isEmpty()) {
            java.time.LocalDateTime langTime = langBadges.get(0).getAwardedDate();
            if (recentTime == null || (langTime != null && langTime.isAfter(recentTime))) {
                LanguageMasterBadgeDto lmb = langBadges.get(0);
                recent = StudentAchievementDto.builder()
                        .badgeName(lmb.getBadgeName())
                        .badgeIcon(lmb.getBadgeIcon())
                        .badgeCategory("LANGUAGE_MASTER")
                        .awardedAt(lmb.getAwardedDate())
                        .testName(lmb.getTestName())
                        .build();
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("myCurrentRank", myOverallRank > 0 ? myOverallRank : 1);
        summary.put("overallRank", myOverallRank > 0 ? myOverallRank : 1);
        summary.put("totalBadgesEarned", totalBadgesEarned);
        summary.put("recentAchievement", recent);

        return ResponseEntity.ok(summary);
    }

    @GetMapping("/admin/leaderboard/export")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> exportLeaderboardExcel(
            @RequestParam(required = false, defaultValue = "ALL") String timeFilter,
            @RequestParam(required = false, defaultValue = "ALL") String departmentFilter) {
        List<OverallLeaderboardEntry> entries = overallLeaderboardService.getOverallLeaderboard(timeFilter, departmentFilter);
        byte[] excelBytes = overallLeaderboardService.generateExcelExport(entries);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("chillcode_leaderboard.xlsx").build());
        headers.setContentLength(excelBytes.length);

        return ResponseEntity.ok().headers(headers).body(excelBytes);
    }
}
