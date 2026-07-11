package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.StudentTest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentTestRepository extends JpaRepository<StudentTest, Long> {
    List<StudentTest> findByStudentId(Long studentId);
    List<StudentTest> findByTestId(Long testId);
    Optional<StudentTest> findByStudentIdAndTestId(Long studentId, Long testId);
    long countByStatus(String status);
}
