package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.SubjectRankingDto;
import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.StudentTest;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.repository.StudentAchievementRepository;
import com.chillcode.assessment.repository.StudentTestRepository;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class OverallLeaderboardService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private StudentAchievementRepository studentAchievementRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentBadgeRepository studentBadgeRepository;

    @Autowired
    private com.chillcode.assessment.repository.LanguageMasterBadgeRepository languageMasterBadgeRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Transactional(readOnly = true)
    public List<OverallLeaderboardEntry> getOverallLeaderboard(String timeFilter, String departmentFilter) {
        try {
            Long adminId = com.chillcode.assessment.security.SecurityUtils.getCurrentAdminId();
            List<User> students = adminId != null ?
                    userRepository.findByRoleAndAdminId(Role.STUDENT, adminId) :
                    userRepository.findAll().stream()
                            .filter(u -> u.getRole() == Role.STUDENT)
                            .collect(Collectors.toList());

            if (departmentFilter != null && !departmentFilter.trim().isEmpty() && !"ALL".equalsIgnoreCase(departmentFilter)) {
                students = students.stream()
                        .filter(s -> s.getDepartment() != null && s.getDepartment().equalsIgnoreCase(departmentFilter))
                        .collect(Collectors.toList());
            }

            // Use eager JOIN FETCH query to avoid N+1 lazy loading of student field
            List<StudentTest> allStudentTests = adminId != null ? 
                    studentTestRepository.findAllWithStudentsByAdminId(adminId) :
                    studentTestRepository.findAllWithStudents();

            List<Long> validTestIds = testRepository.findTestIdsWithQuestions();

            List<OverallLeaderboardEntry> entries = new ArrayList<>();

            for (User student : students) {
                List<StudentTest> myTests = allStudentTests.stream()
                        .filter(st -> st.getStudent() != null && st.getStudent().getId().equals(student.getId()) && st.getTest() != null && validTestIds.contains(st.getTest().getId()))
                        .collect(Collectors.toList());

                int totalMarks = myTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
                
                long testsAttempted = myTests.stream()
                        .filter(st -> !"ASSIGNED".equalsIgnoreCase(st.getStatus()) || st.getStartedAt() != null)
                        .count();
                
                long totalTestsPassed = myTests.stream()
                        .filter(st -> "PASS".equalsIgnoreCase(st.getPassFailStatus()) || "COMPLETED".equalsIgnoreCase(st.getStatus()))
                        .count();
                        
                long totalTestsFailed = Math.max(0, testsAttempted - totalTestsPassed);
                long notAttended = Math.max(0, myTests.size() - testsAttempted);
                double passPercentage = testsAttempted > 0 ? ((double) totalTestsPassed / testsAttempted) * 100 : 0.0;
                
                String resultStatus;
                if (testsAttempted == 0) {
                    resultStatus = "Not Attended";
                } else if (passPercentage >= 50.0) {
                    resultStatus = "Pass";
                } else {
                    resultStatus = "Fail";
                }
                
                boolean hasMalpractice = myTests.stream().anyMatch(st -> (st.getIsSuspended() != null && st.getIsSuspended()) || (st.getWarningsCount() != null && st.getWarningsCount() > 0));
                String malpracticeStr = hasMalpractice ? "YES" : "NO";
                
                java.time.LocalDateTime latestAttempt = myTests.stream()
                        .map(st -> st.getSubmittedAt() != null ? st.getSubmittedAt() : st.getStartedAt())
                        .filter(Objects::nonNull)
                        .max(java.time.LocalDateTime::compareTo)
                        .orElse(null);
                String latestAttemptDate = latestAttempt != null ? latestAttempt.toString() : "N/A";

                int totalBadges = 0;
                try {
                    int achievementsCount = (int) studentAchievementRepository.findByStudentIdOrderByAwardedAtDesc(student.getId()).stream()
                            .filter(sa -> sa.getTest() == null || validTestIds.contains(sa.getTest().getId()))
                            .count();
                    int manualBadgesCount = (int) studentBadgeRepository.findByStudentId(student.getId()).stream()
                            .filter(sb -> sb.getSourceTest() == null || validTestIds.contains(sb.getSourceTest().getId()))
                            .count();
                    int languageBadgesCount = (int) languageMasterBadgeRepository.findByStudentIdOrderByAwardedDateDesc(student.getId()).stream()
                            .filter(lmb -> lmb.getTest() == null || validTestIds.contains(lmb.getTest().getId()))
                            .count();
                    totalBadges = achievementsCount + manualBadgesCount;
                } catch (Exception ignored) {}

                double avgScore = myTests.isEmpty() ? 0.0 :
                        myTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);

                double avgTimeSec = myTests.isEmpty() ? 0.0 :
                        myTests.stream().mapToLong(st -> st.getTimeTakenSeconds() != null ? st.getTimeTakenSeconds() : 0L).average().orElse(0.0);

                // Collect test names for this student
                String testNames = myTests.stream()
                        .filter(st -> st.getTest() != null && st.getTest().getName() != null)
                        .map(st -> st.getTest().getName())
                        .distinct()
                        .collect(Collectors.joining(", "));
                if (testNames.isEmpty()) testNames = "N/A";

                entries.add(new OverallLeaderboardEntry(
                        student.getId(),
                        student.getName(),
                        student.getRegisterNumber(),
                        student.getDepartment(),
                        totalMarks,
                        (int) totalTestsPassed,
                        (int) totalTestsFailed,
                        (int) testsAttempted,
                        (int) notAttended,
                        totalBadges,
                        avgScore,
                        avgTimeSec,
                        passPercentage,
                        (int) testsAttempted, // Using testsAttempted for totalAttempts in this context
                        latestAttemptDate,
                        malpracticeStr,
                        resultStatus,
                        latestAttempt,
                        testNames
                ));
            }

            // Sort priority: 1. Highest Total Score, 2. Highest Tests Passed, 3. Lowest Avg Completion Time (internal), 4. Earliest Completion Time (internal)
            entries.sort((a, b) -> {
                int scoreComp = Integer.compare(b.totalMarks, a.totalMarks);
                if (scoreComp != 0) return scoreComp;

                int passComp = Integer.compare(b.totalTestsPassed, a.totalTestsPassed);
                if (passComp != 0) return passComp;

                int avgTimeComp = Double.compare(a.avgTimeSec, b.avgTimeSec);
                if (avgTimeComp != 0) return avgTimeComp;

                if (a.latestAttemptRaw != null && b.latestAttemptRaw != null) {
                    return a.latestAttemptRaw.compareTo(b.latestAttemptRaw);
                } else if (a.latestAttemptRaw != null) {
                    return -1;
                } else if (b.latestAttemptRaw != null) {
                    return 1;
                }

                return 0;
            });

            int rank = 1;
            for (OverallLeaderboardEntry entry : entries) {
                entry.rankPosition = rank++;
            }

            return entries;
        } catch (Exception e) {
            System.err.println("[OverallLeaderboardService] Error computing leaderboard: " + e.getMessage());
            return new ArrayList<>();
        }
    }


    public byte[] generateExcelExport(List<OverallLeaderboardEntry> entries) {
        try (org.apache.poi.xssf.usermodel.XSSFWorkbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            org.apache.poi.xssf.usermodel.XSSFSheet sheet = workbook.createSheet("Overall Leaderboard");

            // Header styles
            org.apache.poi.xssf.usermodel.XSSFCellStyle headerStyle = workbook.createCellStyle();
            org.apache.poi.xssf.usermodel.XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setColor(org.apache.poi.xssf.usermodel.XSSFFont.DEFAULT_FONT_COLOR);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new org.apache.poi.xssf.usermodel.XSSFColor(new byte[]{(byte)45, (byte)55, (byte)72}, null));
            headerStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            headerStyle.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);

            // Column headers
            String[] headers = {
                "Rank", "Register Number", "Student Name", "Department", "Total Marks",
                "Pass %", "Tests Passed", "Tests Failed", "Tests Attempted", "Not Attended",
                "Total Attempts", "Total Badges", "Latest Attempt Date", "Malpractice"
            };

            org.apache.poi.xssf.usermodel.XSSFRow headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                org.apache.poi.xssf.usermodel.XSSFCell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Freeze header row
            sheet.createFreezePane(0, 1);

            int rowIdx = 1;
            for (OverallLeaderboardEntry e : entries) {
                org.apache.poi.xssf.usermodel.XSSFRow row = sheet.createRow(rowIdx++);
                row.createCell(0).setCellValue(e.rankPosition);
                row.createCell(1).setCellValue(e.registerNumber != null ? e.registerNumber : "");
                row.createCell(2).setCellValue(e.studentName != null ? e.studentName : "");
                row.createCell(3).setCellValue(e.department != null ? e.department : "");
                row.createCell(4).setCellValue(e.totalMarks);
                row.createCell(5).setCellValue(String.format("%.2f%%", e.passPercentage));
                row.createCell(6).setCellValue(e.totalTestsPassed);
                row.createCell(7).setCellValue(e.totalTestsFailed);
                row.createCell(8).setCellValue(e.testsAttempted);
                row.createCell(9).setCellValue(e.notAttended);
                row.createCell(10).setCellValue(e.totalAttempts);
                row.createCell(11).setCellValue(e.totalBadges);
                row.createCell(12).setCellValue(e.latestAttemptDate != null ? e.latestAttemptDate : "");
                row.createCell(13).setCellValue(e.malpractice != null ? e.malpractice : "NO");
            }

            // Auto-size columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
            }

            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
            workbook.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            System.err.println("[OverallLeaderboardService] Error exporting Excel: " + e.getMessage());
            return new byte[0];
        }
    }

    public String generateCsvExport(List<OverallLeaderboardEntry> entries) {
        StringBuilder sb = new StringBuilder();
        sb.append("Rank,Register Number,Student Name,Department,Total Marks,Pass %,Tests Passed,Tests Failed,Tests Attempted,Not Attended,Total Attempts,Avg Time (s),Total Badges,Latest Attempt Date,Malpractice\n");
        for (OverallLeaderboardEntry e : entries) {
            sb.append(e.rankPosition).append(",")
              .append("\"").append(e.registerNumber != null ? e.registerNumber : "").append("\",")
              .append("\"").append(e.studentName != null ? e.studentName : "").append("\",")
              .append("\"").append(e.department != null ? e.department : "").append("\",")
              .append(e.totalMarks).append(",")
              .append(String.format("%.2f", e.passPercentage)).append("%,")
              .append(e.totalTestsPassed).append(",")
              .append(e.totalTestsFailed).append(",")
              .append(e.testsAttempted).append(",")
              .append(e.notAttended).append(",")
              .append(e.totalAttempts).append(",")
              .append(String.format("%.2f", e.avgTimeSec)).append(",")
              .append(e.totalBadges).append(",")
              .append("\"").append(e.latestAttemptDate != null ? e.latestAttemptDate : "").append("\",")
              .append("\"").append(e.malpractice != null ? e.malpractice : "NO").append("\"\n");
        }
        return sb.toString();
    }

    public static class OverallLeaderboardEntry {
        public int rankPosition;
        public Long studentId;
        public String studentName;
        public String registerNumber;
        public String department;
        public int totalMarks;
        public int totalTestsPassed;
        public int totalTestsFailed;
        public int testsAttempted;
        public int notAttended;
        public int totalBadges;
        public double avgScore;
        public double avgTimeSec;
        public double passPercentage;
        public int totalAttempts;
        public String latestAttemptDate;
        public String malpractice;
        public String resultStatus;
        public String testNames;
        public transient java.time.LocalDateTime latestAttemptRaw;

        public OverallLeaderboardEntry(Long studentId, String studentName, String registerNumber, String department, int totalMarks, int totalTestsPassed, int totalTestsFailed, int testsAttempted, int notAttended, int totalBadges, double avgScore, double avgTimeSec, double passPercentage, int totalAttempts, String latestAttemptDate, String malpractice, String resultStatus, java.time.LocalDateTime latestAttemptRaw, String testNames) {
            this.studentId = studentId;
            this.studentName = studentName;
            this.registerNumber = registerNumber;
            this.department = department;
            this.totalMarks = totalMarks;
            this.totalTestsPassed = totalTestsPassed;
            this.totalTestsFailed = totalTestsFailed;
            this.testsAttempted = testsAttempted;
            this.notAttended = notAttended;
            this.totalBadges = totalBadges;
            this.avgScore = avgScore;
            this.avgTimeSec = avgTimeSec;
            this.passPercentage = passPercentage;
            this.totalAttempts = totalAttempts;
            this.latestAttemptDate = latestAttemptDate;
            this.malpractice = malpractice;
            this.resultStatus = resultStatus;
            this.latestAttemptRaw = latestAttemptRaw;
            this.testNames = testNames;
        }
    }
}
