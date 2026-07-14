package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Subject;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface SubjectRepository extends JpaRepository<Subject, Long> {
    Optional<Subject> findByName(String name);
    boolean existsByName(String name);

    @org.springframework.data.jpa.repository.Query(value = 
        "SELECT s.id, s.name, s.color, " +
        "COUNT(q.id) AS total_count, " +
        "COALESCE(SUM(CASE WHEN sqs.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) AS completed_count " +
        "FROM subjects s " +
        "JOIN questions q ON q.subject_id = s.id " +
        "LEFT JOIN student_question_status sqs ON sqs.question_id = q.id AND sqs.student_id = :studentId " +
        "GROUP BY s.id, s.name, s.color", 
        nativeQuery = true)
    java.util.List<Object[]> getSubjectStatsForStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId);
}
