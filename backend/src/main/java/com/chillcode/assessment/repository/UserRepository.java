package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    Optional<User> findByRegisterNumber(String registerNumber);
    Optional<User> findByEmail(String email);

    @org.springframework.data.jpa.repository.Query("SELECT u FROM User u WHERE u.registerNumber = :identifier OR u.username = :identifier OR u.email = :identifier")
    Optional<User> findByIdentifier(@org.springframework.data.repository.query.Param("identifier") String identifier);
    boolean existsByUsername(String username);
    boolean existsByRegisterNumber(String registerNumber);
    boolean existsByEmail(String email);
    java.util.List<User> findByRole(com.chillcode.assessment.entity.Role role);
    long countByRole(com.chillcode.assessment.entity.Role role);
}
