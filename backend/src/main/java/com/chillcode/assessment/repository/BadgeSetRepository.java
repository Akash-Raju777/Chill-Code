package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.BadgeSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BadgeSetRepository extends JpaRepository<BadgeSet, Long> {
    List<BadgeSet> findByTestId(Long testId);
    List<BadgeSet> findByTestCode(String testCode);
    List<BadgeSet> findByStatus(String status);
    Optional<BadgeSet> findByTestIdAndStatus(Long testId, String status);
}
