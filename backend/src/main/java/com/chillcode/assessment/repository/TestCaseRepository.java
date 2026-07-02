package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByQuestionId(Long questionId);
    List<TestCase> findByQuestionIdAndIsHidden(Long questionId, Boolean isHidden);
}
