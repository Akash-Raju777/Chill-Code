package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.BadgeRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BadgeRuleRepository extends JpaRepository<BadgeRule, Long> {
    List<BadgeRule> findByBadgeId(Long badgeId);
    List<BadgeRule> findByStatus(String status);
    List<BadgeRule> findByCategoryAndStatus(String category, String status);
    List<BadgeRule> findByTargetLanguageAndStatus(String targetLanguage, String status);
    List<BadgeRule> findByTargetSubjectIdAndStatus(Long targetSubjectId, String status);
}
