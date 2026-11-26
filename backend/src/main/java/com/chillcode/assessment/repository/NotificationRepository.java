package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<Notification> findTop50ByUserIdOrderByCreatedAtDesc(Long userId);
    List<Notification> findByUserIdAndIsReadOrderByCreatedAtDesc(Long userId, Boolean isRead);
    List<Notification> findByUserIdAndTypeOrderByCreatedAtDesc(Long userId, String type);

    @Query("SELECT n FROM Notification n LEFT JOIN FETCH n.user LEFT JOIN FETCH n.admin WHERE n.type IN :types ORDER BY n.createdAt DESC")
    List<Notification> findInstructionsWithUsers(@Param("types") List<String> types);
}
