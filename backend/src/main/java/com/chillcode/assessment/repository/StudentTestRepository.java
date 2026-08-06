package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.StudentTest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentTestRepository extends JpaRepository<StudentTest, Long> {
    List<StudentTest> findByStudentId(Long studentId);
    List<StudentTest> findByTestId(Long testId);
    Optional<StudentTest> findByStudentIdAndTestId(Long studentId, Long testId);
    boolean existsByStudentIdAndTestId(Long studentId, Long testId);
    long countByStatus(String status);

    // Eager-load student to avoid N+1 lazy loading in leaderboard
    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student WHERE st.status IN ('SUBMITTED', 'EVALUATED', 'COMPLETED')")
    List<StudentTest> findAllCompletedWithStudents();

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student JOIN FETCH st.test")
    List<StudentTest> findAllWithStudents();

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = 
        "INSERT INTO student_tests (student_id, test_id, status, score, warnings_count, is_suspended) " +
        "SELECT :studentId, t.id, 'ASSIGNED', 0, 0, false " +
        "FROM tests t " +
        "WHERE t.id IN (SELECT DISTINCT tq.test_id FROM test_questions tq) " +
        "AND t.id NOT IN (SELECT st.test_id FROM student_tests st WHERE st.student_id = :studentId)",
        nativeQuery = true)
    void assignMissingTestsForStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @Query("SELECT DISTINCT st FROM StudentTest st JOIN FETCH st.test t LEFT JOIN FETCH t.questions q WHERE st.student.id = :studentId")
    List<StudentTest> findByStudentIdWithTestAndQuestions(@org.springframework.data.repository.query.Param("studentId") Long studentId);
}

