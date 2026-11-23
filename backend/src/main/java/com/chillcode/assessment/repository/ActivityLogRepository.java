package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ActivityLogRepository extends JpaRepository<ActivityLog, Long> {
    List<ActivityLog> findByUserIdOrderByTimestampDesc(Long userId);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT al.details FROM ActivityLog al WHERE UPPER(al.action) LIKE '%DELETE_TEST%' AND al.details IS NOT NULL")
    java.util.Set<String> findDeletedTestNames();
}
