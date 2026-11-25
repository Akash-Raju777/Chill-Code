package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.SubjectRanking;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface SubjectRankingRepository extends JpaRepository<SubjectRanking, Long> {
    List<SubjectRanking> findBySubjectIdOrderByRankPositionAsc(Long subjectId);
    Optional<SubjectRanking> findBySubjectIdAndStudentId(Long subjectId, Long studentId);
    List<SubjectRanking> findByStudentId(Long studentId);

    @Query("SELECT sr FROM SubjectRanking sr JOIN FETCH sr.student JOIN FETCH sr.subject WHERE sr.subject.id = :subjectId ORDER BY sr.rankPosition ASC")
    List<SubjectRanking> findBySubjectIdWithStudentAndSubject(@Param("subjectId") Long subjectId);
}
