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
    
    @org.springframework.data.jpa.repository.Query("SELECT w FROM Warning w WHERE w.studentTest.test.admin.id = :adminId ORDER BY w.timestamp DESC LIMIT 5")
    List<Warning> findTop5ByAdminIdOrderByTimestampDesc(@org.springframework.data.repository.query.Param("adminId") Long adminId);
}
