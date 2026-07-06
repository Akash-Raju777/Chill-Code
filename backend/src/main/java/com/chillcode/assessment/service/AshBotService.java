package com.chillcode.assessment.service;

import com.chillcode.assessment.entity.*;
import com.chillcode.assessment.repository.*;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;

@Service
public class AshBotService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private QuestionRepository questionRepository;

    @Autowired
    private StudentTestRepository studentTestRepository;

    @Autowired
    private SubmissionRepository submissionRepository;

    @Value("${xai.api.key}")
    private String xaiApiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private final ObjectMapper mapper = new ObjectMapper();

    public String askAsh(String userQuery) {
        if (xaiApiKey == null || xaiApiKey.trim().isBlank() || 
            "sbp_grok_token_placeholder".equals(xaiApiKey.trim()) ||
            "gsk_placeholder_key".equals(xaiApiKey.trim())) {
            return getMockAshResponse(userQuery);
        }
        try {
            // 1. Compile the database state context dynamically
            String dbContext = compileDatabaseStateContext();

            // 2. Build system message
            String systemInstructions = 
                    "You are Ash, an AI assistant bot for administrators on the Chill-Code online assessment coding platform.\n" +
                    "You help admins analyze and understand the state of the platform, including students lists, programming subjects, assessment questions, student test attempt scores, warnings, and code submission verdicts.\n" +
                    "Use the provided dynamic database state context to answer the admin's query accurately.\n" +
                    "Be concise, professional, and friendly. When presenting lists of students or tables of statistics, format them using markdown tables or bullet points for readability. If the admin asks for names or roll numbers of students (e.g. failed students in java), make sure you check the test scores or submission verdicts in the context and output them clearly. Never offer programming advice or reveal code templates unless explicitly asked. Always refer to yourself as Ash.";

            String prompt = String.format("%s\n\nAdmin Query: %s", dbContext, userQuery);

            // 3. Prepare the Groq API request map
            Map<String, Object> requestMap = new HashMap<>();
            requestMap.put("model", "llama-3.3-70b-versatile");
            
            List<Map<String, String>> messages = new ArrayList<>();
            
            Map<String, String> systemMsg = new HashMap<>();
            
            systemMsg.put("role", "system");
            systemMsg.put("content", systemInstructions);
            messages.add(systemMsg);
            
            Map<String, String> userMsg = new HashMap<>();
            userMsg.put("role", "user");
            userMsg.put("content", prompt);
            messages.add(userMsg);
            
            requestMap.put("messages", messages);
            requestMap.put("temperature", 0.3);

            String requestBody = mapper.writeValueAsString(requestMap);

            HttpRequest httpRequest = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + xaiApiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                System.err.println("Primary Grok request failed with status: " + response.statusCode() + ", Body: " + response.body());
                // Fallback to llama-3.1-8b-instant
                requestMap.put("model", "llama-3.1-8b-instant");
                requestBody = mapper.writeValueAsString(requestMap);
                httpRequest = HttpRequest.newBuilder()
                        .uri(URI.create("https://api.groq.com/openai/v1/chat/completions"))
                        .header("Content-Type", "application/json")
                        .header("Authorization", "Bearer " + xaiApiKey)
                        .POST(HttpRequest.BodyPublishers.ofString(requestBody, StandardCharsets.UTF_8))
                        .build();
                response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
            }

            if (response.statusCode() == 200) {
                JsonNode rootNode = mapper.readTree(response.body());
                JsonNode contentNode = rootNode.path("choices").path(0).path("message").path("content");
                if (!contentNode.isMissingNode()) {
                    return contentNode.asText();
                }
            } else {
                System.err.println("Grok AI API request failed with status: " + response.statusCode() + ", Body: " + response.body());
            }

        } catch (Exception e) {
            System.err.println("Error calling Grok AI in AshBotService: " + e.getMessage());
        }

        // Graceful fallback to mock response engine instead of displaying a connection failure error
        return getMockAshResponse(userQuery);
    }

    private String compileDatabaseStateContext() {
        StringBuilder sb = new StringBuilder();
        
        sb.append("System Data Context:\n\n");
        
        // 1. Subjects and Questions
        sb.append("=== SUBJECTS AND QUESTIONS ===\n");
        List<Subject> subjects = subjectRepository.findAll();
        for (Subject sub : subjects) {
            sb.append(String.format("Subject Name: %s (ID: %d)\n", sub.getName(), sub.getId()));
            List<Question> questions = questionRepository.findBySubjectId(sub.getId());
            for (Question q : questions) {
                sb.append(String.format("  - Question ID: %d, Title: %s, Difficulty: %s\n", 
                        q.getId(), q.getTitle(), q.getDifficulty()));
            }
        }
        sb.append("\n");

        // 2. Students List
        sb.append("=== STUDENTS LIST ===\n");
        List<User> students = userRepository.findByRole(Role.STUDENT);
        for (User student : students) {
            sb.append(String.format("Name: %s, Roll/Register No: %s, Email: %s, Department: %s, Status: %s\n",
                    student.getName(), student.getRegisterNumber(), student.getEmail(), student.getDepartment(), student.getStatus()));
        }
        sb.append("\n");

        // 3. Student Tests and Submissions
        sb.append("=== STUDENT TEST ATTEMPTS & SUBMISSIONS ===\n");
        List<StudentTest> studentTests = studentTestRepository.findAll();
        for (StudentTest st : studentTests) {
            User student = st.getStudent();
            Test test = st.getTest();
            sb.append(String.format("Student: %s (Roll: %s) took Test: %s, Score: %d, Status: %s\n",
                    student.getName(), student.getRegisterNumber(), test.getName(), st.getScore(), st.getStatus()));
            
            List<Submission> submissions = submissionRepository.findByStudentTestId(st.getId());
            for (Submission sub : submissions) {
                sb.append(String.format("  - Question: %s, Language: %s, Status: %s, Score: %d, Time: %d ms, Memory: %d kb\n",
                        sub.getQuestion().getTitle(), sub.getLanguage(), sub.getStatus(), sub.getScore(), sub.getRunTimeMs(), sub.getMemoryUsedKb()));
            }
        }
        
        return sb.toString();
    }

    private String getMockAshResponse(String userQuery) {
        String query = userQuery.toLowerCase().trim();

        // 1. Check for specific student query (e.g. "IS 24btad007 in student list" or "find Akash" or "is student_demo in list")
        List<User> students = userRepository.findByRole(Role.STUDENT);
        for (User student : students) {
            String regNum = student.getRegisterNumber() != null ? student.getRegisterNumber().toLowerCase() : "";
            String name = student.getName() != null ? student.getName().toLowerCase() : "";
            String username = student.getUsername() != null ? student.getUsername().toLowerCase() : "";
            
            if ((!regNum.isEmpty() && query.contains(regNum)) || 
                (!name.isEmpty() && query.contains(name)) || 
                (!username.isEmpty() && query.contains(username))) {
                
                // Found a matching student!
                return String.format("### Student Record Found\n\n" +
                        "- **Student Name:** %s\n" +
                        "- **Register/Roll Number:** %s\n" +
                        "- **Username:** %s\n" +
                        "- **Email:** %s\n" +
                        "- **Department:** %s\n" +
                        "- **Account Status:** %s\n" +
                        "\n" +
                        "Yes, **%s** is currently present in the student database list.",
                        student.getName(),
                        student.getRegisterNumber() != null ? student.getRegisterNumber() : "N/A",
                        student.getUsername(),
                        student.getEmail() != null ? student.getEmail() : "N/A",
                        student.getDepartment() != null ? student.getDepartment() : "N/A",
                        student.getStatus() != null ? student.getStatus().toString() : "ACTIVE",
                        student.getName());
            }
        }

        // 2. "Who failed in Java?"
        if (query.contains("fail") && (query.contains("java") || query.contains("programming"))) {
            List<StudentTest> attempts = studentTestRepository.findAll();
            StringBuilder sb = new StringBuilder();
            sb.append("### Java Test - Failed Students Summary\n\n");
            sb.append("| Roll Number | Student Name | Score | Status |\n");
            sb.append("|---|---|---|---|\n");
            
            boolean found = false;
            for (StudentTest st : attempts) {
                if (st.getTest().getName().toLowerCase().contains("java")) {
                    if (st.getScore() == null || st.getScore() < 50) {
                        sb.append(String.format("| %s | %s | %d | %s |\n", 
                            st.getStudent().getRegisterNumber() != null ? st.getStudent().getRegisterNumber() : "N/A", 
                            st.getStudent().getName(), 
                            st.getScore() != null ? st.getScore() : 0, 
                            st.getStatus() != null ? st.getStatus() : "ASSIGNED"));
                        found = true;
                    }
                }
            }
            if (!found) {
                return "No students have failed the Java Programming test.";
            }
            return sb.toString();
        }

        // 3. "highest score" / "top scorer"
        if (query.contains("highest") || query.contains("top scorer") || query.contains("best") || query.contains("highest score")) {
            List<StudentTest> attempts = studentTestRepository.findAll();
            StudentTest top = null;
            for (StudentTest st : attempts) {
                if (st.getScore() != null && (top == null || top.getScore() == null || st.getScore() > top.getScore())) {
                    top = st;
                }
            }
            if (top != null && top.getScore() != null && top.getScore() > 0) {
                return String.format("The top scorer is **%s** (Roll Number: %s) with a score of **%d** in the **%s** test.",
                        top.getStudent().getName(), 
                        top.getStudent().getRegisterNumber() != null ? top.getStudent().getRegisterNumber() : "N/A", 
                        top.getScore(), 
                        top.getTest().getName());
            } else {
                return "There are no test attempts with a score greater than 0 yet.";
            }
        }

        // 4. "summary of all subjects" / "subjects" / "questions"
        if (query.contains("subjects") || query.contains("questions") || query.contains("summary") || query.contains("subject")) {
            List<Subject> subjects = subjectRepository.findAll();
            StringBuilder sb = new StringBuilder();
            sb.append("### Subjects & Questions Catalog Summary\n\n");
            sb.append("| Subject Name | Question Count | Difficulty Distribution |\n");
            sb.append("|---|---|---|\n");
            
            for (Subject sub : subjects) {
                List<Question> questions = questionRepository.findBySubjectId(sub.getId());
                long easy = questions.stream().filter(q -> q.getDifficulty() != null && "EASY".equalsIgnoreCase(q.getDifficulty().toString())).count();
                long med = questions.stream().filter(q -> q.getDifficulty() != null && "MEDIUM".equalsIgnoreCase(q.getDifficulty().toString())).count();
                long hard = questions.stream().filter(q -> q.getDifficulty() != null && "HARD".equalsIgnoreCase(q.getDifficulty().toString())).count();
                
                sb.append(String.format("| %s | %d | %d Easy, %d Medium, %d Hard |\n", 
                    sub.getName(), questions.size(), easy, med, hard));
            }
            return sb.toString();
        }

        // 5. "attempts" / "statistics"
        if (query.contains("attempts") || query.contains("statistics") || query.contains("stats") || query.contains("stat")) {
            List<StudentTest> attempts = studentTestRepository.findAll();
            long total = attempts.size();
            long completed = attempts.stream().filter(st -> st.getStatus() != null && "COMPLETED".equalsIgnoreCase(st.getStatus())).count();
            double avgScore = attempts.stream().filter(st -> st.getScore() != null).mapToInt(StudentTest::getScore).average().orElse(0.0);
            
            return String.format("### Test Attempt Statistics\n\n" +
                    "- **Total Assigned Attempts:** %d\n" +
                    "- **Completed Assessments:** %d\n" +
                    "- **Average Attempt Score:** %.1f / 100\n",
                    total, completed, avgScore);
        }

        // 6. Student search not found fallback
        if (query.contains("student") || query.contains("list") || query.contains("table") || query.contains("find") || query.contains("search") || query.contains("is ")) {
            return "No matching student record was found in the database list for your query.";
        }

        // 7. Default conversational greeting list
        return "Hello! I am **Ash**, your control room AI assistant. Since I am currently operating in offline/demo mode, here are the topics you can ask me about using real-time database scans:\n\n" +
               "- **\"Is 24btad007 in student list?\"** / **\"find Akash\"** - Search for a specific student's record and profile status dynamically.\n" +
               "- **\"Who failed in Java?\"** - Scan for student failures or low scores in Java Programming.\n" +
               "- **\"Who scored the highest?\"** - Identify the top-performing student across all assessments.\n" +
               "- **\"Summary of subjects\"** - View all active subjects, total questions, and difficulty ranges.\n" +
               "- **\"Show attempts statistics\"** - Review global metrics, pass rates, and averages.";
    }
}
