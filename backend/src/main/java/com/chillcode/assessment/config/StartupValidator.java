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

        // 3. Print compiler versions
        System.out.println("=== Compiler / Interpreter Versions ===");
        printCmdVersion(new String[]{"java", "-version"}, "java");
        printCmdVersion(new String[]{"javac", "-version"}, "javac");
        printCmdVersion(new String[]{"python", "--version"}, "python");
        
        // C/C++ MinGW checks
        String isWindows = System.getProperty("os.name").toLowerCase().contains("win") ? "true" : "false";
        String gccPath = "gcc";
        String gppPath = "g++";
        if ("true".equals(isWindows)) {
            java.io.File localGcc = new java.io.File("C:\\mingw64\\bin\\gcc.exe");
            if (localGcc.exists()) gccPath = localGcc.getAbsolutePath();
            java.io.File localGpp = new java.io.File("C:\\mingw64\\bin\\g++.exe");
            if (localGpp.exists()) gppPath = localGpp.getAbsolutePath();
        }
        printCmdVersion(new String[]{gccPath, "--version"}, "gcc");
        printCmdVersion(new String[]{gppPath, "--version"}, "g++");
        printCmdVersion(new String[]{"node", "--version"}, "node");
        System.out.println("========================================");
        
        System.out.println("=== Startup Diagnostics Complete ===");
    }

    private void printCmdVersion(String[] cmd, String name) {
        try {
            Process p = new ProcessBuilder(cmd).start();
            // Some commands output version to stderr, some to stdout
            java.io.BufferedReader r1 = new java.io.BufferedReader(new java.io.InputStreamReader(p.getInputStream()));
            java.io.BufferedReader r2 = new java.io.BufferedReader(new java.io.InputStreamReader(p.getErrorStream()));
            String line = r1.readLine();
            if (line == null) {
                line = r2.readLine();
            }
            if (line != null) {
                System.out.println("[StartupValidator] " + name + ": " + line.trim());
            } else {
                System.out.println("[StartupValidator] " + name + ": Unknown/Failed to read version");
            }
        } catch (Exception e) {
            System.err.println("[StartupValidator] " + name + " is NOT configured or missing: " + e.getMessage());
        }
    }
}
