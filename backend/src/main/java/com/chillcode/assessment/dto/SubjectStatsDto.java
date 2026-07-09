package com.chillcode.assessment.dto;

import java.util.List;

public class SubjectStatsDto {
    private long questionsCount;
    private double avgScore;
    private double passRate;
    private double failRate;
    private String rankHolder;
    private double rankScore;
    private long attendedCount;
    private long notAttendedCount;
    private List<StudentMarkDto> studentMarks;

    public SubjectStatsDto() {}

    public SubjectStatsDto(long questionsCount, double avgScore, double passRate, double failRate, 
                           String rankHolder, double rankScore, long attendedCount, long notAttendedCount, 
                           List<StudentMarkDto> studentMarks) {
        this.questionsCount = questionsCount;
        this.avgScore = avgScore;
        this.passRate = passRate;
        this.failRate = failRate;
        this.rankHolder = rankHolder;
        this.rankScore = rankScore;
        this.attendedCount = attendedCount;
        this.notAttendedCount = notAttendedCount;
        this.studentMarks = studentMarks;
    }

    public long getQuestionsCount() { return questionsCount; }
    public void setQuestionsCount(long questionsCount) { this.questionsCount = questionsCount; }

    public double getAvgScore() { return avgScore; }
    public void setAvgScore(double avgScore) { this.avgScore = avgScore; }

    public double getPassRate() { return passRate; }
    public void setPassRate(double passRate) { this.passRate = passRate; }

    public double getFailRate() { return failRate; }
    public void setFailRate(double failRate) { this.failRate = failRate; }

    public String getRankHolder() { return rankHolder; }
    public void setRankHolder(String rankHolder) { this.rankHolder = rankHolder; }

    public double getRankScore() { return rankScore; }
    public void setRankScore(double rankScore) { this.rankScore = rankScore; }

    public long getAttendedCount() { return attendedCount; }
    public void setAttendedCount(long attendedCount) { this.attendedCount = attendedCount; }

    public long getNotAttendedCount() { return notAttendedCount; }
    public void setNotAttendedCount(long notAttendedCount) { this.notAttendedCount = notAttendedCount; }

    public List<StudentMarkDto> getStudentMarks() { return studentMarks; }
    public void setStudentMarks(List<StudentMarkDto> studentMarks) { this.studentMarks = studentMarks; }

    public static class StudentMarkDto {
        private String questionName;
        private String name;
        private String registerNumber;
        private int score;
        private int maxMarks;
        private String status;

        public StudentMarkDto() {}

        public StudentMarkDto(String questionName, String name, String registerNumber, int score, int maxMarks, String status) {
            this.questionName = questionName;
            this.name = name;
            this.registerNumber = registerNumber;
            this.score = score;
            this.maxMarks = maxMarks;
            this.status = status;
        }

        public StudentMarkDto(String name, String registerNumber, int score, int maxMarks, String status) {
            this.questionName = "N/A";
            this.name = name;
            this.registerNumber = registerNumber;
            this.score = score;
            this.maxMarks = maxMarks;
            this.status = status;
        }

        public String getQuestionName() { return questionName; }
        public void setQuestionName(String questionName) { this.questionName = questionName; }

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }

        public String getRegisterNumber() { return registerNumber; }
        public void setRegisterNumber(String registerNumber) { this.registerNumber = registerNumber; }

        public int getScore() { return score; }
        public void setScore(int score) { this.score = score; }

        public int getMaxMarks() { return maxMarks; }
        public void setMaxMarks(int maxMarks) { this.maxMarks = maxMarks; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
    }
}
