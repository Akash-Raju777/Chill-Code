package com.chillcode.assessment.config;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import java.time.LocalDateTime;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private com.chillcode.assessment.repository.SubjectRepository subjectRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentTestRepository studentTestRepository;

    @Autowired
    private com.chillcode.assessment.repository.NotificationRepository notificationRepository;

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

        // Seed default Java Programming subject if not exists
        if (subjectRepository.findByName("Java Programming").isEmpty()) {
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

        // Seed default C Programming subject if not exists
        if (subjectRepository.findByName("C Programming").isEmpty()) {
            com.chillcode.assessment.entity.Subject cSubject = com.chillcode.assessment.entity.Subject.builder()
                .name("C Programming")
                .description("Procedural C programming, pointers, structures, and memory management.")
                .icon("Terminal")
                .color("#10B981")
                .status("ACTIVE")
                .build();
            subjectRepository.save(cSubject);
            System.out.println("Seeded default C Programming subject successfully.");
        }

        // Seed tests and assign to students
        java.util.List<com.chillcode.assessment.entity.Subject> subjects = subjectRepository.findAll();
        java.util.List<User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == Role.STUDENT)
                .collect(java.util.stream.Collectors.toList());

        for (com.chillcode.assessment.entity.Subject subject : subjects) {
            String testName = subject.getName() + " Practice Arena";
            com.chillcode.assessment.entity.Test test = testRepository.findAll().stream()
                    .filter(t -> t.getName().equalsIgnoreCase(testName))
                    .findFirst()
                    .orElse(null);

            if (test == null) {
                test = com.chillcode.assessment.entity.Test.builder()
                        .subject(subject)
                        .name(testName)
                        .durationMinutes(120)
                        .startTime(LocalDateTime.now().minusDays(1))
                        .endTime(LocalDateTime.now().plusYears(1))
                        .maxMarks(100)
                        .instructions("Write your solutions to the practice problems in the arena canvas.")
                        .shuffleQuestions(false)
                        .autoSubmit(true)
                        .negativeMarking(false)
                        .questions(new java.util.HashSet<>())
                        .build();
                test = testRepository.save(test);
                System.out.println("Seeded test: " + testName);
            }

            for (User student : students) {
                if (studentTestRepository.findByStudentIdAndTestId(student.getId(), test.getId()).isEmpty()) {
                    com.chillcode.assessment.entity.StudentTest st = com.chillcode.assessment.entity.StudentTest.builder()
                            .student(student)
                            .test(test)
                            .status("ASSIGNED")
                            .score(0)
                            .warningsCount(0)
                            .isSuspended(false)
                            .build();
                    studentTestRepository.save(st);

                    // Notify student
                    com.chillcode.assessment.entity.Notification notification = com.chillcode.assessment.entity.Notification.builder()
                            .user(student)
                            .title("New Test Assigned: " + test.getName())
                            .message("You have been assigned the practice block '" + test.getName() + "'.")
                            .type("TEST_ALERT")
                            .isRead(false)
                            .build();
                    notificationRepository.save(notification);
                }
            }
        }
    }
}
