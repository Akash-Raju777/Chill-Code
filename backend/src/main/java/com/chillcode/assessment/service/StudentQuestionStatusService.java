package com.chillcode.assessment.service;

import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.StudentQuestionStatusRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Dedicated service for updating StudentQuestionStatus records.
 * 
 * Uses REQUIRES_NEW propagation so that any constraint violation
 * (e.g., admin_id NOT NULL) does NOT roll back the parent transaction
 * that saved the Submission entity. This prevents the Hibernate 
 * "null id in Submission" cascade failure.
 */
@Service
public class StudentQuestionStatusService {

    @Autowired
    private StudentQuestionStatusRepository studentQuestionStatusRepository;

    /**
     * Resolves the admin ID deterministically from the entity chain.
     * 
     * Resolution order (first non-null wins):
     * 1. StudentTest.test.admin (Test always has an admin — set during creation)
     * 2. StudentTest.admin (direct admin reference on the assignment)
     * 3. StudentTest.student.admin (the student's owning admin)
     * 4. Question.admin (the question's creator)
     * 
     * @return the resolved admin ID, never null
     * @throws IllegalStateException if admin cannot be resolved (data integrity issue)
     */
    public Long resolveAdminId(StudentTest studentTest, Question question) {
        Long adminId = null;

        // Primary: Test.admin — every Test created via Admin UI has this set
        if (studentTest != null && studentTest.getTest() != null && studentTest.getTest().getAdmin() != null) {
            adminId = studentTest.getTest().getAdmin().getId();
        }

        // Fallback 1: StudentTest.admin — set during test assignment
        if (adminId == null && studentTest != null && studentTest.getAdmin() != null) {
            adminId = studentTest.getAdmin().getId();
        }

        // Fallback 2: Student.admin — the student's owning admin
        if (adminId == null && studentTest != null && studentTest.getStudent() != null && studentTest.getStudent().getAdmin() != null) {
            adminId = studentTest.getStudent().getAdmin().getId();
        }

        // Fallback 3: Question.admin — the question creator
        if (adminId == null && question != null && question.getAdmin() != null) {
            adminId = question.getAdmin().getId();
        }

        if (adminId == null) {
            String diagnostics = String.format(
                "studentTestId=%s, testId=%s, questionId=%s",
                studentTest != null ? studentTest.getId() : "null",
                studentTest != null && studentTest.getTest() != null ? studentTest.getTest().getId() : "null",
                question != null ? question.getId() : "null"
            );
            throw new IllegalStateException(
                "Cannot resolve admin ownership for student_question_status update. " +
                "This indicates a data integrity issue — every Test must have an admin. " +
                "Diagnostics: " + diagnostics
            );
        }

        return adminId;
    }

    /**
     * Updates or creates a StudentQuestionStatus record.
     * 
     * Runs in a SEPARATE transaction (REQUIRES_NEW) so that any failure here
     * does NOT corrupt the parent Submission transaction.
     * 
     * @param student    the student User entity
     * @param question   the Question entity
     * @param submission the saved Submission entity (must have an ID)
     * @param adminId    the resolved admin ID (must not be null)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void updateStatus(User student, Question question, Submission submission, Long adminId) {
        if (student == null || question == null || adminId == null) {
            throw new IllegalArgumentException(String.format(
                "Cannot update StudentQuestionStatus with null parameters: studentId=%s, questionId=%s, adminId=%s",
                student != null ? student.getId() : "null",
                question != null ? question.getId() : "null",
                adminId
            ));
        }

        System.out.println(String.format(
            "[StudentQuestionStatus] Updating: studentId=%d, questionId=%d, adminId=%d, submissionId=%s, submissionStatus=%s",
            student.getId(), question.getId(), adminId,
            submission != null ? submission.getId() : "null",
            submission != null ? submission.getStatus() : "null"
        ));

        StudentQuestionStatus status = studentQuestionStatusRepository
                .findByStudentIdAndQuestionId(student.getId(), question.getId())
                .orElse(null);

        if (status == null) {
            status = new StudentQuestionStatus();
            status.setAdminId(adminId);
            status.setStudentId(student.getId());
            status.setQuestionId(question.getId());
            status.setStatus("IN_PROGRESS");
            status.setAttemptCount(0);
        }

        if (submission != null && submission.getCode() != null && !submission.getCode().trim().isEmpty()) {
            status.setAttemptCount(status.getAttemptCount() + 1);
        }
        
        status.setLastAttemptAt(LocalDateTime.now());
        
        if (submission != null) {
            status.setLastSubmissionId(submission.getId());

            if ("ACCEPTED".equals(submission.getStatus()) || "PASS".equals(submission.getOverallResult())) {
                status.setStatus("COMPLETED");
                if (status.getCompletedAt() == null) {
                    status.setCompletedAt(LocalDateTime.now());
                }
            } else {
                if (!"COMPLETED".equals(status.getStatus())) {
                    status.setStatus("FAILED");
                }
            }
        }

        studentQuestionStatusRepository.save(status);

        System.out.println(String.format(
            "[StudentQuestionStatus] Saved: id=%d, status=%s, attemptCount=%d",
            status.getId(), status.getStatus(), status.getAttemptCount()
        ));
    }
}
