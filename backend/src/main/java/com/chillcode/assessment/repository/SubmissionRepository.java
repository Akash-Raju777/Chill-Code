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

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT CONCAT(s.studentTest.id, '_', s.question.id) FROM Submission s WHERE s.studentTest.student.id = :studentId AND s.status = 'ACCEPTED' AND (s.active IS NULL OR s.active = true)")
    List<String> findSolvedTestQuestionPairsByStudentId(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s LEFT JOIN FETCH s.question q LEFT JOIN FETCH q.subject LEFT JOIN FETCH s.studentTest st LEFT JOIN FETCH st.test WHERE st.student.id = :studentId ORDER BY s.createdAt DESC")
    List<Submission> findAllByStudentIdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s LEFT JOIN FETCH s.question q WHERE s.studentTest.student.id = :studentId ORDER BY s.createdAt DESC")
    List<Submission> findTop5ByStudentIdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("studentId") Long studentId, org.springframework.data.domain.Pageable pageable);
}
