package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Warning;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WarningRepository extends JpaRepository<Warning, Long> {
    List<Warning> findByStudentTestId(Long studentTestId);
    long countByStudentTestId(Long studentTestId);
}
