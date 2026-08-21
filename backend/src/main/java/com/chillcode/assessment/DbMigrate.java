package com.chillcode.assessment;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class DbMigrate implements CommandLineRunner {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        if (System.getenv("RUN_MIGRATION") != null) {
            try {
                jdbcTemplate.execute("ALTER TABLE submissions ADD COLUMN IF NOT EXISTS time_taken_seconds BIGINT;");
                System.out.println(">>> MIGRATION SUCCESSFUL: Added time_taken_seconds to submissions <<<");
            } catch (Exception e) {
                System.out.println(">>> MIGRATION FAILED: " + e.getMessage() + " <<<");
            }
            System.exit(0);
        }
    }
}
