package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Badge;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BadgeRepository extends JpaRepository<Badge, Long> {
    List<Badge> findByStatus(String status);
    Optional<Badge> findByName(String name);
    List<Badge> findByType(String type);

    List<Badge> findByAdminId(Long adminId);
    List<Badge> findByStatusAndAdminId(String status, Long adminId);
    Optional<Badge> findByNameAndAdminId(String name, Long adminId);
}
