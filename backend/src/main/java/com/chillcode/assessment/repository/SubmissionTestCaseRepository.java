package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.SubmissionTestCase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SubmissionTestCaseRepository extends JpaRepository<SubmissionTestCase, Long> {
    List<SubmissionTestCase> findBySubmissionId(Long submissionId);
}
