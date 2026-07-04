package com.chillcode.assessment.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "questions")
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @Column(nullable = false, length = 150)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Difficulty difficulty;

    @Column(name = "problem_statement", nullable = false, columnDefinition = "TEXT")
    private String problemStatement;

    @Column(columnDefinition = "TEXT")
    private String constraints;

    @Column(name = "input_format", columnDefinition = "TEXT")
    private String inputFormat;

    @Column(name = "output_format", columnDefinition = "TEXT")
    private String outputFormat;

    private Integer marks = 10;

    @Column(name = "negative_marks")
    private Integer negativeMarks = 0;

    @Column(name = "allowed_languages", columnDefinition = "TEXT")
    private String allowedLanguages; // Comma-separated: java,python,cpp,c,javascript

    private String tags; // Comma-separated tags: Arrays,Strings,DP

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TestCase> testCases;

    @OneToMany(mappedBy = "question", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Submission> submissions;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public Question() {}

    public Question(Long id, Subject subject, String title, Difficulty difficulty, String problemStatement, 
                    String constraints, String inputFormat, String outputFormat, Integer marks, Integer negativeMarks, 
                    String allowedLanguages, String tags, List<TestCase> testCases, List<Submission> submissions, LocalDateTime createdAt) {
        this.id = id;
        this.subject = subject;
        this.title = title;
        this.difficulty = difficulty;
        this.problemStatement = problemStatement;
        this.constraints = constraints;
        this.inputFormat = inputFormat;
        this.outputFormat = outputFormat;
        this.marks = marks;
        this.negativeMarks = negativeMarks;
        this.allowedLanguages = allowedLanguages;
        this.tags = tags;
        this.testCases = testCases;
        this.submissions = submissions;
        this.createdAt = createdAt;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Subject getSubject() { return subject; }
    public void setSubject(Subject subject) { this.subject = subject; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public Difficulty getDifficulty() { return difficulty; }
    public void setDifficulty(Difficulty difficulty) { this.difficulty = difficulty; }

    public String getProblemStatement() { return problemStatement; }
    public void setProblemStatement(String problemStatement) { this.problemStatement = problemStatement; }

    public String getConstraints() { return constraints; }
    public void setConstraints(String constraints) { this.constraints = constraints; }

    public String getInputFormat() { return inputFormat; }
    public void setInputFormat(String inputFormat) { this.inputFormat = inputFormat; }

    public String getOutputFormat() { return outputFormat; }
    public void setOutputFormat(String outputFormat) { this.outputFormat = outputFormat; }



    public Integer getMarks() { return marks; }
    public void setMarks(Integer marks) { this.marks = marks; }

    public Integer getNegativeMarks() { return negativeMarks; }
    public void setNegativeMarks(Integer negativeMarks) { this.negativeMarks = negativeMarks; }

    public String getAllowedLanguages() { return allowedLanguages; }
    public void setAllowedLanguages(String allowedLanguages) { this.allowedLanguages = allowedLanguages; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public List<TestCase> getTestCases() { return testCases; }
    public void setTestCases(List<TestCase> testCases) { this.testCases = testCases; }

    public List<Submission> getSubmissions() { return submissions; }
    public void setSubmissions(List<Submission> submissions) { this.submissions = submissions; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public static QuestionBuilder builder() {
        return new QuestionBuilder();
    }

    public static class QuestionBuilder {
        private Long id;
        private Subject subject;
        private String title;
        private Difficulty difficulty;
        private String problemStatement;
        private String constraints;
        private String inputFormat;
        private String outputFormat;
        private Integer marks = 10;
        private Integer negativeMarks = 0;
        private String allowedLanguages;
        private String tags;
        private List<TestCase> testCases;
        private List<Submission> submissions;
        private LocalDateTime createdAt;

        public QuestionBuilder id(Long id) { this.id = id; return this; }
        public QuestionBuilder subject(Subject subject) { this.subject = subject; return this; }
        public QuestionBuilder title(String title) { this.title = title; return this; }
        public QuestionBuilder difficulty(Difficulty difficulty) { this.difficulty = difficulty; return this; }
        public QuestionBuilder problemStatement(String problemStatement) { this.problemStatement = problemStatement; return this; }
        public QuestionBuilder constraints(String constraints) { this.constraints = constraints; return this; }
        public QuestionBuilder inputFormat(String inputFormat) { this.inputFormat = inputFormat; return this; }
        public QuestionBuilder outputFormat(String outputFormat) { this.outputFormat = outputFormat; return this; }
        public QuestionBuilder marks(Integer marks) { this.marks = marks; return this; }
        public QuestionBuilder negativeMarks(Integer negativeMarks) { this.negativeMarks = negativeMarks; return this; }
        public QuestionBuilder allowedLanguages(String allowedLanguages) { this.allowedLanguages = allowedLanguages; return this; }
        public QuestionBuilder tags(String tags) { this.tags = tags; return this; }
        public QuestionBuilder testCases(List<TestCase> testCases) { this.testCases = testCases; return this; }
        public QuestionBuilder submissions(List<Submission> submissions) { this.submissions = submissions; return this; }
        public QuestionBuilder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public Question build() {
            return new Question(id, subject, title, difficulty, problemStatement, constraints, inputFormat, outputFormat, 
                                marks, negativeMarks, allowedLanguages, tags, testCases, submissions, 
                                createdAt != null ? createdAt : LocalDateTime.now());
        }
    }
}
