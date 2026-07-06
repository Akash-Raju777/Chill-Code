package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.StudentQuestionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository
public interface StudentQuestionStatusRepository extends JpaRepository<StudentQuestionStatus, Long> {
    Optional<StudentQuestionStatus> findByStudentIdAndQuestionId(Long studentId, Long questionId);
    List<StudentQuestionStatus> findByStudentId(Long studentId);
    List<StudentQuestionStatus> findByStudentIdAndStatus(Long studentId, String status);
    List<StudentQuestionStatus> findByQuestionId(Long questionId);
}
