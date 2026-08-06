package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Test;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TestRepository extends JpaRepository<Test, Long> {
    List<Test> findBySubjectId(Long subjectId);

    boolean existsByTestCode(String testCode);

    java.util.Optional<Test> findByTestCode(String testCode);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Test t WHERE t.questions IS NOT EMPTY")
    long countAvailableTests();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Test t WHERE t.startTime < :now AND t.endTime > :now")
    long countActiveTests(@org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(t) FROM Test t WHERE t.questions IS NOT EMPTY AND t.startTime < :now AND t.endTime > :now")
    long countActiveAvailableTests(@org.springframework.data.repository.query.Param("now") java.time.LocalDateTime now);
}
