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
    void deleteByTestId(Long testId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(sa) FROM StudentAchievement sa WHERE sa.test.admin.id = :adminId")
    long countByAdminId(@org.springframework.data.repository.query.Param("adminId") Long adminId);
}
