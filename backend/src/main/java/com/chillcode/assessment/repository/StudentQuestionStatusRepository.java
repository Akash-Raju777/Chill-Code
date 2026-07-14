package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.StudentQuestionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface StudentQuestionStatusRepository extends JpaRepository<StudentQuestionStatus, Long> {
    Optional<StudentQuestionStatus> findByStudentIdAndQuestionId(Long studentId, Long questionId);
    List<StudentQuestionStatus> findByStudentId(Long studentId);
    List<StudentQuestionStatus> findByStudentIdAndStatus(Long studentId, String status);
    List<StudentQuestionStatus> findByQuestionId(Long questionId);

    long countByStudentIdAndStatus(Long studentId, String status);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM StudentQuestionStatus s WHERE s.studentId = :studentId AND s.attemptCount > 0 AND s.status <> :status")
    long countByStudentIdAndAttemptCountGreaterThanAndStatusNot(@org.springframework.data.repository.query.Param("studentId") Long studentId, @org.springframework.data.repository.query.Param("status") String status);
}
