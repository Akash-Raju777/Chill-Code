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

        // 2. Drop check constraint on status column if it exists to allow 'NO_SECURITY' status
        try (Connection conn = dataSource.getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute("ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_status_check");
            stmt.execute("ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check");
            System.out.println("[StartupValidator] Database constraint update: OK (Successfully dropped app_users_status_check & app_users_role_check if existed)");

            // Create work_assignments table if not exists
            stmt.execute("CREATE TABLE IF NOT EXISTS work_assignments (" +
                    "id BIGSERIAL PRIMARY KEY, " +
                    "title VARCHAR(200) NOT NULL, " +
                    "description TEXT, " +
                    "assigned_to_id BIGINT NOT NULL, " +
                    "assigned_by_id BIGINT NOT NULL, " +
                    "priority VARCHAR(20), " +
                    "start_date TIMESTAMP, " +
                    "due_date TIMESTAMP, " +
                    "status VARCHAR(30) NOT NULL, " +
                    "created_at TIMESTAMP NOT NULL, " +
                    "updated_at TIMESTAMP, " +
                    "CONSTRAINT fk_work_assigned_to FOREIGN KEY (assigned_to_id) REFERENCES app_users(id), " +
                    "CONSTRAINT fk_work_assigned_by FOREIGN KEY (assigned_by_id) REFERENCES app_users(id))");
            System.out.println("[StartupValidator] Database table check: OK (work_assignments table verified)");

            // Ensure assigned_staff_id exists on tests and subjects for explicit staff assignment
            stmt.execute("ALTER TABLE tests ADD COLUMN IF NOT EXISTS assigned_staff_id BIGINT");
            stmt.execute("ALTER TABLE subjects ADD COLUMN IF NOT EXISTS assigned_staff_id BIGINT");
            System.out.println("[StartupValidator] Database columns check: OK (tests.assigned_staff_id & subjects.assigned_staff_id verified)");
        } catch (Exception e) {
            System.err.println("[StartupValidator] Warning: Schema initialization check warning: " + e.getMessage());
        }

        // 3. Validate Default Seed Users existence
        boolean adminExists = userRepository.findByUsername("admin_demo").isPresent() || 
                             userRepository.findByRegisterNumber("admin_demo").isPresent() || 
                             userRepository.findByEmail("admin@chillcode.com").isPresent();
                             
        boolean studentExists = userRepository.findByUsername("student_demo").isPresent() || 
                               userRepository.findByRegisterNumber("student_demo").isPresent() || 
                               userRepository.findByEmail("student@chillcode.com").isPresent();

        boolean superAdminExists = userRepository.findByUsername("superadmin").isPresent() || 
                                  userRepository.findByEmail("superadmin@chillcode.com").isPresent();

        if (!superAdminExists) {
            try {
                com.chillcode.assessment.entity.User superAdmin = new com.chillcode.assessment.entity.User();
                superAdmin.setName("Super Administrator");
                superAdmin.setUsername("superadmin");
                superAdmin.setEmail("superadmin@chillcode.com");
                superAdmin.setPassword(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(4).encode("SuperAdmin@123"));
                superAdmin.setRole(com.chillcode.assessment.entity.Role.SUPER_ADMIN);
                superAdmin.setStatus(com.chillcode.assessment.entity.UserStatus.ACTIVE);
                superAdmin.setDepartment("System Administration");
                userRepository.save(superAdmin);
                System.out.println("[StartupValidator] Default Super Admin seeded successfully: superadmin / SuperAdmin@123");
            } catch (Exception e) {
                System.err.println("[StartupValidator] Warning: Could not seed Super Admin: " + e.getMessage());
            }
        }

        if (adminExists && studentExists) {
            System.out.println("[StartupValidator] Database seed data status: OK (Default seed users verified)");
        } else {
            System.err.println("[StartupValidator] Database seed data check FAILED: Default users are missing.");
        }
        
        System.out.println("=== Startup Diagnostics Complete ===");
    }
}
