package com.chillcode.assessment.config;

import com.chillcode.assessment.entity.Role;
import com.chillcode.assessment.entity.User;
import com.chillcode.assessment.entity.UserStatus;
import com.chillcode.assessment.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
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

    @Autowired
    private com.chillcode.assessment.repository.QuestionRepository questionRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestCaseRepository testCaseRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubmissionRepository submissionRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Autowired
    private com.chillcode.assessment.repository.BadgeRepository badgeRepository;

    @Autowired
    private com.chillcode.assessment.repository.BadgeRuleRepository badgeRuleRepository;

    @Override
    @Transactional
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

        // Seed default Language & Ranking Badges
        seedDefaultBadges();

        // Seed or update Demo Student to guarantee credentials (student_demo / 2024CS001 / password)
        User demoStudent = userRepository.findByEmail("student@chillcode.com")
                .orElseGet(() -> userRepository.findByUsername("student_demo")
                .orElseGet(() -> userRepository.findByRegisterNumber("2024CS001")
                .orElseGet(() -> userRepository.findByRegisterNumber("student_demo")
                .orElse(new User()))));

        demoStudent.setName("Demo Student");
        demoStudent.setEmail("student@chillcode.com");
        demoStudent.setRegisterNumber("2024CS001");
        demoStudent.setUsername("student_demo");
        demoStudent.setDepartment("CS");
        demoStudent.setRole(Role.STUDENT);
        demoStudent.setStatus(UserStatus.ACTIVE);
        demoStudent.setPassword(passwordEncoder.encode("password"));
        userRepository.save(demoStudent);
        System.out.println("Seeded and verified Demo Student (2024CS001 / student_demo) successfully.");

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

        // Seed Java questions if not exists
        com.chillcode.assessment.entity.Subject javaSubject = subjectRepository.findByName("Java Programming").orElse(null);
        if (javaSubject != null && questionRepository.findBySubjectId(javaSubject.getId()).isEmpty()) {
            com.chillcode.assessment.entity.Question q1 = com.chillcode.assessment.entity.Question.builder()
                .subject(javaSubject)
                .title("Two Sum")
                .difficulty(com.chillcode.assessment.entity.Difficulty.EASY)
                .problemStatement("Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.\nYou may assume that each input would have exactly one solution, and you may not use the same element twice.")
                .constraints("2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9\n-10^9 <= target <= 10^9")
                .inputFormat("First line contains array size, second line contains space-separated array integers, third line contains target integer.")
                .outputFormat("Print two space-separated indices of the numbers.")
                .allowedLanguages("java,python,cpp,javascript")
                .tags("Arrays,Hash Table")
                .build();
            q1 = questionRepository.save(q1);

            // Add test cases
            com.chillcode.assessment.entity.TestCase tc1 = com.chillcode.assessment.entity.TestCase.builder()
                .question(q1)
                .inputData("4\n2 7 11 15\n9")
                .expectedOutput("0 1")
                .isHidden(false)
                .build();
            testCaseRepository.save(tc1);

            com.chillcode.assessment.entity.TestCase tc2 = com.chillcode.assessment.entity.TestCase.builder()
                .question(q1)
                .inputData("3\n3 2 4\n6")
                .expectedOutput("1 2")
                .isHidden(true)
                .build();
            testCaseRepository.save(tc2);

            com.chillcode.assessment.entity.Question q2 = com.chillcode.assessment.entity.Question.builder()
                .subject(javaSubject)
                .title("Palindrome Check")
                .difficulty(com.chillcode.assessment.entity.Difficulty.EASY)
                .problemStatement("Given an integer x, return true if x is a palindrome, and false otherwise.")
                .constraints("-2^31 <= x <= 2^31 - 1")
                .inputFormat("A single integer x.")
                .outputFormat("Print 'true' if palindrome, 'false' otherwise.")
                .allowedLanguages("java,python,cpp,javascript")
                .tags("Math,Strings")
                .build();
            q2 = questionRepository.save(q2);

            com.chillcode.assessment.entity.TestCase tc3 = com.chillcode.assessment.entity.TestCase.builder()
                .question(q2)
                .inputData("121")
                .expectedOutput("true")
                .isHidden(false)
                .build();
            testCaseRepository.save(tc3);

            com.chillcode.assessment.entity.TestCase tc4 = com.chillcode.assessment.entity.TestCase.builder()
                .question(q2)
                .inputData("-121")
                .expectedOutput("false")
                .isHidden(true)
                .build();
            testCaseRepository.save(tc4);

            System.out.println("Seeded Java questions and test cases successfully.");
        }

        // Seed C questions if not exists
        com.chillcode.assessment.entity.Subject cSubject = subjectRepository.findByName("C Programming").orElse(null);
        if (cSubject != null && questionRepository.findBySubjectId(cSubject.getId()).isEmpty()) {
            com.chillcode.assessment.entity.Question q3 = com.chillcode.assessment.entity.Question.builder()
                .subject(cSubject)
                .title("Reverse a String")
                .difficulty(com.chillcode.assessment.entity.Difficulty.EASY)
                .problemStatement("Write a program to reverse a given string input.")
                .constraints("1 <= s.length <= 10000")
                .inputFormat("A single line string.")
                .outputFormat("Reversed string.")
                .allowedLanguages("c,cpp,java,python")
                .tags("Strings,Pointers")
                .build();
            q3 = questionRepository.save(q3);

            com.chillcode.assessment.entity.TestCase tc5 = com.chillcode.assessment.entity.TestCase.builder()
                .question(q3)
                .inputData("hello")
                .expectedOutput("olleh")
                .isHidden(false)
                .build();
            testCaseRepository.save(tc5);

            com.chillcode.assessment.entity.TestCase tc6 = com.chillcode.assessment.entity.TestCase.builder()
                .question(q3)
                .inputData("ChillCode")
                .expectedOutput("edoCllihC")
                .isHidden(true)
                .build();
            testCaseRepository.save(tc6);

            System.out.println("Seeded C questions and test cases successfully.");
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

            if (test != null) {
                if (test.getSecurityShieldEnabled() == null || !test.getSecurityShieldEnabled()) {
                    test.setSecurityShieldEnabled(true);
                    testRepository.save(test);
                }
            }

            if (test == null) {
                String prefix = subject.getName().replaceAll("[^a-zA-Z]", "").toUpperCase();
                if (prefix.length() > 6) prefix = prefix.substring(0, 6);
                String testCode = prefix + "-001";

                test = com.chillcode.assessment.entity.Test.builder()
                        .subject(subject)
                        .name(testName)
                        .testCode(testCode)
                        .durationMinutes(120)
                        .startTime(LocalDateTime.now().minusDays(1))
                        .endTime(LocalDateTime.now().plusYears(1))
                        .maxMarks(100)
                        .instructions("Write your solutions to the practice problems in the arena canvas.")
                        .shuffleQuestions(false)
                        .autoSubmit(true)
                        .negativeMarking(false)
                        .securityShieldEnabled(true)
                        .questions(new java.util.HashSet<>())
                        .build();
                test = testRepository.save(test);
                System.out.println("Seeded test: " + testName + " (" + testCode + ")");
            }

            // Link existing questions of this subject to this test
            java.util.List<com.chillcode.assessment.entity.Question> subjectQuestions = questionRepository.findBySubjectId(subject.getId());
            if (!subjectQuestions.isEmpty()) {
                test.getQuestions().addAll(subjectQuestions);
                testRepository.save(test);
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

        // Seed a sample solved submission for student_demo
        User studentDemo = userRepository.findByRegisterNumber("student_demo").orElse(null);
        if (studentDemo != null) {
            com.chillcode.assessment.entity.Subject javaSub = subjectRepository.findByName("Java Programming").orElse(null);
            if (javaSub != null) {
                com.chillcode.assessment.entity.Question qTwoSum = questionRepository.findBySubjectId(javaSub.getId()).stream()
                    .filter(q -> q.getTitle().equalsIgnoreCase("Two Sum"))
                    .findFirst().orElse(null);
                String testName = javaSub.getName() + " Practice Arena";
                com.chillcode.assessment.entity.Test javaTest = testRepository.findAll().stream()
                    .filter(t -> t.getName().equalsIgnoreCase(testName))
                    .findFirst().orElse(null);
                
                if (qTwoSum != null && javaTest != null) {
                    com.chillcode.assessment.entity.StudentTest st = studentTestRepository.findByStudentIdAndTestId(studentDemo.getId(), javaTest.getId()).orElse(null);
                    if (st != null && submissionRepository.findByStudentTestIdAndQuestionId(st.getId(), qTwoSum.getId()).isEmpty()) {
                        // Create accepted submission
                        com.chillcode.assessment.entity.Submission sub = com.chillcode.assessment.entity.Submission.builder()
                            .studentTest(st)
                            .question(qTwoSum)
                            .language("java")
                            .code("public class Solution {\n    public int[] twoSum(int[] nums, int target) {\n        return new int[]{0, 1};\n    }\n}")
                            .status("ACCEPTED")
                            .runTimeMs(15)
                            .memoryUsedKb(2048)
                            .score(100)
                            .passedTests(2)
                            .totalTests(2)
                            .active(true)
                            .createdAt(LocalDateTime.now().minusHours(2))
                            .build();
                        submissionRepository.save(sub);

                        // Seed student question status as COMPLETED
                        com.chillcode.assessment.entity.StudentQuestionStatus sqs = com.chillcode.assessment.entity.StudentQuestionStatus.builder()
                            .studentId(studentDemo.getId())
                            .questionId(qTwoSum.getId())
                            .status("COMPLETED")
                            .attemptCount(1)
                            .lastSubmissionId(sub.getId())
                            .completedAt(LocalDateTime.now().minusHours(2))
                            .lastAttemptAt(LocalDateTime.now().minusHours(2))
                            .build();
                        studentQuestionStatusRepository.save(sqs);

                        // Update StudentTest status to EVALUATED and score
                        st.setStatus("EVALUATED");
                        st.setScore(100);
                        st.setSubmittedAt(LocalDateTime.now().minusHours(2));
                        studentTestRepository.save(st);

                        System.out.println("Seeded sample accepted submission for Two Sum successfully.");
                    }
                }
            }
        }
    }

    private void seedDefaultBadges() {
        // 1. Java Expert
        createBadgeIfAbsent("Java Expert", "Demonstrated exceptional mastery in Java programming.", "Coffee", "LANGUAGE_MASTER", "LANGUAGE", "java", 1, 50.0, 1, null);
        // 2. Python Master
        createBadgeIfAbsent("Python Master", "Demonstrated high proficiency in Python syntax and algorithms.", "Terminal", "LANGUAGE_MASTER", "LANGUAGE", "python", 1, 50.0, 1, null);
        // 3. C Programmer
        createBadgeIfAbsent("C Programmer", "Mastered procedural C programming and memory management.", "Code2", "LANGUAGE_MASTER", "LANGUAGE", "c", 1, 50.0, 1, null);
        // 4. C++ Expert
        createBadgeIfAbsent("C++ Expert", "Demonstrated advanced C++ object-oriented and STL skills.", "Flame", "LANGUAGE_MASTER", "LANGUAGE", "cpp", 1, 50.0, 1, null);
        // 5. JavaScript Ninja
        createBadgeIfAbsent("JavaScript Ninja", "Demonstrated mastery of web scripting and JS logic.", "Globe", "LANGUAGE_MASTER", "LANGUAGE", "javascript", 1, 50.0, 1, null);

        // Subject Performance Badges
        createBadgeIfAbsent("🥇 Gold Medalist", "Awarded for achieving 1st Rank in a Subject Leaderboard.", "Award", "SUBJECT_RANKING", "SUBJECT", null, 0, 0.0, 0, 1);
        createBadgeIfAbsent("🥈 Silver Medalist", "Awarded for achieving 2nd Rank in a Subject Leaderboard.", "Award", "SUBJECT_RANKING", "SUBJECT", null, 0, 0.0, 0, 2);
        createBadgeIfAbsent("🥉 Bronze Medalist", "Awarded for achieving 3rd Rank in a Subject Leaderboard.", "Award", "SUBJECT_RANKING", "SUBJECT", null, 0, 0.0, 0, 3);
    }

    private void createBadgeIfAbsent(String name, String description, String icon, String type, String category, String lang, int minTests, double minScore, int minSolved, Integer rankPos) {
        if (badgeRepository.findByName(name).isEmpty()) {
            com.chillcode.assessment.entity.Badge badge = com.chillcode.assessment.entity.Badge.builder()
                    .name(name)
                    .description(description)
                    .icon(icon)
                    .type(type)
                    .status("ACTIVE")
                    .build();
            badge = badgeRepository.save(badge);

            com.chillcode.assessment.entity.BadgeRule rule = com.chillcode.assessment.entity.BadgeRule.builder()
                    .badge(badge)
                    .category(category)
                    .targetLanguage(lang)
                    .minAcceptedTests(minTests)
                    .minAvgScore(minScore)
                    .minProblemsSolved(minSolved)
                    .rankPosition(rankPos)
                    .status("ACTIVE")
                    .build();
            badgeRuleRepository.save(rule);

            System.out.println("Seeded default badge: " + name);
        }
    }
}
