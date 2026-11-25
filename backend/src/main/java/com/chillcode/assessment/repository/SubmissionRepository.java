package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Submission;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    List<Submission> findByStudentTestId(Long studentTestId);
    List<Submission> findByStudentTestIdAndQuestionId(Long studentTestId, Long questionId);
    Optional<Submission> findFirstByStudentTestIdAndQuestionIdOrderByCreatedAtDesc(Long studentTestId, Long questionId);

    @Modifying(clearAutomatically = true)
    @Query("UPDATE Submission s SET s.active = false WHERE s.studentTest.id = :studentTestId AND s.question.id = :questionId")
    void deactivatePreviousSubmissions(@Param("studentTestId") Long studentTestId, @Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s WHERE s.studentTest.student.id = :studentId AND s.question.id = :questionId ORDER BY s.createdAt DESC")
    List<Submission> findByStudentIdAndQuestionIdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("studentId") Long studentId, @org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM Submission s WHERE s.studentTest.student.id = :studentId AND s.question.id = :questionId")
    long countByStudentIdAndQuestionId(@org.springframework.data.repository.query.Param("studentId") Long studentId, @org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Query("SELECT s.question.id, COUNT(s.id) FROM Submission s WHERE s.studentTest.student.id = :studentId GROUP BY s.question.id")
    List<Object[]> countSubmissionsGroupedByQuestionForStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT CONCAT(s.studentTest.id, '_', s.question.id) FROM Submission s WHERE s.studentTest.student.id = :studentId AND (s.status = 'ACCEPTED' OR s.overallResult = 'PASS') AND (s.active IS NULL OR s.active = true)")
    List<String> findSolvedTestQuestionPairsByStudentId(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s LEFT JOIN FETCH s.question q LEFT JOIN FETCH q.subject LEFT JOIN FETCH s.studentTest st LEFT JOIN FETCH st.test WHERE st.student.id = :studentId ORDER BY s.createdAt DESC")
    List<Submission> findAllByStudentIdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    /**
     * Lightweight projection for building per-question summary maps.
     * Avoids hydrating full Submission entities (code/stdout/stderr TEXT columns
     * + 4 JOIN FETCHes) when callers only need score/overallResult/status.
     */
    @org.springframework.data.jpa.repository.Query("SELECT s.question.id, s.score, s.overallResult, s.active, s.status, s.createdAt FROM Submission s WHERE s.question IS NOT NULL AND s.studentTest.student.id = :studentId ORDER BY s.createdAt DESC")
    java.util.List<Object[]> findSubmissionSummariesForStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    /**
     * Subject-scoped submissions with all associations used by ranking
     * aggregation pre-fetched. Replaces submissionRepository.findAll() +
     * in-memory subject filtering (which loaded every submission in the DB).
     */
    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s JOIN FETCH s.question q JOIN FETCH q.subject subj JOIN FETCH s.studentTest st JOIN FETCH st.student WHERE subj.id = :subjectId AND ((s.score IS NOT NULL AND s.score > 0) OR UPPER(s.status) = 'ACCEPTED')")
    java.util.List<Submission> findAllBySubjectIdWithGraph(@org.springframework.data.repository.query.Param("subjectId") Long subjectId);

    // Check if an active EXITED submission already exists for this student+question (within last N seconds) for idempotency
    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM Submission s WHERE s.studentTest.student.id = :studentId AND s.question.id = :questionId AND s.status = 'EXITED' AND (s.active IS NULL OR s.active = true) AND s.createdAt >= :since")
    long countRecentExitedByStudentAndQuestion(@org.springframework.data.repository.query.Param("studentId") Long studentId, @org.springframework.data.repository.query.Param("questionId") Long questionId, @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s LEFT JOIN FETCH s.question q WHERE s.studentTest.student.id = :studentId ORDER BY s.createdAt DESC")
    List<Submission> findTop5ByStudentIdOrderByCreatedAtDesc(@org.springframework.data.repository.query.Param("studentId") Long studentId, org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT s.question.id FROM Submission s WHERE s.studentTest.student.id = :studentId AND (s.status = 'ACCEPTED' OR s.overallResult = 'PASS') AND (s.active IS NULL OR s.active = true)")
    List<Long> findSolvedQuestionIdsByStudentId(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @org.springframework.data.jpa.repository.Query("SELECT s FROM Submission s LEFT JOIN FETCH s.question q LEFT JOIN FETCH s.studentTest st LEFT JOIN FETCH st.student suser LEFT JOIN FETCH st.test t WHERE q.id IN :questionIds ORDER BY s.createdAt DESC")
    List<Submission> findByQuestionIdInWithQuestionAndTest(@org.springframework.data.repository.query.Param("questionIds") java.util.Collection<Long> questionIds);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM Submission s WHERE LOWER(s.language) = LOWER(:lang)")
    long countSubmissionsByLanguage(@org.springframework.data.repository.query.Param("lang") String lang);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM Submission s JOIN s.studentTest st JOIN st.test t WHERE LOWER(s.language) = LOWER(:lang) AND t.admin.id = :adminId")
    long countSubmissionsByLanguageAndAdminId(@org.springframework.data.repository.query.Param("lang") String lang, @org.springframework.data.repository.query.Param("adminId") Long adminId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM Submission s WHERE LOWER(s.language) = LOWER(:lang) AND s.status = 'ACCEPTED'")
    long countAcceptedSubmissionsByLanguage(@org.springframework.data.repository.query.Param("lang") String lang);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(s) FROM Submission s JOIN s.studentTest st JOIN st.test t WHERE LOWER(s.language) = LOWER(:lang) AND s.status = 'ACCEPTED' AND t.admin.id = :adminId")
    long countAcceptedSubmissionsByLanguageAndAdminId(@org.springframework.data.repository.query.Param("lang") String lang, @org.springframework.data.repository.query.Param("adminId") Long adminId);

    @org.springframework.data.jpa.repository.Query("SELECT LOWER(s.language), COUNT(s) FROM Submission s JOIN s.studentTest st JOIN st.test t WHERE t.admin.id = :adminId GROUP BY LOWER(s.language)")
    List<Object[]> countSubmissionsGroupedByLanguageAndAdminId(@org.springframework.data.repository.query.Param("adminId") Long adminId);

    @org.springframework.data.jpa.repository.Query("SELECT LOWER(s.language), COUNT(s) FROM Submission s JOIN s.studentTest st JOIN st.test t WHERE s.status = 'ACCEPTED' AND t.admin.id = :adminId GROUP BY LOWER(s.language)")
    List<Object[]> countAcceptedSubmissionsGroupedByLanguageAndAdminId(@org.springframework.data.repository.query.Param("adminId") Long adminId);
}
