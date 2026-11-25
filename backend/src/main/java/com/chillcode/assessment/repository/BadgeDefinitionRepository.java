package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.BadgeDefinition;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface BadgeDefinitionRepository extends JpaRepository<BadgeDefinition, Long> {
    List<BadgeDefinition> findByBadgeSetIdOrderByRankPositionAsc(Long badgeSetId);
    List<BadgeDefinition> findByBadgeSetIdAndStatus(Long badgeSetId, String status);

    @org.springframework.data.jpa.repository.Query("SELECT bd.badgeSet.id, bd FROM BadgeDefinition bd WHERE bd.status = :status")
    List<Object[]> findByStatusWithBadgeSetId(@org.springframework.data.repository.query.Param("status") String status);
}
