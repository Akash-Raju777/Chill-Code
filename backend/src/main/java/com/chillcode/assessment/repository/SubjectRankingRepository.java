package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.SubjectRanking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubjectRankingRepository extends JpaRepository<SubjectRanking, Long> {
    List<SubjectRanking> findBySubjectIdOrderByRankPositionAsc(Long subjectId);
    Optional<SubjectRanking> findBySubjectIdAndStudentId(Long subjectId, Long studentId);
    List<SubjectRanking> findByStudentId(Long studentId);
}
