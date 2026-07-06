package com.chillcode.assessment.config;

import com.chillcode.assessment.entity.Question;
import com.chillcode.assessment.entity.Submission;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.StudentQuestionStatus;
import com.chillcode.assessment.repository.QuestionRepository;
import com.chillcode.assessment.repository.SubmissionRepository;
import com.chillcode.assessment.repository.UserRepository;
import com.chillcode.assessment.repository.StudentQuestionStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class DatabaseMigrationInitializer implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Autowired
    private StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(String... args) throws Exception {
        System.out.println("=== STARTING PRACTICE ARENA COMPLETION RECALCULATION ===");

        // 1. Clear existing student question status table to recalculate cleanly
        studentQuestionStatusRepository.deleteAll();
        studentQuestionStatusRepository.flush();

        List<User> students = userRepository.findAll().stream()
                .filter(u -> com.chillcode.assessment.entity.Role.STUDENT == u.getRole())
                .toList();

        List<Question> questions = questionRepository.findAll();

        // 2. Fetch all submissions once and group by "studentId_questionId" in memory
        List<Submission> allSubmissions = submissionRepository.findAll();
        java.util.Map<String, List<Submission>> submissionsGrouped = new java.util.HashMap<>();
        for (Submission s : allSubmissions) {
            if (s.getQuestion() != null && s.getStudentTest() != null && s.getStudentTest().getStudent() != null) {
                Long studentId = s.getStudentTest().getStudent().getId();
                Long questionId = s.getQuestion().getId();
                String key = studentId + "_" + questionId;
                submissionsGrouped.computeIfAbsent(key, k -> new java.util.ArrayList<>()).add(s);
            }
        }

        for (User student : students) {
            for (Question question : questions) {
                // Find all submissions by this student for this question in memory
                List<Submission> submissions = submissionsGrouped.getOrDefault(
                        student.getId() + "_" + question.getId(),
                        java.util.Collections.emptyList()
                );

                int attemptCount = submissions.size();
                boolean isCompleted = false;
                Long lastSubmissionId = null;
                java.time.LocalDateTime completedAt = null;
                java.time.LocalDateTime lastAttemptAt = null;

                if (attemptCount > 0) {
                    List<Submission> acceptedSubmissions = submissions.stream()
                            .filter(s -> "ACCEPTED".equals(s.getStatus()))
                            .toList();

                    if (!acceptedSubmissions.isEmpty()) {
                        isCompleted = true;
                        Submission latestAccepted = acceptedSubmissions.stream()
                                .max(java.util.Comparator.comparing(Submission::getId))
                                .get();
                        completedAt = latestAccepted.getCreatedAt();
                    }

                    Submission latestAttempt = submissions.stream()
                            .max(java.util.Comparator.comparing(Submission::getId))
                            .get();
                    lastSubmissionId = latestAttempt.getId();
                    lastAttemptAt = latestAttempt.getCreatedAt();
                }

                // Save status record
                StudentQuestionStatus status = new StudentQuestionStatus();
                status.setStudentId(student.getId());
                status.setQuestionId(question.getId());
                status.setStatus(isCompleted ? "COMPLETED" : "NOT_COMPLETED");
                status.setAttemptCount(attemptCount);
                status.setLastSubmissionId(lastSubmissionId);
                status.setCompletedAt(completedAt);
                status.setLastAttemptAt(lastAttemptAt);
                studentQuestionStatusRepository.save(status);
            }
        }

        System.out.println("=== COMPLETED PRACTICE ARENA COMPLETION RECALCULATION ===");
    }
}
