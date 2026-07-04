package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    List<Submission> findByStudentTestId(Long studentTestId);
    List<Submission> findByStudentTestIdAndQuestionId(Long studentTestId, Long questionId);
    Optional<Submission> findFirstByStudentTestIdAndQuestionIdOrderByCreatedAtDesc(Long studentTestId, Long questionId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT s.question.id FROM Submission s WHERE s.studentTest.student.id = :studentId AND s.status = 'ACCEPTED'")
    List<Long> findSolvedQuestionIdsByStudentId(@org.springframework.data.repository.query.Param("studentId") Long studentId);
}
