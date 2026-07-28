package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.LanguageMasterBadge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface LanguageMasterBadgeRepository extends JpaRepository<LanguageMasterBadge, Long> {
    List<LanguageMasterBadge> findByStudentIdOrderByAwardedDateDesc(Long studentId);
    Optional<LanguageMasterBadge> findByStudentIdAndTestIdAndBadgeName(Long studentId, Long testId, String badgeName);
}
