package com.chillcode.assessment.config;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.chillcode.assessment.repository.SubjectRepository subjectRepository;

    @Override
    public void run(String... args) throws Exception {
        // Seed admin_demo if it doesn't exist
        if (userRepository.findByUsername("admin_demo").isEmpty() && userRepository.findByEmail("admin@chillcode.com").isEmpty()) {
            User admin = User.builder()
                .username("admin_demo")
                .name("Demo Admin")
                .email("admin@chillcode.com")
                .password(passwordEncoder.encode("password"))
                .role(Role.ADMIN)
                .status(UserStatus.ACTIVE)
                .build();
            userRepository.save(admin);
            System.out.println("Seeded Demo Admin successfully.");
        }

        // Seed student_demo if it doesn't exist
        if (userRepository.findByRegisterNumber("student_demo").isEmpty() && userRepository.findByEmail("student@chillcode.com").isEmpty()) {
            User student = User.builder()
                .registerNumber("student_demo")
                .name("Demo Student")
                .email("student@chillcode.com")
                .password(passwordEncoder.encode("password"))
                .role(Role.STUDENT)
                .status(UserStatus.ACTIVE)
                .build();
            userRepository.save(student);
            System.out.println("Seeded Demo Student successfully.");
        }

        // Seed default subject if none exist
        if (subjectRepository.count() == 0) {
            com.chillcode.assessment.entity.Subject javaSubject = com.chillcode.assessment.entity.Subject.builder()
                .name("Java Programming")
                .description("Core Java programming concepts, collections, and algorithms.")
                .icon("Code2")
                .color("#3B82F6")
                .status("ACTIVE")
                .build();
            subjectRepository.save(javaSubject);
            System.out.println("Seeded default Java Programming subject successfully.");
        }
    }
}
