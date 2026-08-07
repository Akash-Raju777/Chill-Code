package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SubjectRepository extends JpaRepository<Subject, Long> {
    Optional<Subject> findByName(String name);
    boolean existsByName(String name);
    
    java.util.List<Subject> findByAdminId(Long adminId);
    Optional<Subject> findByIdAndAdminId(Long id, Long adminId);
    long countByAdminId(Long adminId);
    Optional<Subject> findByNameAndAdminId(String name, Long adminId);
    boolean existsByNameAndAdminId(String name, Long adminId);

    @org.springframework.data.jpa.repository.Query(value = 
        "SELECT s.id, s.name, s.color, " +
        "COUNT(DISTINCT q.id) AS total_count, " +
        "COUNT(DISTINCT CASE WHEN (sqs.status = 'COMPLETED' OR sub.question_id IS NOT NULL) THEN q.id END) AS completed_count " +
        "FROM subjects s " +
        "LEFT JOIN questions q ON q.subject_id = s.id " +
        "LEFT JOIN student_question_status sqs ON sqs.question_id = q.id AND sqs.student_id = :studentId " +
        "LEFT JOIN (" +
        "    SELECT DISTINCT sub_inner.question_id " +
        "    FROM submissions sub_inner " +
        "    JOIN student_tests st_inner ON sub_inner.student_test_id = st_inner.id " +
        "    WHERE st_inner.student_id = :studentId AND (sub_inner.status = 'ACCEPTED' OR sub_inner.overall_result = 'PASS')" +
        ") sub ON sub.question_id = q.id " +
        "GROUP BY s.id, s.name, s.color " +
        "ORDER BY s.id ASC", 
        nativeQuery = true)
    java.util.List<Object[]> getSubjectStatsForStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId);
}
