package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Warning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WarningRepository extends JpaRepository<Warning, Long> {
    List<Warning> findByStudentTestId(Long studentTestId);
    long countByStudentTestId(Long studentTestId);
    List<Warning> findTop5ByOrderByTimestampDesc();
    
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"studentTest", "studentTest.student"})
    List<Warning> findTop5ByStudentTest_Test_Admin_IdOrderByTimestampDesc(Long adminId);
}
