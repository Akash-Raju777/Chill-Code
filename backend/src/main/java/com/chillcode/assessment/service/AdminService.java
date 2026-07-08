package com.chillcode.assessment.service;

import com.chillcode.assessment.dto.DashboardMetricsDto;
import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;

@Service
public class AdminService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private TestRepository testRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private WarningRepository warningRepository;

    @Autowired
    private ActivityLogRepository activityLogRepository;

    public DashboardMetricsDto getDashboardMetrics() {
        long totalStudents = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT).count();
        long totalSubjects = subjectRepository.count();
        long totalTests = testRepository.count();
        long totalQuestions = questionRepository.count();

        LocalDateTime now = LocalDateTime.now();
        long todayActiveTests = testRepository.findAll().stream()
                .filter(t -> t.getStartTime().isBefore(now) && t.getEndTime().isAfter(now))
                .count();

        long pendingEvaluations = studentTestRepository.findAll().stream()
                .filter(st -> "SUBMITTED".equals(st.getStatus()))
                .count();

        // Prepare monthly tests chart using actual data
        List<Map<String, Object>> monthlyTests = new ArrayList<>();
        String[] months = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
        List<com.chillcode.assessment.entity.Test> testsList = testRepository.findAll();
        for (int i = 5; i >= 0; i--) {
            LocalDateTime monthStart = now.minusMonths(i).withDayOfMonth(1).withHour(0).withMinute(0).withSecond(0).withNano(0);
            LocalDateTime monthEnd = monthStart.plusMonths(1);
            String monthName = months[monthStart.getMonthValue() - 1];
            
            long count = testsList.stream()
                    .filter(t -> t.getStartTime() != null && !t.getStartTime().isBefore(monthStart) && t.getStartTime().isBefore(monthEnd))
                    .count();
            
            Map<String, Object> data = new HashMap<>();
            data.put("month", monthName);
            data.put("tests", count);
            monthlyTests.add(data);
        }

        // Student participation chart using actual data
        List<Map<String, Object>> studentParticipation = new ArrayList<>();
        testRepository.findAll().stream()
                .filter(t -> studentTestRepository.findByTestId(t.getId()).size() > 0)
                .limit(5)
                .forEach(t -> {
                    Map<String, Object> data = new HashMap<>();
                    data.put("name", t.getName());
                    long assigned = studentTestRepository.findByTestId(t.getId()).stream()
                            .filter(st -> st.getStudent() != null && (com.chillcode.assessment.entity.UserStatus.ACTIVE.equals(st.getStudent().getStatus()) || com.chillcode.assessment.entity.UserStatus.NO_SECURITY.equals(st.getStudent().getStatus())))
                            .count();
                    long attended = studentTestRepository.findByTestId(t.getId()).stream()
                            .filter(st -> st.getStudent() != null && (com.chillcode.assessment.entity.UserStatus.ACTIVE.equals(st.getStudent().getStatus()) || com.chillcode.assessment.entity.UserStatus.NO_SECURITY.equals(st.getStudent().getStatus())))
                            .filter(st -> !"ASSIGNED".equals(st.getStatus()))
                            .count();
                    data.put("assigned", assigned);
                    data.put("attended", attended);
                    studentParticipation.add(data);
                });

        // Language wise performance chart calculated dynamically from all student submissions
        List<Map<String, Object>> languagePerformance = new ArrayList<>();
        List<com.chillcode.assessment.entity.Submission> allSubmissions = submissionRepository.findAll();
        Map<String, List<com.chillcode.assessment.entity.Submission>> subsByLang = allSubmissions.stream()
                .collect(java.util.stream.Collectors.groupingBy(s -> s.getLanguage().toLowerCase()));

        String[] langs = {"java", "python", "cpp", "c", "javascript"};
        for (String lang : langs) {
            List<com.chillcode.assessment.entity.Submission> langSubs = subsByLang.getOrDefault(lang, java.util.Collections.emptyList());
            double avg = 0.0;
            if (!langSubs.isEmpty()) {
                avg = langSubs.stream()
                        .mapToInt(s -> "ACCEPTED".equals(s.getStatus()) ? 100 : 0)
                        .average()
                        .orElse(0.0);
            }
            Map<String, Object> data = new HashMap<>();
            data.put("language", lang.toUpperCase());
            data.put("avgScore", Math.round(avg * 10.0) / 10.0);
            languagePerformance.add(data);
        }

        // Recent activity logs
        List<Map<String, Object>> recentActivities = new ArrayList<>();
        warningRepository.findAll().stream()
                .sorted(Comparator.comparing(com.chillcode.assessment.entity.Warning::getTimestamp).reversed())
                .limit(5)
                .forEach(w -> {
                    Map<String, Object> activity = new HashMap<>();
                    activity.put("time", w.getTimestamp().toString());
                    activity.put("user", w.getStudentTest().getStudent().getName());
                    activity.put("registerNumber", w.getStudentTest().getStudent().getRegisterNumber());
                    activity.put("details", "Triggered warning: " + w.getType() + " - " + w.getReason());
                    activity.put("type", "warning");
                    recentActivities.add(activity);
                });

        if (recentActivities.isEmpty()) {
            Map<String, Object> sampleAct = new HashMap<>();
            sampleAct.put("time", now.minusMinutes(10).toString());
            sampleAct.put("user", "System Admin");
            sampleAct.put("details", "Dashboard metrics initialized successfully.");
            sampleAct.put("type", "info");
            recentActivities.add(sampleAct);
        }

        return DashboardMetricsDto.builder()
                .totalStudents(totalStudents)
                .totalSubjects(totalSubjects)
                .totalTests(totalTests)
                .totalQuestions(totalQuestions)
                .todayActiveTests(todayActiveTests)
                .pendingEvaluations(pendingEvaluations)
                .monthlyTests(monthlyTests)
                .studentParticipation(studentParticipation)
                .languagePerformance(languagePerformance)
                .recentActivities(recentActivities)
                .build();
    }

    @Autowired
    private StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private AchievementRepository achievementRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @org.springframework.transaction.annotation.Transactional
    public void deleteStudent(Long id) {
        // 1. Delete all notifications for this student
        entityManager.createQuery("DELETE FROM Notification n WHERE n.user.id = :stuId")
                .setParameter("stuId", id)
                .executeUpdate();

        // 2. Delete all achievements for this student
        entityManager.createQuery("DELETE FROM Achievement a WHERE a.student.id = :stuId")
                .setParameter("stuId", id)
                .executeUpdate();

        // 3. Delete all student question statuses
        entityManager.createQuery("DELETE FROM StudentQuestionStatus sqs WHERE sqs.studentId = :stuId")
                .setParameter("stuId", id)
                .executeUpdate();

        // 4. Delete warning logs for student tests of this student
        entityManager.createQuery("DELETE FROM Warning w WHERE w.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.student.id = :stuId)")
                .setParameter("stuId", id)
                .executeUpdate();

        // 5. Delete submission test cases for submissions of student tests of this student
        entityManager.createQuery("DELETE FROM SubmissionTestCase stc WHERE stc.submission.id IN (SELECT s.id FROM Submission s WHERE s.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.student.id = :stuId))")
                .setParameter("stuId", id)
                .executeUpdate();

        // 6. Delete submissions of student tests of this student
        entityManager.createQuery("DELETE FROM Submission s WHERE s.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.student.id = :stuId)")
                .setParameter("stuId", id)
                .executeUpdate();

        // 7. Delete student tests of this student
        entityManager.createQuery("DELETE FROM StudentTest st WHERE st.student.id = :stuId")
                .setParameter("stuId", id)
                .executeUpdate();

        // 8. Delete student itself
        entityManager.createQuery("DELETE FROM User u WHERE u.id = :stuId")
                .setParameter("stuId", id)
                .executeUpdate();
    }
}
