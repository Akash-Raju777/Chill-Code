package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.StudentAchievement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentAchievementRepository extends JpaRepository<StudentAchievement, Long> {
    List<StudentAchievement> findByStudentIdOrderByAwardedAtDesc(Long studentId);
    List<StudentAchievement> findByStudentIdAndTestId(Long studentId, Long testId);
    Optional<StudentAchievement> findByStudentIdAndTestIdAndRankAchieved(Long studentId, Long testId, String rankAchieved);
    List<StudentAchievement> findByTestIdOrderByAwardedAtDesc(Long testId);
    List<StudentAchievement> findByTestCodeOrderByAwardedAtDesc(String testCode);
    void deleteByTestId(Long testId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(sa) FROM StudentAchievement sa WHERE sa.test.admin.id = :adminId")
    long countByAdminId(@org.springframework.data.repository.query.Param("adminId") Long adminId);

    @org.springframework.data.jpa.repository.Query("SELECT sa FROM StudentAchievement sa JOIN FETCH sa.test JOIN FETCH sa.student WHERE sa.test.id IN :testIds ORDER BY sa.awardedAt DESC")
    List<StudentAchievement> findByTestIdInWithTestOrderByAwardedAtDesc(@org.springframework.data.repository.query.Param("testIds") java.util.Collection<Long> testIds);

    @org.springframework.data.jpa.repository.Query("SELECT sa FROM StudentAchievement sa LEFT JOIN FETCH sa.student LEFT JOIN FETCH sa.test WHERE sa.student.id IN :studentIds")
    List<StudentAchievement> findByStudentIdInWithTest(@org.springframework.data.repository.query.Param("studentIds") java.util.Collection<Long> studentIds);

    @org.springframework.data.jpa.repository.Query("SELECT sa.student.id, t.id FROM StudentAchievement sa LEFT JOIN sa.test t")
    List<Object[]> findAllStudentAndTestIds();

    @org.springframework.data.jpa.repository.Query("SELECT sa FROM StudentAchievement sa LEFT JOIN FETCH sa.student")
    List<StudentAchievement> findAllWithStudent();
}
