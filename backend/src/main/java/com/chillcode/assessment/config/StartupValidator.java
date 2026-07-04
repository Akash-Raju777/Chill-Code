package com.chillcode.assessment.config;

import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

@Component
public class StartupValidator implements ApplicationRunner {

    @Autowired
    private DataSource dataSource;

    @Autowired
    private UserRepository userRepository;

    @Override
    public void run(ApplicationArguments args) throws Exception {
        System.out.println("=== Starting Startup Diagnostics ===");
        
        // 1. Validate Database Health Connection
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT 1")) {
            if (rs.next()) {
                System.out.println("[StartupValidator] Database connectivity: OK (Successfully executed SELECT 1)");
            }
        } catch (Exception e) {
            System.err.println("[StartupValidator] Database connection FAILED: " + e.getMessage());
            throw new RuntimeException("Startup halted: Database connection is unavailable.");
        }

        // 2. Validate Default Seed Users existence
        boolean adminExists = userRepository.findByUsername("admin_demo").isPresent() || 
                             userRepository.findByRegisterNumber("admin_demo").isPresent() || 
                             userRepository.findByEmail("admin@chillcode.com").isPresent();
                             
        boolean studentExists = userRepository.findByUsername("student_demo").isPresent() || 
                               userRepository.findByRegisterNumber("student_demo").isPresent() || 
                               userRepository.findByEmail("student@chillcode.com").isPresent();

        if (adminExists && studentExists) {
            System.out.println("[StartupValidator] Database seed data status: OK (Default seed users verified)");
        } else {
            System.err.println("[StartupValidator] Database seed data check FAILED: Default users are missing.");
        }
        
        System.out.println("=== Startup Diagnostics Complete ===");
    }
}
