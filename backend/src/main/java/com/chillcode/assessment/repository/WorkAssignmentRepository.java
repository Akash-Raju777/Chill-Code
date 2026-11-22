package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.WorkAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface WorkAssignmentRepository extends JpaRepository<WorkAssignment, Long> {
    List<WorkAssignment> findByAssignedToId(Long assignedToId);
    List<WorkAssignment> findByAssignedById(Long assignedById);
    List<WorkAssignment> findByStatus(String status);
    List<WorkAssignment> findByAssignedToIdAndStatus(Long assignedToId, String status);
}
