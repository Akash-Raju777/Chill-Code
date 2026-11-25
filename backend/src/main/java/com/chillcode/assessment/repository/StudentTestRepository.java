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
    
    @Query("SELECT st FROM StudentTest st WHERE st.test.testCode = :testCode")
    List<StudentTest> findByTestCode(@org.springframework.data.repository.query.Param("testCode") String testCode);
    
    @Query("SELECT st FROM StudentTest st JOIN FETCH st.test t LEFT JOIN FETCH t.subject LEFT JOIN FETCH st.student WHERE st.id = :id")
    Optional<StudentTest> findByIdWithTestAndStudent(@org.springframework.data.repository.query.Param("id") Long id);

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.test t LEFT JOIN FETCH t.subject LEFT JOIN FETCH st.student WHERE st.student.id = :studentId AND st.test.id = :testId")
    Optional<StudentTest> findByStudentIdAndTestIdWithTestAndStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId, @org.springframework.data.repository.query.Param("testId") Long testId);

    @Query("SELECT DISTINCT st FROM StudentTest st JOIN FETCH st.test t LEFT JOIN FETCH t.subject LEFT JOIN FETCH t.admin LEFT JOIN FETCH st.student WHERE st.student.id IN :studentIds")
    List<StudentTest> findByStudentIdInWithTestAndStudent(@org.springframework.data.repository.query.Param("studentIds") java.util.Collection<Long> studentIds);

    Optional<StudentTest> findByStudentIdAndTestId(Long studentId, Long testId);
    boolean existsByStudentIdAndTestId(Long studentId, Long testId);
    long countByStatus(String status);

    // Eager-load student to avoid N+1 lazy loading in leaderboard
    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student WHERE st.status IN ('SUBMITTED', 'EVALUATED', 'COMPLETED')")
    List<StudentTest> findAllCompletedWithStudents();

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student WHERE st.status IN ('SUBMITTED', 'EVALUATED', 'COMPLETED') AND st.test.admin.id = :adminId")
    List<StudentTest> findAllCompletedWithStudentsByAdminId(@org.springframework.data.repository.query.Param("adminId") Long adminId);

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student JOIN FETCH st.test")
    List<StudentTest> findAllWithStudents();

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student JOIN FETCH st.test WHERE st.test.admin.id = :adminId")
    List<StudentTest> findAllWithStudentsByAdminId(@org.springframework.data.repository.query.Param("adminId") Long adminId);

    // Optimized Single-Pass Analytics Aggregate Query (avoids streaming thousands of entities over network)
    @Query(value = "SELECT " +
            "COUNT(*), " +
            "COUNT(CASE WHEN st.started_at IS NOT NULL OR UPPER(st.status) != 'ASSIGNED' THEN 1 END), " +
            "COUNT(CASE WHEN UPPER(st.pass_fail_status) = 'PASS' OR UPPER(st.status) = 'COMPLETED' THEN 1 END), " +
            "COUNT(DISTINCT CASE WHEN st.submitted_at >= :todayStart THEN st.student_id END) " +
            "FROM student_tests st " +
            "JOIN tests t ON st.test_id = t.id " +
            "WHERE t.admin_id = :adminId", nativeQuery = true)
    List<Object[]> getAdminAnalyticsSummary(
            @org.springframework.data.repository.query.Param("adminId") Long adminId,
            @org.springframework.data.repository.query.Param("todayStart") java.time.LocalDateTime todayStart);

    @Query("SELECT COUNT(st) FROM StudentTest st WHERE st.status = :status AND st.test.admin.id = :adminId")
    long countByStatusAndAdminId(@org.springframework.data.repository.query.Param("status") String status, @org.springframework.data.repository.query.Param("adminId") Long adminId);

    @Query("SELECT st.test.subject.id, COUNT(DISTINCT st.student.id) FROM StudentTest st WHERE st.status IN ('SUBMITTED', 'EVALUATED', 'COMPLETED') AND st.test.subject IS NOT NULL GROUP BY st.test.subject.id")
    List<Object[]> countAttendedStudentsGroupedBySubject();

    @org.springframework.transaction.annotation.Transactional(propagation = org.springframework.transaction.annotation.Propagation.REQUIRES_NEW)
    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query(value = 
        "INSERT INTO student_tests (student_id, test_id, admin_id, status, score, warnings_count, is_suspended) " +
        "SELECT :studentId, t.id, COALESCE(t.admin_id, (SELECT u.admin_id FROM app_users u WHERE u.id = :studentId)), 'ASSIGNED', 0, 0, false " +
        "FROM tests t " +
        "WHERE t.id IN (SELECT DISTINCT tq.test_id FROM test_questions tq) " +
        "AND t.id NOT IN (SELECT st.test_id FROM student_tests st WHERE st.student_id = :studentId)",
        nativeQuery = true)
    void assignMissingTestsForStudent(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.test t LEFT JOIN FETCH t.subject WHERE st.student.id = :studentId")
    List<StudentTest> findByStudentIdWithTestAndSubject(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @Query("SELECT DISTINCT st FROM StudentTest st JOIN FETCH st.test t LEFT JOIN FETCH t.questions q WHERE st.student.id = :studentId")
    List<StudentTest> findByStudentIdWithTestAndQuestions(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student JOIN FETCH st.test WHERE st.test.id IN :testIds")
    List<StudentTest> findByTestIdInWithStudentAndTest(@org.springframework.data.repository.query.Param("testIds") java.util.Collection<Long> testIds);

    @Query("SELECT st FROM StudentTest st JOIN FETCH st.student JOIN FETCH st.test t LEFT JOIN FETCH t.subject")
    List<StudentTest> findAllWithStudentsTestsAndSubjects();

    @Query("SELECT st.test.id, COUNT(st) FROM StudentTest st WHERE st.test IS NOT NULL GROUP BY st.test.id")
    List<Object[]> countStudentTestsGroupedByTestId();
}

