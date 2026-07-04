package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.SubmissionTestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SubmissionTestCaseRepository extends JpaRepository<SubmissionTestCase, Long> {
    List<SubmissionTestCase> findBySubmissionId(Long submissionId);

    @Modifying
    @Query("delete from SubmissionTestCase s where s.testCase.id = :testCaseId")
    void deleteByTestCaseId(@Param("testCaseId") Long testCaseId);
}
