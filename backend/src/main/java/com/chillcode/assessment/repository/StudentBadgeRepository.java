package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.StudentBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface StudentBadgeRepository extends JpaRepository<StudentBadge, Long> {
    List<StudentBadge> findByStudentId(Long studentId);
    Optional<StudentBadge> findByStudentIdAndBadgeId(Long studentId, Long badgeId);
    List<StudentBadge> findByBadgeId(Long badgeId);
    void deleteByStudentIdAndBadgeId(Long studentId, Long badgeId);

    @org.springframework.data.jpa.repository.Query("SELECT sb FROM StudentBadge sb JOIN FETCH sb.badge WHERE sb.student.id = :studentId")
    List<StudentBadge> findByStudentIdWithBadge(@org.springframework.data.repository.query.Param("studentId") Long studentId);

    @org.springframework.data.jpa.repository.Query("SELECT sb FROM StudentBadge sb JOIN FETCH sb.badge JOIN FETCH sb.student WHERE sb.sourceTest.id IN :testIds")
    List<StudentBadge> findBySourceTestIdInWithBadge(@org.springframework.data.repository.query.Param("testIds") java.util.Collection<Long> testIds);

    @org.springframework.data.jpa.repository.Query("SELECT sb.student.id, t.id FROM StudentBadge sb LEFT JOIN sb.sourceTest t")
    List<Object[]> findAllStudentAndSourceTestIds();

    @org.springframework.data.jpa.repository.Query("SELECT sb FROM StudentBadge sb LEFT JOIN FETCH sb.student LEFT JOIN FETCH sb.sourceTest st LEFT JOIN FETCH st.subject WHERE sb.student.id IN :studentIds")
    List<StudentBadge> findByStudentIdInWithSourceTestAndSubject(@org.springframework.data.repository.query.Param("studentIds") java.util.Collection<Long> studentIds);

    @org.springframework.data.jpa.repository.Query("SELECT sb.badge.id, COUNT(sb) FROM StudentBadge sb GROUP BY sb.badge.id")
    List<Object[]> countBadgesGroupedByBadgeId();

    @org.springframework.data.jpa.repository.Query("SELECT sb.student.id, COUNT(sb) FROM StudentBadge sb GROUP BY sb.student.id")
    List<Object[]> countBadgesGroupedByStudentId();

    @org.springframework.data.jpa.repository.Query("SELECT sb FROM StudentBadge sb JOIN FETCH sb.student JOIN FETCH sb.badge LEFT JOIN FETCH sb.sourceTest st LEFT JOIN FETCH st.subject")
    List<StudentBadge> findAllWithStudentBadgeAndSubject();
}
