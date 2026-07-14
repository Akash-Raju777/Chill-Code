package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.TestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface TestCaseRepository extends JpaRepository<TestCase, Long> {
    List<TestCase> findByQuestionId(Long questionId);
    List<TestCase> findByQuestionIdAndIsHidden(Long questionId, Boolean isHidden);

    @org.springframework.data.jpa.repository.Query("SELECT tc FROM TestCase tc WHERE tc.question.subject.id = :subjectId")
    List<TestCase> findByQuestionSubjectId(@org.springframework.data.repository.query.Param("subjectId") Long subjectId);
}
