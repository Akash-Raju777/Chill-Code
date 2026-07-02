package com.chillcode.assessment.repository;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
public class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    public void testCreateAndFindUser() {
        // Given
        User student = User.builder()
                .name("Integration Test Student")
                .email("it_student@test.com")
                .registerNumber("it_reg_123")
                .password("password")
                .role(Role.STUDENT)
                .status(UserStatus.ACTIVE)
                .build();

        // When
        User savedStudent = userRepository.save(student);

        // Then
        assertThat(savedStudent.getId()).isNotNull();
        
        Optional<User> foundStudent = userRepository.findByRegisterNumber("it_reg_123");
        assertThat(foundStudent.isPresent()).isTrue();
        assertThat(foundStudent.get().getEmail()).isEqualTo("it_student@test.com");

        // Clean up
        userRepository.delete(savedStudent);
    }
}
