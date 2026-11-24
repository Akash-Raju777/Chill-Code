package com.chillcode.assessment.controller;

import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/super-admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private WorkAssignmentRepository workAssignmentRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private TestRepository testRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    @Autowired
    private StudentBadgeRepository studentBadgeRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private StudentAchievementRepository studentAchievementRepository;

    @Autowired
    private LanguageMasterBadgeRepository languageMasterBadgeRepository;

    @Autowired
    private com.chillcode.assessment.repository.NotificationRepository notificationRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    private boolean isAttendedStatus(String status) {
        if (status == null) return false;
        String s = status.trim().toUpperCase();
        return "COMPLETED".equals(s) || "SUBMITTED".equals(s) || "EVALUATED".equals(s);
    }

    @GetMapping("/dashboard/stats")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        long totalStudents = userRepository.countByRole(Role.STUDENT);
        long totalStaff = userRepository.countByRole(Role.ADMIN);
        long activeStaff = userRepository.findByRole(Role.ADMIN).stream()
                .filter(u -> u.getStatus() != null && u.getStatus() == UserStatus.ACTIVE).count();
        long totalQuestions = questionRepository.count();
        long totalTests = testRepository.count();
        long totalSubmissions = submissionRepository.count();
        long totalTestsConducted = studentTestRepository.countByStatus("SUBMITTED");

        List<StudentTest> completedTests = studentTestRepository.findAllCompletedWithStudents();
        double avgScore = completedTests.isEmpty() ? 0.0 :
                completedTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);
        long passedCount = completedTests.stream()
                .filter(st -> (st.getScore() != null ? st.getScore() : 0) >= 40).count();
        double passPercentage = completedTests.isEmpty() ? 0.0 : ((double) passedCount / completedTests.size()) * 100.0;

        // Calculate fully completed tests (where assigned > 0 and all assigned students completed)
        List<Test> allActiveTests = testRepository.findAll();
        List<StudentTest> allStudentTests = studentTestRepository.findAllWithStudents();
        Map<Long, List<StudentTest>> studentTestsByTest = allStudentTests.stream()
                .filter(st -> st.getTest() != null && st.getTest().getId() != null)
                .collect(Collectors.groupingBy(st -> st.getTest().getId()));

        long fullyCompletedTestsCount = 0;
        for (Test t : allActiveTests) {
            List<StudentTest> stList = studentTestsByTest.getOrDefault(t.getId(), Collections.emptyList());
            if (!stList.isEmpty()) {
                long completed = stList.stream()
                        .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()))
                        .count();
                if (completed >= stList.size()) {
                    fullyCompletedTestsCount++;
                }
            }
        }

        // Deleted tests: counted from actual deletion records in audit logs
        long deletedTestsCount = activityLogRepository.findAll().stream()
                .filter(log -> log.getAction() != null && log.getAction().toUpperCase().contains("DELETE_TEST"))
                .count();

        stats.put("totalStudents", totalStudents);
        stats.put("totalStaff", totalStaff);
        stats.put("activeStaff", activeStaff);
        stats.put("totalQuestions", totalQuestions);
        stats.put("totalTests", totalTests);
        stats.put("deletedTests", deletedTestsCount);
        stats.put("totalSubmissions", totalSubmissions);
        stats.put("totalTestsConducted", totalTestsConducted);
        stats.put("fullyCompletedTests", fullyCompletedTestsCount);
        stats.put("overallStudentPerformance", Math.round(avgScore * 10.0) / 10.0);
        stats.put("departmentPassPercentage", Math.round(passPercentage * 10.0) / 10.0);
        return ResponseEntity.ok(stats);
    }

    @GetMapping("/dashboard/deleted-tests")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getDeletedTestsRegistry() {
        List<Map<String, Object>> list = new ArrayList<>();
        List<ActivityLog> deleteLogs = activityLogRepository.findAll().stream()
                .filter(log -> log.getAction() != null && log.getAction().toUpperCase().contains("DELETE_TEST"))
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .collect(Collectors.toList());

        for (ActivityLog log : deleteLogs) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", log.getId());
            item.put("testName", log.getDetails() != null ? log.getDetails() : "Deleted Test");
            item.put("subject", "N/A");
            item.put("createdBy", "Admin");
            item.put("originalCreatedAt", null);
            item.put("deletedAt", log.getTimestamp());
            item.put("deletedBy", log.getUser() != null ? log.getUser().getName() : "Admin");
            list.add(item);
        }
        return ResponseEntity.ok(list);
    }

    @GetMapping("/dashboard/completed-tests")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getFullyCompletedTestsRegistry() {
        List<Map<String, Object>> list = new ArrayList<>();
        List<Test> allActiveTests = testRepository.findAll();
        List<StudentTest> allStudentTests = studentTestRepository.findAllWithStudents();
        Map<Long, List<StudentTest>> studentTestsByTest = allStudentTests.stream()
                .filter(st -> st.getTest() != null && st.getTest().getId() != null)
                .collect(Collectors.groupingBy(st -> st.getTest().getId()));

        for (Test t : allActiveTests) {
            List<StudentTest> stList = studentTestsByTest.getOrDefault(t.getId(), Collections.emptyList());
            if (!stList.isEmpty()) {
                long completed = stList.stream()
                        .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus()))
                        .count();
                if (completed >= stList.size()) {
                    LocalDateTime latestCompletion = stList.stream()
                            .map(StudentTest::getSubmittedAt)
                            .filter(Objects::nonNull)
                            .max(LocalDateTime::compareTo)
                            .orElse(t.getEndTime());

                    Map<String, Object> item = new HashMap<>();
                    item.put("testId", t.getId());
                    item.put("testName", t.getName());
                    item.put("testCode", t.getTestCode());
                    item.put("subject", t.getSubject() != null ? t.getSubject().getName() : "General");
                    item.put("createdBy", t.getAdmin() != null ? t.getAdmin().getName() :
                            (t.getAssignedStaff() != null ? t.getAssignedStaff().getName() : "Admin"));
                    item.put("createdAt", t.getCreatedAt());
                    item.put("totalAssignedStudents", stList.size());
                    item.put("totalCompletedStudents", completed);
                    item.put("completionDateTime", latestCompletion);
                    list.add(item);
                }
            }
        }
        return ResponseEntity.ok(list);
    }

    @GetMapping("/dashboard/charts")
    public ResponseEntity<Map<String, Object>> getDashboardCharts() {
        Map<String, Object> charts = new HashMap<>();

        // 1. Student Participation
        long totalStudents = userRepository.countByRole(Role.STUDENT);
        List<StudentTest> allStudentTests = studentTestRepository.findAll();
        Set<Long> attendedStudentIds = allStudentTests.stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()))
                .filter(st -> st.getStudent() != null)
                .map(st -> st.getStudent().getId())
                .collect(Collectors.toSet());
        long attendedCount = attendedStudentIds.size();
        long notAttendedCount = Math.max(0, totalStudents - attendedCount);

        Map<String, Object> participation = new HashMap<>();
        participation.put("totalStudents", totalStudents);
        participation.put("attended", attendedCount);
        participation.put("notAttended", notAttendedCount);
        participation.put("participationRate", totalStudents > 0 ? Math.round(((double) attendedCount / totalStudents) * 100.0) : 0);
        charts.put("studentParticipation", participation);

        // 2. Pass/Fail statistics
        List<StudentTest> completedTests = studentTestRepository.findAllCompletedWithStudents();
        long passed = completedTests.stream().filter(st -> (st.getScore() != null ? st.getScore() : 0) >= 40).count();
        long failed = Math.max(0, completedTests.size() - passed);
        Map<String, Object> passFail = new HashMap<>();
        passFail.put("passed", passed);
        passFail.put("failed", failed);
        passFail.put("totalEvaluated", completedTests.size());
        charts.put("passFailStats", passFail);

        // 3. Monthly Assessment Activity (Past 6 months)
        List<Map<String, Object>> monthlyActivity = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();
        DateTimeFormatter monthFormatter = DateTimeFormatter.ofPattern("MMM");
        List<Test> allTests = testRepository.findAll();

        for (int i = 5; i >= 0; i--) {
            LocalDateTime monthTarget = now.minusMonths(i);
            String monthName = monthTarget.format(monthFormatter);
            int year = monthTarget.getYear();
            int monthValue = monthTarget.getMonthValue();

            long createdInMonth = allTests.stream()
                    .filter(t -> t.getStartTime() != null &&
                            t.getStartTime().getYear() == year &&
                            t.getStartTime().getMonthValue() == monthValue)
                    .count();

            long conductedInMonth = allStudentTests.stream()
                    .filter(st -> st.getSubmittedAt() != null &&
                            st.getSubmittedAt().getYear() == year &&
                            st.getSubmittedAt().getMonthValue() == monthValue)
                    .count();

            Map<String, Object> monthData = new HashMap<>();
            monthData.put("month", monthName);
            monthData.put("testsCreated", createdInMonth);
            monthData.put("testsConducted", conductedInMonth);
            monthlyActivity.add(monthData);
        }
        charts.put("monthlyAssessments", monthlyActivity);

        // 4. Department Performance
        List<User> students = userRepository.findByRole(Role.STUDENT);
        Map<String, List<User>> studentsByDept = students.stream()
                .collect(Collectors.groupingBy(u -> u.getDepartment() != null && !u.getDepartment().isBlank() ? u.getDepartment() : "General"));

        List<Map<String, Object>> deptPerfList = new ArrayList<>();
        for (Map.Entry<String, List<User>> entry : studentsByDept.entrySet()) {
            String dept = entry.getKey();
            List<User> deptStudents = entry.getValue();
            Set<Long> deptStudentIds = deptStudents.stream().map(User::getId).collect(Collectors.toSet());

            List<StudentTest> deptTests = completedTests.stream()
                    .filter(st -> st.getStudent() != null && deptStudentIds.contains(st.getStudent().getId()))
                    .collect(Collectors.toList());

            double avg = deptTests.isEmpty() ? 0.0 :
                    deptTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);
            long deptPassed = deptTests.stream().filter(st -> (st.getScore() != null ? st.getScore() : 0) >= 40).count();
            double deptPassRate = deptTests.isEmpty() ? 0.0 : ((double) deptPassed / deptTests.size()) * 100.0;

            Map<String, Object> deptData = new HashMap<>();
            deptData.put("department", dept);
            deptData.put("studentCount", deptStudents.size());
            deptData.put("averageScore", Math.round(avg * 10.0) / 10.0);
            deptData.put("passRate", Math.round(deptPassRate * 10.0) / 10.0);
            deptPerfList.add(deptData);
        }
        charts.put("departmentPerformance", deptPerfList);

        // 5. Staff Activity Contribution
        List<User> staffMembers = userRepository.findByRole(Role.ADMIN);
        List<Question> questions = questionRepository.findAll();
        List<WorkAssignment> assignments = workAssignmentRepository.findAll();

        List<Map<String, Object>> staffActivityList = new ArrayList<>();
        for (User staff : staffMembers) {
            long qCount = questions.stream()
                    .filter(q -> q.getAdmin() != null && q.getAdmin().getId().equals(staff.getId())).count();
            long tCount = allTests.stream()
                    .filter(t -> t.getAdmin() != null && t.getAdmin().getId().equals(staff.getId())).count();
            long aCount = assignments.stream()
                    .filter(a -> a.getAssignedTo() != null && a.getAssignedTo().getId().equals(staff.getId()) && "COMPLETED".equalsIgnoreCase(a.getStatus())).count();

            Map<String, Object> staffData = new HashMap<>();
            staffData.put("name", staff.getName());
            staffData.put("questionsCount", qCount);
            staffData.put("testsCount", tCount);
            staffData.put("completedTasks", aCount);
            staffActivityList.add(staffData);
        }
        charts.put("staffActivity", staffActivityList);

        return ResponseEntity.ok(charts);
    }

    @GetMapping("/overview/subjects")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getSubjectAssessmentOverview() {
        List<Map<String, Object>> result = new ArrayList<>();
        List<Subject> subjects = subjectRepository.findAll();
        List<Test> allTests = testRepository.findAll();
        long totalStudentsCount = userRepository.countByRole(Role.STUDENT);

        // High-Performance: single-pass aggregate counts to avoid pulling thousands of questions and test results over WAN
        Map<Long, Long> questionCounts = new HashMap<>();
        for (Object[] row : questionRepository.countQuestionsGroupedBySubject()) {
            if (row != null && row[0] != null && row[1] != null) {
                questionCounts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }

        Map<Long, Long> attendedCounts = new HashMap<>();
        for (Object[] row : studentTestRepository.countAttendedStudentsGroupedBySubject()) {
            if (row != null && row[0] != null && row[1] != null) {
                attendedCounts.put(((Number) row[0]).longValue(), ((Number) row[1]).longValue());
            }
        }

        Map<Long, List<Test>> testsBySubject = allTests.stream()
                .filter(t -> t.getSubject() != null && t.getSubject().getId() != null)
                .collect(Collectors.groupingBy(t -> t.getSubject().getId()));

        for (Subject sub : subjects) {
            List<Test> subTests = testsBySubject.getOrDefault(sub.getId(), Collections.emptyList());
            long totalQuestions = questionCounts.getOrDefault(sub.getId(), 0L);
            long attendedCount = attendedCounts.getOrDefault(sub.getId(), 0L);
            long notAttendedCount = Math.max(0, totalStudentsCount - attendedCount);

            Map<String, Object> item = new HashMap<>();
            item.put("id", sub.getId());
            item.put("name", sub.getName());
            item.put("description", sub.getDescription());
            item.put("color", sub.getColor() != null ? sub.getColor() : "#3B82F6");
            item.put("icon", sub.getIcon() != null ? sub.getIcon() : "BookOpen");
            item.put("status", sub.getStatus() != null ? sub.getStatus() : "ACTIVE");
            item.put("totalQuestions", totalQuestions);
            item.put("totalTests", subTests.size());
            item.put("totalStudents", totalStudentsCount);
            item.put("studentsAttended", attendedCount);
            item.put("studentsNotAttended", notAttendedCount);
            item.put("assignedStaffName", sub.getEffectiveStaff() != null ? sub.getEffectiveStaff().getName() : null);
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/overview/assessments")
    public ResponseEntity<List<Map<String, Object>>> getAssessmentOverview() {
        List<Map<String, Object>> overview = new ArrayList<>();
        List<Test> allTests = testRepository.findAll();
        List<StudentTest> studentTests = studentTestRepository.findAll();

        // High-Performance: retrieve only distinct deleted test names via indexed query
        Set<String> rawDeleted = activityLogRepository.findDeletedTestNames();
        final Set<String> deletedTestNames = rawDeleted != null ? rawDeleted : Collections.emptySet();

        // Group tests by unique test identity (normalized name + subject name) so duplicate DB rows from repeated seeds don't flood the overview
        Map<String, List<Test>> testsByGroup = allTests.stream()
                .filter(t -> t.getName() != null && !deletedTestNames.contains(t.getName()))
                .collect(Collectors.groupingBy(t -> {
                    String sub = t.getSubject() != null ? t.getSubject().getName() : "General";
                    return t.getName().trim().toLowerCase() + ":::" + sub.toLowerCase();
                }, LinkedHashMap::new, Collectors.toList()));

        for (Map.Entry<String, List<Test>> entry : testsByGroup.entrySet()) {
            List<Test> group = entry.getValue();
            Test primary = group.get(0);
            Set<Long> testIds = group.stream().map(Test::getId).collect(Collectors.toSet());

            // Collect all studentTests for these testIds
            List<StudentTest> matchedStudentTests = studentTests.stream()
                    .filter(st -> st.getTest() != null && testIds.contains(st.getTest().getId()))
                    .collect(Collectors.toList());

            // De-duplicate by student: pick the best status for each student
            Map<Long, StudentTest> studentBestTest = new HashMap<>();
            for (StudentTest st : matchedStudentTests) {
                if (st.getStudent() == null) continue;
                Long studentId = st.getStudent().getId();
                StudentTest existing = studentBestTest.get(studentId);
                if (existing == null) {
                    studentBestTest.put(studentId, st);
                } else {
                    boolean existingAttended = isAttendedStatus(existing.getStatus());
                    boolean newAttended = isAttendedStatus(st.getStatus());
                    if (!existingAttended && newAttended) {
                        studentBestTest.put(studentId, st);
                    } else if (newAttended && (st.getScore() != null ? st.getScore() : 0) > (existing.getScore() != null ? existing.getScore() : 0)) {
                        studentBestTest.put(studentId, st);
                    }
                }
            }

            long totalStudents = studentBestTest.size();
            long attended = studentBestTest.values().stream()
                    .filter(st -> isAttendedStatus(st.getStatus()))
                    .count();
            List<StudentTest> evaluatedTests = studentBestTest.values().stream()
                    .filter(st -> isAttendedStatus(st.getStatus()))
                    .collect(Collectors.toList());

            double avgScore = evaluatedTests.isEmpty() ? 0.0 :
                    evaluatedTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);
            long passed = evaluatedTests.stream().filter(st -> (st.getScore() != null ? st.getScore() : 0) >= 40).count();
            double passRate = evaluatedTests.isEmpty() ? 0.0 : ((double) passed / evaluatedTests.size()) * 100.0;

            String status = "IN_PROGRESS";
            if (totalStudents > 0 && attended >= totalStudents) {
                status = "COMPLETED";
            } else if (primary.getStartTime() != null && LocalDateTime.now().isBefore(primary.getStartTime())) {
                status = "UPCOMING";
            }

            Map<String, Object> item = new HashMap<>();
            item.put("testId", primary.getId());
            item.put("testName", primary.getName());
            item.put("testCode", primary.getTestCode());
            item.put("subjectName", primary.getSubject() != null ? primary.getSubject().getName() : "General");
            item.put("createdBy", primary.getAdmin() != null ? primary.getAdmin().getName() : 
                    (primary.getAssignedStaff() != null ? primary.getAssignedStaff().getName() : "Admin"));
            item.put("durationMinutes", primary.getDurationMinutes());
            item.put("startTime", primary.getStartTime());
            item.put("endTime", primary.getEndTime());
            item.put("totalStudents", totalStudents);
            item.put("studentsAttended", attended);
            item.put("studentsNotAttended", Math.max(0, totalStudents - attended));
            item.put("averageScore", Math.round(avgScore * 10.0) / 10.0);
            item.put("passRate", Math.round(passRate * 10.0) / 10.0);
            item.put("completionStatus", status);
            overview.add(item);
        }
        return ResponseEntity.ok(overview);
    }

    @GetMapping("/students")
    public ResponseEntity<List<Map<String, Object>>> getAllStudents() {
        List<User> students = userRepository.findByRole(Role.STUDENT);
        List<StudentTest> studentTests = studentTestRepository.findAll();
        List<StudentBadge> badges = studentBadgeRepository.findAll();

        Set<String> deletedTestNames = activityLogRepository.findAll().stream()
                .filter(log -> log.getAction() != null && log.getAction().toUpperCase().contains("DELETE_TEST"))
                .map(ActivityLog::getDetails)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        List<Map<String, Object>> result = new ArrayList<>();
        for (User s : students) {
            List<StudentTest> userTests = studentTests.stream()
                    .filter(st -> st.getStudent() != null && st.getStudent().getId().equals(s.getId()))
                    .collect(Collectors.toList());

            // De-duplicate userTests by test identity
            Map<String, StudentTest> distinctTests = new HashMap<>();
            for (StudentTest st : userTests) {
                if (st.getTest() == null || st.getTest().getName() == null) continue;
                if (deletedTestNames.contains(st.getTest().getName())) continue;
                String key = st.getTest().getName().trim().toLowerCase() + ":::" + 
                             (st.getTest().getSubject() != null ? st.getTest().getSubject().getName().toLowerCase() : "general");
                StudentTest cur = distinctTests.get(key);
                if (cur == null || (!isAttendedStatus(cur.getStatus()) && isAttendedStatus(st.getStatus()))) {
                    distinctTests.put(key, st);
                }
            }

            long attended = distinctTests.values().stream()
                    .filter(st -> isAttendedStatus(st.getStatus()))
                    .count();
            long notAttended = Math.max(0, distinctTests.size() - attended);

            int totalMarks = distinctTests.values().stream()
                    .mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
            double avgMarks = attended > 0 ? (double) totalMarks / attended : 0.0;

            long badgeCount = badges.stream()
                    .filter(b -> b.getStudent() != null && b.getStudent().getId().equals(s.getId())).count();

            Map<String, Object> item = new HashMap<>();
            item.put("id", s.getId());
            item.put("name", s.getName());
            item.put("registerNumber", s.getRegisterNumber() != null ? s.getRegisterNumber() : s.getUsername());
            item.put("username", s.getUsername());
            item.put("email", s.getEmail());
            item.put("department", s.getDepartment() != null ? s.getDepartment() : "General");
            item.put("phone", s.getPhone());
            item.put("status", s.getStatus() != null ? s.getStatus().name() : "ACTIVE");
            item.put("testsAttended", attended);
            item.put("testsNotAttended", notAttended);
            item.put("totalMarks", totalMarks);
            item.put("averagePerformance", Math.round(avgMarks * 10.0) / 10.0);
            item.put("badgeCount", badgeCount);
            item.put("dateJoined", s.getCreatedAt());
            result.add(item);
        }
        return ResponseEntity.ok(result);
    }

    @GetMapping("/students/{id}")
    public ResponseEntity<Map<String, Object>> getStudentProfile(@PathVariable Long id) {
        User student = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Student not found"));

        List<StudentTest> tests = studentTestRepository.findByStudentIdWithTestAndSubject(id);
        List<Submission> submissions = submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(id);
        List<StudentBadge> badges = studentBadgeRepository.findByStudentIdWithBadge(id);

        Set<String> deletedTestNames = activityLogRepository.findAll().stream()
                .filter(log -> log.getAction() != null && log.getAction().toUpperCase().contains("DELETE_TEST"))
                .map(ActivityLog::getDetails)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        // De-duplicate test history by unique test name and subject, picking the latest/best record
        Map<String, StudentTest> uniqueStudentTests = new LinkedHashMap<>();
        for (StudentTest st : tests) {
            if (st.getTest() == null || st.getTest().getName() == null) continue;
            if (deletedTestNames.contains(st.getTest().getName())) continue;

            String key = st.getTest().getName().trim().toLowerCase() + ":::" +
                    (st.getTest().getSubject() != null ? st.getTest().getSubject().getName().toLowerCase() : "general");

            StudentTest existing = uniqueStudentTests.get(key);
            if (existing == null) {
                uniqueStudentTests.put(key, st);
            } else {
                boolean existingAttended = isAttendedStatus(existing.getStatus());
                boolean curAttended = isAttendedStatus(st.getStatus());
                if (!existingAttended && curAttended) {
                    uniqueStudentTests.put(key, st);
                } else if (existingAttended == curAttended) {
                    int exScore = existing.getScore() != null ? existing.getScore() : 0;
                    int curScore = st.getScore() != null ? st.getScore() : 0;
                    if (curScore > exScore) {
                        uniqueStudentTests.put(key, st);
                    } else if (curScore == exScore && st.getSubmittedAt() != null && 
                            (existing.getSubmittedAt() == null || st.getSubmittedAt().isAfter(existing.getSubmittedAt()))) {
                        uniqueStudentTests.put(key, st);
                    }
                }
            }
        }

        long attended = uniqueStudentTests.values().stream()
                .filter(st -> isAttendedStatus(st.getStatus()))
                .count();
        int totalMarks = uniqueStudentTests.values().stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
        double avgMarks = attended > 0 ? (double) totalMarks / attended : 0.0;

        List<Map<String, Object>> testHistory = new ArrayList<>();
        for (StudentTest st : uniqueStudentTests.values()) {
            Map<String, Object> th = new HashMap<>();
            th.put("testId", st.getTest() != null ? st.getTest().getId() : null);
            th.put("testName", st.getTest() != null ? st.getTest().getName() : "Unknown");
            th.put("subject", st.getTest() != null && st.getTest().getSubject() != null ? st.getTest().getSubject().getName() : "General");
            th.put("score", st.getScore() != null ? st.getScore() : 0);
            Integer testMaxMarks = 100;
            if (st.getTest() != null && st.getTest().getMaxMarks() != null) {
                testMaxMarks = st.getTest().getMaxMarks();
            }
            th.put("maxMarks", testMaxMarks);
            th.put("status", st.getStatus());
            th.put("warningsCount", st.getWarningsCount() != null ? st.getWarningsCount() : 0);
            th.put("startedAt", st.getStartedAt());
            th.put("submittedAt", st.getSubmittedAt());
            testHistory.add(th);
        }

        List<com.chillcode.assessment.entity.StudentQuestionStatus> sqsList = studentQuestionStatusRepository.findByStudentId(id);
        Map<Long, Integer> sqsAttemptsMap = sqsList.stream()
                .filter(s -> s.getQuestionId() != null && s.getAttemptCount() != null)
                .collect(Collectors.toMap(com.chillcode.assessment.entity.StudentQuestionStatus::getQuestionId, com.chillcode.assessment.entity.StudentQuestionStatus::getAttemptCount, (a, b) -> a));

        List<Map<String, Object>> submissionHistory = new ArrayList<>();
        for (Submission sub : submissions) {
            Map<String, Object> sh = new HashMap<>();
            sh.put("id", sub.getId());
            sh.put("questionTitle", sub.getQuestion() != null ? sub.getQuestion().getTitle() : "Unknown");
            sh.put("language", sub.getLanguage());
            sh.put("status", sub.getStatus());
            sh.put("overallResult", sub.getOverallResult());
            sh.put("score", sub.getScore());
            sh.put("executionTime", sub.getRunTimeMs());
            sh.put("createdAt", sub.getCreatedAt());
            if (sub.getQuestion() != null) {
                sh.put("attempts", sqsAttemptsMap.getOrDefault(sub.getQuestion().getId(), 1));
            }
            submissionHistory.add(sh);
        }

        List<Map<String, Object>> badgeList = new ArrayList<>();
        for (StudentBadge sb : badges) {
            Map<String, Object> b = new HashMap<>();
            b.put("id", sb.getId());
            b.put("name", sb.getBadge() != null ? sb.getBadge().getName() : "Badge");
            b.put("description", sb.getBadge() != null ? sb.getBadge().getDescription() : "");
            b.put("icon", sb.getBadge() != null ? sb.getBadge().getIcon() : "Award");
            b.put("earnedAt", sb.getEarnedAt());
            badgeList.add(b);
        }

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", student.getId());
        profile.put("name", student.getName());
        profile.put("registerNumber", student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername());
        profile.put("username", student.getUsername());
        profile.put("email", student.getEmail());
        profile.put("phone", student.getPhone());
        profile.put("department", student.getDepartment() != null ? student.getDepartment() : "General");
        profile.put("status", student.getStatus() != null ? student.getStatus().name() : "ACTIVE");
        profile.put("dateJoined", student.getCreatedAt());
        profile.put("testsAttended", attended);
        profile.put("testsTotal", tests.size());
        profile.put("totalMarks", totalMarks);
        profile.put("averagePerformance", Math.round(avgMarks * 10.0) / 10.0);
        profile.put("testHistory", testHistory);
        profile.put("submissionHistory", submissionHistory);
        profile.put("badges", badgeList);

        return ResponseEntity.ok(profile);
    }

    @PatchMapping("/students/{id}/status")
    public ResponseEntity<?> toggleStudentStatus(@PathVariable Long id, @RequestBody Map<String, String> payload) {
        User student = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Student not found"));
        String statusStr = payload.get("status");
        try {
            student.setStatus(UserStatus.valueOf(statusStr));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body("Invalid status: " + statusStr);
        }
        userRepository.save(student);
        return ResponseEntity.ok("Student status updated to " + statusStr);
    }

    @GetMapping("/staff-performance")
    public ResponseEntity<Map<String, Object>> getStaffPerformance() {
        List<User> staffMembers = userRepository.findByRole(Role.ADMIN);
        List<Test> allTests = testRepository.findAll();
        List<StudentTest> studentTests = studentTestRepository.findAll();

        // Use application configured timezone (Asia/Kolkata)
        java.time.ZoneId zoneId = java.time.ZoneId.of("Asia/Kolkata");
        java.time.ZonedDateTime nowZoned = java.time.ZonedDateTime.now(zoneId);
        java.time.LocalDate today = nowZoned.toLocalDate();
        java.time.LocalDate weekStart = today.with(java.time.temporal.TemporalAdjusters.previousOrSame(java.time.DayOfWeek.MONDAY));
        java.time.LocalDate monthStart = today.withDayOfMonth(1);
        LocalDateTime currentNow = nowZoned.toLocalDateTime();

        String formattedTodayDate = nowZoned.format(java.time.format.DateTimeFormatter.ofPattern("EEEE, MMM dd, yyyy"));

        // Precompute students assigned per test
        Map<Long, Long> studentsCountByTest = studentTests.stream()
                .filter(st -> st.getTest() != null)
                .collect(Collectors.groupingBy(st -> st.getTest().getId(), Collectors.counting()));

        // Filter to actual tests created through the Admin panel (excluding practice arena containers & auto-generated wrappers)
        List<Test> actualAdminTests = new ArrayList<>();
        Set<String> seenTestKeys = new HashSet<>();

        for (Test t : allTests) {
            if (t == null) continue;

            // 1. Exclude Practice Arena auto-generated containers
            if (t.getInstructions() != null && t.getInstructions().contains("Write your solutions to the practice problems in the arena canvas.")) {
                continue;
            }
            if (t.getName() != null && t.getName().trim().toLowerCase().endsWith("practice arena")) {
                continue;
            }

            // 2. Exclude auto-generated question test wrappers (created with 10-year end time)
            if (t.getStartTime() != null && t.getEndTime() != null) {
                long daysBetween = java.time.temporal.ChronoUnit.DAYS.between(t.getStartTime(), t.getEndTime());
                if (daysBetween > 365) {
                    continue;
                }
            }

            // 3. Deduplicate repeated timetable entries for the same test
            String uniqueKey;
            if (t.getTestCode() != null && !t.getTestCode().trim().isEmpty() && !t.getTestCode().trim().startsWith("TEST-")) {
                uniqueKey = t.getTestCode().trim().toUpperCase();
            } else {
                Long subId = t.getSubject() != null ? t.getSubject().getId() : 0L;
                uniqueKey = (t.getName() != null ? t.getName().trim().toLowerCase() : "") + "_" + subId;
            }

            if (seenTestKeys.add(uniqueKey)) {
                actualAdminTests.add(t);
            }
        }

        // Global summary card calculations strictly from actualAdminTests using actual createdAt
        long globalTodayTests = 0;
        long globalWeekTests = 0;
        long globalMonthTests = 0;
        long globalTotalTests = actualAdminTests.size();

        for (Test t : actualAdminTests) {
            LocalDateTime testTime = t.getCreatedAt() != null ? t.getCreatedAt() : t.getStartTime();
            if (testTime != null) {
                java.time.LocalDate testDate = testTime.toLocalDate();
                if (testDate.isEqual(today)) globalTodayTests++;
                if (!testDate.isBefore(weekStart) && !testDate.isAfter(today)) globalWeekTests++;
                if (!testDate.isBefore(monthStart) && !testDate.isAfter(today)) globalMonthTests++;
            }
        }

        Map<String, Object> summary = new HashMap<>();
        summary.put("todayTests", globalTodayTests);
        summary.put("todayDate", formattedTodayDate);
        summary.put("weekTests", globalWeekTests);
        summary.put("monthTests", globalMonthTests);
        summary.put("totalTests", globalTotalTests);

        // Staff-wise detailed performance calculation from actualAdminTests
        List<Map<String, Object>> staffList = new ArrayList<>();
        for (User staff : staffMembers) {
            List<Test> staffTests = actualAdminTests.stream()
                    .filter(t -> {
                        User effectiveStaff = t.getEffectiveStaff();
                        return effectiveStaff != null && effectiveStaff.getId().equals(staff.getId());
                    })
                    .collect(Collectors.toList());

            long staffToday = 0;
            long staffWeek = 0;
            long staffMonth = 0;
            long staffTotal = staffTests.size();

            // Group staff tests by Subject
            Map<Long, List<Test>> testsBySubject = new HashMap<>();
            Map<Long, String> subjectNameMap = new HashMap<>();

            for (Test t : staffTests) {
                LocalDateTime testTime = t.getCreatedAt() != null ? t.getCreatedAt() : t.getStartTime();
                if (testTime != null) {
                    java.time.LocalDate testDate = testTime.toLocalDate();
                    if (testDate.isEqual(today)) staffToday++;
                    if (!testDate.isBefore(weekStart) && !testDate.isAfter(today)) staffWeek++;
                    if (!testDate.isBefore(monthStart) && !testDate.isAfter(today)) staffMonth++;
                }

                if (t.getSubject() != null) {
                    Long subId = t.getSubject().getId();
                    testsBySubject.computeIfAbsent(subId, k -> new ArrayList<>()).add(t);
                    subjectNameMap.put(subId, t.getSubject().getName());
                } else {
                    testsBySubject.computeIfAbsent(0L, k -> new ArrayList<>()).add(t);
                    subjectNameMap.put(0L, "General / Uncategorized");
                }
            }

            // Build subject-wise statistics list
            List<Map<String, Object>> subjectStats = new ArrayList<>();
            List<String> subjectsHandled = new ArrayList<>();

            for (Map.Entry<Long, List<Test>> entry : testsBySubject.entrySet()) {
                Long subId = entry.getKey();
                String subName = subjectNameMap.get(subId);
                subjectsHandled.add(subName);

                List<Test> sTests = entry.getValue();
                long subToday = 0;
                long subWeek = 0;
                long subMonth = 0;
                long subTotal = sTests.size();

                for (Test stItem : sTests) {
                    LocalDateTime stTime = stItem.getCreatedAt() != null ? stItem.getCreatedAt() : stItem.getStartTime();
                    if (stTime != null) {
                        java.time.LocalDate testDate = stTime.toLocalDate();
                        if (testDate.isEqual(today)) subToday++;
                        if (!testDate.isBefore(weekStart) && !testDate.isAfter(today)) subWeek++;
                        if (!testDate.isBefore(monthStart) && !testDate.isAfter(today)) subMonth++;
                    }
                }

                Map<String, Object> subMap = new HashMap<>();
                subMap.put("subjectId", subId);
                subMap.put("subjectName", subName);
                subMap.put("todayTests", subToday);
                subMap.put("weeklyTests", subWeek);
                subMap.put("monthlyTests", subMonth);
                subMap.put("totalTests", subTotal);
                subjectStats.add(subMap);
            }

            // Build detailed test list for this staff member
            List<Map<String, Object>> detailedTests = new ArrayList<>();
            for (Test t : staffTests) {
                Map<String, Object> tm = new HashMap<>();
                tm.put("id", t.getId());
                tm.put("name", t.getName());
                tm.put("testCode", t.getTestCode() != null ? t.getTestCode() : "TEST-" + t.getId());
                tm.put("subjectId", t.getSubject() != null ? t.getSubject().getId() : null);
                tm.put("subjectName", t.getSubject() != null ? t.getSubject().getName() : "General");
                
                // Real creator attribution
                String creatorName = "N/A";
                if (t.getAdmin() != null && t.getAdmin().getName() != null && !t.getAdmin().getName().trim().isEmpty()) {
                    creatorName = t.getAdmin().getName();
                }
                tm.put("createdBy", creatorName);

                // Assigned staff
                String assignedStaffName = "N/A";
                if (t.getAssignedStaff() != null && t.getAssignedStaff().getName() != null && !t.getAssignedStaff().getName().trim().isEmpty()) {
                    assignedStaffName = t.getAssignedStaff().getName();
                } else if (t.getAdmin() != null && t.getAdmin().getName() != null) {
                    assignedStaffName = t.getAdmin().getName();
                }
                tm.put("assignedStaff", assignedStaffName);

                tm.put("createdAt", t.getCreatedAt() != null ? t.getCreatedAt() : t.getStartTime());
                tm.put("startTime", t.getStartTime());
                tm.put("endTime", t.getEndTime());
                tm.put("durationMinutes", t.getDurationMinutes());
                Integer tMax = 100;
                if (t != null && t.getMaxMarks() != null) {
                    tMax = t.getMaxMarks();
                }
                tm.put("maxMarks", tMax);
                tm.put("studentsAssigned", studentsCountByTest.getOrDefault(t.getId(), 0L));

                // Determine test status
                String status;
                if (t.getStartTime() != null && currentNow.isBefore(t.getStartTime())) {
                    status = "UPCOMING";
                } else if (t.getEndTime() != null && currentNow.isAfter(t.getEndTime())) {
                    status = "COMPLETED";
                } else {
                    status = "ACTIVE";
                }
                tm.put("status", status);

                detailedTests.add(tm);
            }

            // Sort tests by createdAt descending
            detailedTests.sort((a, b) -> {
                LocalDateTime ta = (LocalDateTime) a.get("createdAt");
                LocalDateTime tb = (LocalDateTime) b.get("createdAt");
                if (ta == null || tb == null) return 0;
                return tb.compareTo(ta);
            });

            Map<String, Object> staffData = new HashMap<>();
            staffData.put("id", staff.getId());
            staffData.put("name", staff.getName());
            staffData.put("staffId", staff.getUsername() != null ? staff.getUsername() : staff.getRegisterNumber());
            staffData.put("email", staff.getEmail());
            staffData.put("department", staff.getDepartment() != null ? staff.getDepartment() : "General");
            staffData.put("status", staff.getStatus() != null ? staff.getStatus().name() : "ACTIVE");
            staffData.put("todayTests", staffToday);
            staffData.put("weekTests", staffWeek);
            staffData.put("monthTests", staffMonth);
            staffData.put("totalTests", staffTotal);
            staffData.put("subjectsHandled", subjectsHandled);
            staffData.put("subjectStats", subjectStats);
            staffData.put("tests", detailedTests);
            staffData.put("lastActive", staff.getUpdatedAt());

            staffList.add(staffData);
        }

        // Sort staff members by total tests descending
        staffList.sort((a, b) -> Long.compare((Long) b.get("totalTests"), (Long) a.get("totalTests")));

        Map<String, Object> response = new HashMap<>();
        response.put("summary", summary);
        response.put("staffPerformance", staffList);

        return ResponseEntity.ok(response);
    }

    @GetMapping("/analytics/overview")
    public ResponseEntity<Map<String, Object>> getAnalyticsOverview() {
        Map<String, Object> analytics = new HashMap<>();

        // Department performance
        List<User> students = userRepository.findByRole(Role.STUDENT);
        List<StudentTest> completedTests = studentTestRepository.findAllCompletedWithStudents();
        Map<String, List<User>> studentsByDept = students.stream()
                .collect(Collectors.groupingBy(u -> u.getDepartment() != null && !u.getDepartment().isBlank() ? u.getDepartment() : "General"));

        List<Map<String, Object>> deptAnalytics = new ArrayList<>();
        for (Map.Entry<String, List<User>> entry : studentsByDept.entrySet()) {
            String dept = entry.getKey();
            List<User> deptStudents = entry.getValue();
            Set<Long> deptStudentIds = deptStudents.stream().map(User::getId).collect(Collectors.toSet());

            List<StudentTest> deptTests = completedTests.stream()
                    .filter(st -> st.getStudent() != null && deptStudentIds.contains(st.getStudent().getId()))
                    .collect(Collectors.toList());

            double avg = deptTests.isEmpty() ? 0.0 :
                    deptTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);
            long passed = deptTests.stream().filter(st -> (st.getScore() != null ? st.getScore() : 0) >= 40).count();
            double passRate = deptTests.isEmpty() ? 0.0 : ((double) passed / deptTests.size()) * 100.0;

            Map<String, Object> d = new HashMap<>();
            d.put("department", dept);
            d.put("studentsCount", deptStudents.size());
            d.put("testsCompleted", deptTests.size());
            d.put("averageScore", Math.round(avg * 10.0) / 10.0);
            d.put("passRate", Math.round(passRate * 10.0) / 10.0);
            deptAnalytics.add(d);
        }
        analytics.put("departmentAnalytics", deptAnalytics);

        // Subject-wise performance
        List<Subject> subjects = subjectRepository.findAll();
        List<Test> allTests = testRepository.findAll();
        List<Map<String, Object>> subjectAnalytics = new ArrayList<>();

        for (Subject sub : subjects) {
            List<Long> testIds = allTests.stream()
                    .filter(t -> t.getSubject() != null && t.getSubject().getId().equals(sub.getId()))
                    .map(Test::getId).collect(Collectors.toList());

            List<StudentTest> subTests = completedTests.stream()
                    .filter(st -> st.getTest() != null && testIds.contains(st.getTest().getId()))
                    .collect(Collectors.toList());

            double avg = subTests.isEmpty() ? 0.0 :
                    subTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).average().orElse(0.0);
            long passed = subTests.stream().filter(st -> (st.getScore() != null ? st.getScore() : 0) >= 40).count();
            double passRate = subTests.isEmpty() ? 0.0 : ((double) passed / subTests.size()) * 100.0;

            Map<String, Object> s = new HashMap<>();
            s.put("subjectId", sub.getId());
            s.put("subjectName", sub.getName());
            s.put("testsCount", testIds.size());
            s.put("submissionsCount", subTests.size());
            s.put("averageScore", Math.round(avg * 10.0) / 10.0);
            s.put("passRate", Math.round(passRate * 10.0) / 10.0);
            subjectAnalytics.add(s);
        }
        analytics.put("subjectAnalytics", subjectAnalytics);

        // Top Performing Students
        List<Map<String, Object>> topStudents = students.stream().map(student -> {
            List<StudentTest> userTests = completedTests.stream()
                    .filter(st -> st.getStudent() != null && st.getStudent().getId().equals(student.getId()))
                    .collect(Collectors.toList());
            int totalScore = userTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
            double avgScore = userTests.isEmpty() ? 0.0 : (double) totalScore / userTests.size();

            Map<String, Object> studentMap = new HashMap<>();
            studentMap.put("id", student.getId());
            studentMap.put("name", student.getName());
            studentMap.put("registerNumber", student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername());
            studentMap.put("department", student.getDepartment() != null ? student.getDepartment() : "General");
            studentMap.put("testsCompleted", userTests.size());
            studentMap.put("totalScore", totalScore);
            studentMap.put("averageScore", Math.round(avgScore * 10.0) / 10.0);
            return studentMap;
        })
        .filter(m -> ((int) m.get("testsCompleted")) > 0)
        .sorted((a, b) -> Double.compare((double) b.get("averageScore"), (double) a.get("averageScore")))
        .limit(10)
        .collect(Collectors.toList());
        analytics.put("topPerformingStudents", topStudents);

        // Low Participation Identification
        List<Map<String, Object>> lowParticipation = students.stream().map(student -> {
            long attended = completedTests.stream()
                    .filter(st -> st.getStudent() != null && st.getStudent().getId().equals(student.getId()))
                    .count();
            Map<String, Object> m = new HashMap<>();
            m.put("id", student.getId());
            m.put("name", student.getName());
            m.put("registerNumber", student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername());
            m.put("department", student.getDepartment() != null ? student.getDepartment() : "General");
            m.put("testsAttended", attended);
            m.put("status", student.getStatus() != null ? student.getStatus().name() : "ACTIVE");
            return m;
        })
        .filter(m -> ((long) m.get("testsAttended")) == 0)
        .limit(20)
        .collect(Collectors.toList());
        analytics.put("lowParticipationStudents", lowParticipation);

        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/leaderboard/overview")
    public ResponseEntity<Map<String, Object>> getDepartmentLeaderboardOverview() {
        Map<String, Object> result = new HashMap<>();

        // 1. Fetch all students
        List<User> allStudents = userRepository.findByRole(Role.STUDENT);

        // 2. Fetch all subjects
        List<Subject> allSubjects = subjectRepository.findAll();

        // 3. Fetch all tests and student tests
        List<Test> allTests = testRepository.findAll();
        List<StudentTest> allStudentTests = studentTestRepository.findAllWithStudents();

        // 4. Fetch achievements and badges
        List<StudentAchievement> allAchievements = studentAchievementRepository.findAll();
        List<LanguageMasterBadge> allLangBadges = languageMasterBadgeRepository.findAll();
        List<StudentBadge> allCustomBadges = studentBadgeRepository.findAll();

        // Filter valid completed/submitted student tests
        List<StudentTest> validStudentTests = allStudentTests.stream()
                .filter(st -> st.getStudent() != null && st.getTest() != null
                        && ("SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus()) || "COMPLETED".equals(st.getStatus())
                        || (st.getScore() != null && st.getScore() > 0)))
                .collect(Collectors.toList());

        // Group valid student tests by student ID
        Map<Long, List<StudentTest>> testsByStudent = validStudentTests.stream()
                .collect(Collectors.groupingBy(st -> st.getStudent().getId()));

        // Group valid student tests by Subject ID
        Map<Long, List<StudentTest>> testsBySubject = validStudentTests.stream()
                .filter(st -> st.getTest().getSubject() != null)
                .collect(Collectors.groupingBy(st -> st.getTest().getSubject().getId()));

        // -------------------------------------------------------------
        // A. Calculate Subject-Wise Leaderboards & Subject Medals
        // -------------------------------------------------------------
        Map<Long, Map<String, Object>> subjectLeaderboards = new HashMap<>();
        Map<Long, List<Map<String, Object>>> studentMedalsMap = new HashMap<>();
        List<Map<String, Object>> hallOfFame = new ArrayList<>();

        for (Subject subject : allSubjects) {
            Long subId = subject.getId();
            String subName = subject.getName();
            List<StudentTest> subTests = testsBySubject.getOrDefault(subId, Collections.emptyList());

            // Group by student for this subject
            Map<Long, List<StudentTest>> studentSubTests = subTests.stream()
                    .collect(Collectors.groupingBy(st -> st.getStudent().getId()));

            List<Map<String, Object>> subjectStudentEntries = new ArrayList<>();

            for (Map.Entry<Long, List<StudentTest>> entry : studentSubTests.entrySet()) {
                Long studentId = entry.getKey();
                List<StudentTest> stList = entry.getValue();
                if (stList.isEmpty()) continue;

                User student = stList.get(0).getStudent();
                int totalScore = stList.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
                int totalMax = stList.stream().mapToInt(st -> st.getTest() != null && st.getTest().getMaxMarks() != null ? st.getTest().getMaxMarks() : 100).sum();
                double pct = totalMax > 0 ? ((double) totalScore / totalMax) * 100.0 : 0.0;
                long totalTimeSec = stList.stream().mapToLong(st -> st.getTimeTakenSeconds() != null ? st.getTimeTakenSeconds() : 0L).sum();

                LocalDateTime latestCompletion = stList.stream()
                        .map(st -> st.getSubmittedAt() != null ? st.getSubmittedAt() : st.getStartedAt())
                        .filter(Objects::nonNull)
                        .max(LocalDateTime::compareTo)
                        .orElse(null);

                Map<String, Object> subStudent = new HashMap<>();
                subStudent.put("studentId", studentId);
                subStudent.put("studentName", student.getName());
                subStudent.put("registerNumber", student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername());
                subStudent.put("department", student.getDepartment() != null ? student.getDepartment() : "General");
                subStudent.put("marks", totalScore);
                subStudent.put("maxMarks", totalMax);
                subStudent.put("percentage", Math.round(pct * 10.0) / 10.0);
                subStudent.put("testsCompleted", stList.size());
                subStudent.put("timeTakenSeconds", totalTimeSec);
                subStudent.put("lastCompletedAt", latestCompletion != null ? latestCompletion.toString() : null);
                subStudent.put("latestCompletionObj", latestCompletion);

                subjectStudentEntries.add(subStudent);
            }

            // Ranking priority for Subject:
            // 1. Higher marks (DESC)
            // 2. Lower time taken (ASC)
            // 3. Earlier completion time (ASC)
            subjectStudentEntries.sort((a, b) -> {
                int scoreComp = Integer.compare((int) b.get("marks"), (int) a.get("marks"));
                if (scoreComp != 0) return scoreComp;

                int timeComp = Long.compare((long) a.get("timeTakenSeconds"), (long) b.get("timeTakenSeconds"));
                if (timeComp != 0) return timeComp;

                LocalDateTime da = (LocalDateTime) a.get("latestCompletionObj");
                LocalDateTime db = (LocalDateTime) b.get("latestCompletionObj");
                if (da != null && db != null) return da.compareTo(db);
                if (da != null) return -1;
                if (db != null) return 1;

                return Long.compare((Long) a.get("studentId"), (Long) b.get("studentId"));
            });

            // Assign subject rank and subject medals (1=Gold, 2=Silver, 3=Bronze)
            int rank = 1;
            for (Map<String, Object> entry : subjectStudentEntries) {
                entry.remove("latestCompletionObj");
                entry.put("rank", rank);

                int marks = (int) entry.get("marks");
                int testsCount = (int) entry.get("testsCompleted");

                if (testsCount > 0 && marks > 0) {
                    String medalIcon = null;
                    String medalType = null;
                    if (rank == 1) {
                        medalIcon = "🥇";
                        medalType = "GOLD";
                    } else if (rank == 2) {
                        medalIcon = "🥈";
                        medalType = "SILVER";
                    } else if (rank == 3) {
                        medalIcon = "🥉";
                        medalType = "BRONZE";
                    }

                    if (medalIcon != null) {
                        entry.put("medal", medalIcon);
                        entry.put("medalType", medalType);

                        Long sId = (Long) entry.get("studentId");
                        Map<String, Object> medalRecord = new HashMap<>();
                        medalRecord.put("type", medalType);
                        medalRecord.put("icon", medalIcon);
                        medalRecord.put("title", subName + " " + (rank == 1 ? "Gold Champion" : (rank == 2 ? "Silver Champion" : "Bronze Champion")));
                        medalRecord.put("subject", subName);
                        medalRecord.put("rank", rank);
                        studentMedalsMap.computeIfAbsent(sId, k -> new ArrayList<>()).add(medalRecord);

                        // Also add to Hall of Fame
                        Map<String, Object> hofItem = new HashMap<>();
                        hofItem.put("id", "SUB-MEDAL-" + subId + "-" + sId);
                        hofItem.put("studentId", sId);
                        hofItem.put("studentName", entry.get("studentName"));
                        hofItem.put("studentRegisterNumber", entry.get("registerNumber"));
                        hofItem.put("department", entry.get("department"));
                        hofItem.put("awardName", medalIcon + " " + subName + " Rank #" + rank);
                        hofItem.put("badgeIcon", medalIcon);
                        hofItem.put("subject", subName);
                        hofItem.put("achievementType", "MEDAL");
                        hofItem.put("rank", rank);
                        hofItem.put("awardedDate", entry.get("lastCompletedAt"));
                        hallOfFame.add(hofItem);
                    }
                }
                rank++;
            }

            Map<String, Object> subLeaderboardData = new HashMap<>();
            subLeaderboardData.put("subjectId", subId);
            subLeaderboardData.put("subjectName", subName);
            subLeaderboardData.put("subjectColor", subject.getColor() != null ? subject.getColor() : "#10b981");
            subLeaderboardData.put("students", subjectStudentEntries);
            subjectLeaderboards.put(subId, subLeaderboardData);
        }

        // -------------------------------------------------------------
        // B. Calculate Overall Department Leaderboard
        // -------------------------------------------------------------
        List<Map<String, Object>> overallLeaderboard = new ArrayList<>();

        for (User student : allStudents) {
            Long sId = student.getId();
            List<StudentTest> sTests = testsByStudent.getOrDefault(sId, Collections.emptyList());

            int totalMarks = sTests.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
            int totalMax = sTests.stream().mapToInt(st -> st.getTest() != null && st.getTest().getMaxMarks() != null ? st.getTest().getMaxMarks() : 100).sum();
            double pct = totalMax > 0 ? ((double) totalMarks / totalMax) * 100.0 : 0.0;
            long totalTimeSec = sTests.stream().mapToLong(st -> st.getTimeTakenSeconds() != null ? st.getTimeTakenSeconds() : 0L).sum();

            LocalDateTime latestCompletion = sTests.stream()
                    .map(st -> st.getSubmittedAt() != null ? st.getSubmittedAt() : st.getStartedAt())
                    .filter(Objects::nonNull)
                    .max(LocalDateTime::compareTo)
                    .orElse(null);

            // Distinct subjects participated
            List<String> subjectsParticipated = sTests.stream()
                    .filter(st -> st.getTest() != null && st.getTest().getSubject() != null)
                    .map(st -> st.getTest().getSubject().getName())
                    .distinct()
                    .sorted()
                    .collect(Collectors.toList());

            // Build per-student subject breakdown
            List<Map<String, Object>> subjectBreakdown = new ArrayList<>();
            for (Subject sub : allSubjects) {
                List<StudentTest> inThisSub = sTests.stream()
                        .filter(st -> st.getTest() != null && st.getTest().getSubject() != null && st.getTest().getSubject().getId().equals(sub.getId()))
                        .collect(Collectors.toList());

                if (!inThisSub.isEmpty()) {
                    int sm = inThisSub.stream().mapToInt(st -> st.getScore() != null ? st.getScore() : 0).sum();
                    int smax = inThisSub.stream().mapToInt(st -> st.getTest() != null && st.getTest().getMaxMarks() != null ? st.getTest().getMaxMarks() : 100).sum();
                    double spct = smax > 0 ? ((double) sm / smax) * 100.0 : 0.0;

                    // Look up rank in subject leaderboard
                    Map<String, Object> subLb = subjectLeaderboards.get(sub.getId());
                    Integer sRank = null;
                    String sMedal = null;
                    if (subLb != null) {
                        List<Map<String, Object>> studentsInSub = (List<Map<String, Object>>) subLb.get("students");
                        if (studentsInSub != null) {
                            for (Map<String, Object> sEntry : studentsInSub) {
                                if (sId.equals(sEntry.get("studentId"))) {
                                    sRank = (Integer) sEntry.get("rank");
                                    sMedal = (String) sEntry.get("medal");
                                    break;
                                }
                            }
                        }
                    }

                    Map<String, Object> sbItem = new HashMap<>();
                    sbItem.put("subjectId", sub.getId());
                    sbItem.put("subjectName", sub.getName());
                    sbItem.put("subjectColor", sub.getColor());
                    sbItem.put("testsCompleted", inThisSub.size());
                    sbItem.put("marks", sm);
                    sbItem.put("maxMarks", smax);
                    sbItem.put("percentage", Math.round(spct * 10.0) / 10.0);
                    sbItem.put("rank", sRank);
                    sbItem.put("medal", sMedal);
                    subjectBreakdown.add(sbItem);
                }
            }

            // Student badges list
            List<Map<String, Object>> studentBadges = new ArrayList<>();
            // From LanguageMasterBadge
            for (LanguageMasterBadge lmb : allLangBadges) {
                if (lmb.getStudent() != null && lmb.getStudent().getId().equals(sId)) {
                    Map<String, Object> b = new HashMap<>();
                    b.put("id", "LANG-" + lmb.getId());
                    b.put("name", lmb.getBadgeName());
                    b.put("icon", lmb.getBadgeIcon() != null ? lmb.getBadgeIcon() : "☕");
                    b.put("category", "Language Master");
                    b.put("subject", lmb.getSubject());
                    b.put("awardedDate", lmb.getAwardedDate() != null ? lmb.getAwardedDate().toString() : null);
                    studentBadges.add(b);
                }
            }
            // From StudentBadge (custom/milestone)
            for (StudentBadge sb : allCustomBadges) {
                if (sb.getStudent() != null && sb.getStudent().getId().equals(sId) && sb.getBadge() != null) {
                    Map<String, Object> b = new HashMap<>();
                    b.put("id", "BADGE-" + sb.getId());
                    b.put("name", sb.getBadge().getName());
                    b.put("icon", sb.getBadge().getIcon() != null ? sb.getBadge().getIcon() : "Award");
                    b.put("category", sb.getBadge().getType() != null ? sb.getBadge().getType() : "Achievement");
                    b.put("subject", sb.getSourceTest() != null && sb.getSourceTest().getSubject() != null ? sb.getSourceTest().getSubject().getName() : "General");
                    b.put("awardedDate", sb.getEarnedAt() != null ? sb.getEarnedAt().toString() : null);
                    studentBadges.add(b);
                }
            }
            // From StudentAchievement
            for (StudentAchievement sa : allAchievements) {
                if (sa.getStudent() != null && sa.getStudent().getId().equals(sId)) {
                    Map<String, Object> b = new HashMap<>();
                    b.put("id", "ACH-" + sa.getId());
                    b.put("name", sa.getBadgeName());
                    b.put("icon", sa.getBadgeIcon() != null ? sa.getBadgeIcon() : "Award");
                    b.put("category", sa.getBadgeCategory() != null ? sa.getBadgeCategory() : "Test Ranking");
                    b.put("subject", sa.getSubjectName() != null ? sa.getSubjectName() : "General");
                    b.put("rankAchieved", sa.getRankAchieved());
                    b.put("awardedDate", sa.getAwardedAt() != null ? sa.getAwardedAt().toString() : null);
                    studentBadges.add(b);
                }
            }

            Map<String, Object> entry = new HashMap<>();
            entry.put("id", sId);
            entry.put("name", student.getName());
            entry.put("registerNumber", student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername());
            entry.put("email", student.getEmail());
            entry.put("department", student.getDepartment() != null ? student.getDepartment() : "General");
            entry.put("status", student.getStatus() != null ? student.getStatus().name() : "ACTIVE");
            entry.put("totalMarks", totalMarks);
            entry.put("maxMarks", totalMax);
            entry.put("percentage", Math.round(pct * 10.0) / 10.0);
            entry.put("testsCompleted", sTests.size());
            entry.put("totalTimeSeconds", totalTimeSec);
            entry.put("lastCompletedAt", latestCompletion != null ? latestCompletion.toString() : null);
            entry.put("latestCompletionObj", latestCompletion);
            entry.put("subjectsParticipated", subjectsParticipated);
            entry.put("subjectBreakdown", subjectBreakdown);
            entry.put("badges", studentBadges);
            entry.put("badgesCount", studentBadges.size());

            overallLeaderboard.add(entry);
        }

        // Sort priority for Overall Department Ranking:
        // 1. Higher marks (DESC)
        // 2. Lower time taken (ASC)
        // 3. Earlier completion time (ASC)
        overallLeaderboard.sort((a, b) -> {
            int markComp = Integer.compare((int) b.get("totalMarks"), (int) a.get("totalMarks"));
            if (markComp != 0) return markComp;

            if ((int) a.get("totalMarks") > 0) {
                int timeComp = Long.compare((long) a.get("totalTimeSeconds"), (long) b.get("totalTimeSeconds"));
                if (timeComp != 0) return timeComp;

                LocalDateTime da = (LocalDateTime) a.get("latestCompletionObj");
                LocalDateTime db = (LocalDateTime) b.get("latestCompletionObj");
                if (da != null && db != null) return da.compareTo(db);
                if (da != null) return -1;
                if (db != null) return 1;
            }

            return Long.compare((Long) a.get("id"), (Long) b.get("id"));
        });

        // Assign overall ranks & medals
        int overallRank = 1;
        List<Map<String, Object>> topThree = new ArrayList<>();

        for (Map<String, Object> entry : overallLeaderboard) {
            entry.remove("latestCompletionObj");
            entry.put("rank", overallRank);

            Long sId = (Long) entry.get("id");
            int marks = (int) entry.get("totalMarks");
            int tests = (int) entry.get("testsCompleted");

            String medalIcon = null;
            String medalType = null;

            if (tests > 0 && marks > 0) {
                if (overallRank == 1) {
                    medalIcon = "🥇";
                    medalType = "GOLD";
                } else if (overallRank == 2) {
                    medalIcon = "🥈";
                    medalType = "SILVER";
                } else if (overallRank == 3) {
                    medalIcon = "🥉";
                    medalType = "BRONZE";
                }
            }

            entry.put("medal", medalIcon);
            entry.put("medalType", medalType);

            // Add overall medal to student's medal list if won
            if (medalIcon != null) {
                Map<String, Object> overallMedalRecord = new HashMap<>();
                overallMedalRecord.put("type", medalType);
                overallMedalRecord.put("icon", medalIcon);
                overallMedalRecord.put("title", "Overall Department " + (overallRank == 1 ? "Gold Champion (#1)" : (overallRank == 2 ? "Silver Champion (#2)" : "Bronze Champion (#3)")));
                overallMedalRecord.put("subject", "Overall Department");
                overallMedalRecord.put("rank", overallRank);
                studentMedalsMap.computeIfAbsent(sId, k -> new ArrayList<>()).add(0, overallMedalRecord);

                // Add to Hall of Fame
                Map<String, Object> hofItem = new HashMap<>();
                hofItem.put("id", "OVERALL-MEDAL-" + sId);
                hofItem.put("studentId", sId);
                hofItem.put("studentName", entry.get("name"));
                hofItem.put("studentRegisterNumber", entry.get("registerNumber"));
                hofItem.put("department", entry.get("department"));
                hofItem.put("awardName", medalIcon + " Overall Department Rank #" + overallRank);
                hofItem.put("badgeIcon", medalIcon);
                hofItem.put("subject", "Overall Department");
                hofItem.put("achievementType", "MEDAL");
                hofItem.put("rank", overallRank);
                hofItem.put("awardedDate", entry.get("lastCompletedAt"));
                hallOfFame.add(0, hofItem);
            }

            // Assign full medals list and count to the student
            List<Map<String, Object>> sMedals = studentMedalsMap.getOrDefault(sId, Collections.emptyList());
            entry.put("medals", sMedals);
            entry.put("medalsWonCount", sMedals.size());

            if (overallRank <= 3 && tests > 0 && marks > 0) {
                topThree.add(entry);
            }

            overallRank++;
        }

        // -------------------------------------------------------------
        // C. Add Language Master & Custom Badges into Hall of Fame
        // -------------------------------------------------------------
        for (LanguageMasterBadge lmb : allLangBadges) {
            Map<String, Object> item = new HashMap<>();
            item.put("id", "HOF-LANG-" + lmb.getId());
            item.put("studentId", lmb.getStudent() != null ? lmb.getStudent().getId() : null);
            item.put("studentName", lmb.getStudent() != null ? lmb.getStudent().getName() : "Unknown");
            item.put("studentRegisterNumber", lmb.getStudent() != null ? lmb.getStudent().getRegisterNumber() : "");
            item.put("department", lmb.getStudent() != null && lmb.getStudent().getDepartment() != null ? lmb.getStudent().getDepartment() : "General");
            item.put("awardName", lmb.getBadgeName());
            item.put("badgeIcon", lmb.getBadgeIcon() != null ? lmb.getBadgeIcon() : "☕");
            item.put("subject", lmb.getSubject());
            item.put("achievementType", "LANGUAGE_MASTER");
            item.put("rank", lmb.getAwardedRank());
            item.put("awardedDate", lmb.getAwardedDate() != null ? lmb.getAwardedDate().toString() : null);
            hallOfFame.add(item);
        }

        for (StudentBadge sb : allCustomBadges) {
            if (sb.getBadge() != null && sb.getStudent() != null) {
                Map<String, Object> item = new HashMap<>();
                item.put("id", "HOF-BADGE-" + sb.getId());
                item.put("studentId", sb.getStudent().getId());
                item.put("studentName", sb.getStudent().getName());
                item.put("studentRegisterNumber", sb.getStudent().getRegisterNumber() != null ? sb.getStudent().getRegisterNumber() : "");
                item.put("department", sb.getStudent().getDepartment() != null ? sb.getStudent().getDepartment() : "General");
                item.put("awardName", sb.getBadge().getName());
                item.put("badgeIcon", sb.getBadge().getIcon() != null ? sb.getBadge().getIcon() : "Award");
                item.put("subject", sb.getSourceTest() != null && sb.getSourceTest().getSubject() != null ? sb.getSourceTest().getSubject().getName() : "General");
                item.put("achievementType", "BADGE");
                item.put("rank", null);
                item.put("awardedDate", sb.getEarnedAt() != null ? sb.getEarnedAt().toString() : null);
                hallOfFame.add(item);
            }
        }

        // Summary counts
        long totalMedals = hallOfFame.stream().filter(h -> "MEDAL".equals(h.get("achievementType"))).count();
        long totalBadges = hallOfFame.stream().filter(h -> !"MEDAL".equals(h.get("achievementType"))).count();
        long activeParticipants = overallLeaderboard.stream().filter(st -> ((int) st.get("testsCompleted")) > 0).count();

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalStudents", allStudents.size());
        summary.put("activeParticipants", activeParticipants);
        summary.put("totalTestsConducted", allTests.size());
        summary.put("totalMedalsAwarded", totalMedals);
        summary.put("totalBadgesEarned", totalBadges);

        // Subject list simplified for tabs/filters
        List<Map<String, Object>> subjectList = allSubjects.stream().map(s -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", s.getId());
            m.put("name", s.getName());
            m.put("color", s.getColor() != null ? s.getColor() : "#10b981");
            return m;
        }).collect(Collectors.toList());

        result.put("summary", summary);
        result.put("topThree", topThree);
        result.put("departmentLeaderboard", overallLeaderboard);
        result.put("subjectLeaderboards", subjectLeaderboards);
        result.put("subjects", subjectList);
        result.put("hallOfFame", hallOfFame);

        return ResponseEntity.ok(result);
    }

    @PostMapping("/instructions")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> sendInstructions(@RequestBody Map<String, Object> payload) {
        String targetRole = (String) payload.getOrDefault("targetRole", "STUDENT");
        String recipientType = (String) payload.getOrDefault("recipientType", "ALL");
        String title = (String) payload.get("title");
        String message = (String) payload.get("message");

        if (title == null || title.trim().isEmpty() || message == null || message.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Title and message are required.");
        }

        User superAdmin = com.chillcode.assessment.security.SecurityUtils.getCurrentUser();
        List<User> recipients = new ArrayList<>();

        if ("ADMIN".equalsIgnoreCase(targetRole)) {
            if ("ALL".equalsIgnoreCase(recipientType)) {
                recipients = userRepository.findByRole(Role.ADMIN);
            } else {
                List<?> ids = (List<?>) payload.get("recipientIds");
                if (ids != null && !ids.isEmpty()) {
                    List<Long> longIds = ids.stream().map(o -> Long.valueOf(o.toString())).collect(Collectors.toList());
                    recipients = userRepository.findAllById(longIds).stream()
                            .filter(u -> u.getRole() == Role.ADMIN)
                            .collect(Collectors.toList());
                }
            }
        } else {
            // STUDENT
            if ("ALL".equalsIgnoreCase(recipientType)) {
                recipients = userRepository.findByRole(Role.STUDENT);
            } else {
                List<?> ids = (List<?>) payload.get("recipientIds");
                if (ids != null && !ids.isEmpty()) {
                    List<Long> longIds = ids.stream().map(o -> Long.valueOf(o.toString())).collect(Collectors.toList());
                    recipients = userRepository.findAllById(longIds).stream()
                            .filter(u -> u.getRole() == Role.STUDENT)
                            .collect(Collectors.toList());
                }
            }
        }

        if (recipients.isEmpty()) {
            return ResponseEntity.badRequest().body("No valid recipients selected.");
        }

        String notifType = "ADMIN".equalsIgnoreCase(targetRole) ? "ADMIN_INSTRUCTION" : "INSTRUCTION";
        for (User r : recipients) {
            Notification n = Notification.builder()
                    .user(r)
                    .admin(superAdmin)
                    .title(title.trim())
                    .message(message.trim())
                    .type(notifType)
                    .isRead(false)
                    .createdAt(LocalDateTime.now())
                    .build();
            notificationRepository.save(n);
        }

        return ResponseEntity.ok(Map.of(
                "message", "Instruction sent successfully to " + recipients.size() + " recipient(s).",
                "recipientCount", recipients.size()
        ));
    }

    @GetMapping("/instructions")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getSentInstructions() {
        List<Notification> all = notificationRepository.findAll();
        List<Notification> instructions = all.stream()
                .filter(n -> "INSTRUCTION".equals(n.getType()) || "ADMIN_INSTRUCTION".equals(n.getType()))
                .collect(Collectors.toList());

        Map<String, List<Notification>> grouped = instructions.stream()
                .collect(Collectors.groupingBy(n -> {
                    String ts = n.getCreatedAt() != null ? n.getCreatedAt().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")) : "unknown";
                    return n.getTitle() + ":::" + n.getMessage() + ":::" + n.getType() + ":::" + ts;
                }, LinkedHashMap::new, Collectors.toList()));

        List<Map<String, Object>> result = new ArrayList<>();
        for (List<Notification> group : grouped.values()) {
            Notification rep = group.get(0);
            long readCount = group.stream().filter(n -> Boolean.TRUE.equals(n.getIsRead())).count();
            String targetRole = "ADMIN_INSTRUCTION".equals(rep.getType()) ? "ADMIN" : "STUDENT";

            String recipientSummary;
            if (group.size() > 5) {
                recipientSummary = "All " + targetRole.toLowerCase() + "s (" + group.size() + ")";
            } else {
                recipientSummary = group.stream()
                        .map(n -> n.getUser() != null ? n.getUser().getName() : "Unknown")
                        .collect(Collectors.joining(", "));
            }

            Map<String, Object> item = new HashMap<>();
            item.put("id", rep.getId());
            item.put("title", rep.getTitle());
            item.put("message", rep.getMessage());
            item.put("targetRole", targetRole);
            item.put("recipientSummary", recipientSummary);
            item.put("senderName", rep.getAdmin() != null ? rep.getAdmin().getName() : "Super Administrator");
            item.put("sentAt", rep.getCreatedAt());
            item.put("totalRecipients", group.size());
            item.put("readCount", readCount);
            result.add(item);
        }

        result.sort((a, b) -> {
            LocalDateTime ta = (LocalDateTime) a.get("sentAt");
            LocalDateTime tb = (LocalDateTime) b.get("sentAt");
            if (ta == null && tb == null) return 0;
            if (ta == null) return 1;
            if (tb == null) return -1;
            return tb.compareTo(ta);
        });

        return ResponseEntity.ok(result);
    }
}
