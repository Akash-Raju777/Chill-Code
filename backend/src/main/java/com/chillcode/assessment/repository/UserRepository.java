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
    boolean existsByUsername(String username);
    boolean existsByRegisterNumber(String registerNumber);
    boolean existsByEmail(String email);
}
