package com.chillcode.assessment.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "subjects", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"admin_id", "name"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Subject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "admin_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User admin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assigned_staff_id")
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User assignedStaff;

    public User getEffectiveStaff() {
        return assignedStaff != null ? assignedStaff : admin;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("assignedStaffId")
    public Long getAssignedStaffId() {
        User s = getEffectiveStaff();
        return s != null ? s.getId() : null;
    }

    @com.fasterxml.jackson.annotation.JsonProperty("assignedStaffName")
    public String getAssignedStaffName() {
        User s = getEffectiveStaff();
        return s != null ? s.getName() : null;
    }

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(length = 50)
    private String icon = "BookOpen";

    @Column(length = 50)
    private String color = "#3B82F6";

    @Column(length = 20)
    private String status = "ACTIVE";

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
