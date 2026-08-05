package com.chillcode.assessment.service;

import com.chillcode.assessment.entity.Subject;
import com.chillcode.assessment.entity.Submission;
import com.chillcode.assessment.repository.SubjectRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SubjectService {

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private com.chillcode.assessment.repository.QuestionRepository questionRepository;

    @Autowired
    private com.chillcode.assessment.repository.TestRepository testRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentTestRepository studentTestRepository;

    @Autowired
    private com.chillcode.assessment.repository.UserRepository userRepository;

    public List<Subject> getAllSubjects() {
        return subjectRepository.findAll();
    }

    @org.springframework.transaction.annotation.Transactional
    public Subject createSubject(Subject subject) {
        if (subjectRepository.existsByName(subject.getName())) {
            throw new RuntimeException("Subject with name " + subject.getName() + " already exists.");
        }
        Subject savedSubject = subjectRepository.save(subject);

        // Auto-create Practice Arena test for the new subject
        String testName = savedSubject.getName() + " Practice Arena";
        com.chillcode.assessment.entity.Test test = com.chillcode.assessment.entity.Test.builder()
                .subject(savedSubject)
                .name(testName)
                .durationMinutes(120)
                .startTime(java.time.LocalDateTime.now().minusDays(1))
                .endTime(java.time.LocalDateTime.now().plusYears(1))
                .maxMarks(100)
                .instructions("Write your solutions to the practice problems in the arena canvas.")
                .shuffleQuestions(false)
                .autoSubmit(true)
                .negativeMarking(false)
                .questions(new java.util.HashSet<>())
                .build();
        test = testRepository.save(test);

        // Assign test to all existing students
        java.util.List<com.chillcode.assessment.entity.User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                .collect(java.util.stream.Collectors.toList());

        for (com.chillcode.assessment.entity.User student : students) {
            com.chillcode.assessment.entity.StudentTest st = com.chillcode.assessment.entity.StudentTest.builder()
                    .student(student)
                    .test(test)
                    .status("ASSIGNED")
                    .score(0)
                    .warningsCount(0)
                    .isSuspended(false)
                    .build();
            studentTestRepository.save(st);
        }

        return savedSubject;
    }

    public Subject updateSubject(Long id, Subject subjectDetails) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + id));
        subject.setName(subjectDetails.getName());
        subject.setDescription(subjectDetails.getDescription());
        subject.setIcon(subjectDetails.getIcon());
        subject.setColor(subjectDetails.getColor());
        subject.setStatus(subjectDetails.getStatus());
        return subjectRepository.save(subject);
    }

    @Autowired
    private com.chillcode.assessment.repository.TestCaseRepository testCaseRepository;

    @Autowired
    private com.chillcode.assessment.repository.WarningRepository warningRepository;

    @Autowired
    private com.chillcode.assessment.repository.SubmissionRepository submissionRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentQuestionStatusRepository studentQuestionStatusRepository;

    @Autowired
    private com.chillcode.assessment.repository.StudentBadgeRepository studentBadgeRepository;

    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

    @org.springframework.transaction.annotation.Transactional
    public void deleteSubject(Long id) {
        Subject subject = subjectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + id));

        // 1. Delete submission test cases for submissions of student tests belonging to tests in this subject
        entityManager.createQuery("DELETE FROM SubmissionTestCase stc WHERE stc.submission.id IN (SELECT s.id FROM Submission s WHERE s.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.test.subject.id = :subId))")
                .setParameter("subId", id)
                .executeUpdate();

        // 2. Delete submission test cases for submissions associated directly with questions of this subject
        entityManager.createQuery("DELETE FROM SubmissionTestCase stc WHERE stc.submission.id IN (SELECT s.id FROM Submission s WHERE s.question.id IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId))")
                .setParameter("subId", id)
                .executeUpdate();

        // 3. Delete warning logs for student tests belonging to tests in this subject
        entityManager.createQuery("DELETE FROM Warning w WHERE w.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.test.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 4. Delete submissions for student tests belonging to tests in this subject
        entityManager.createQuery("DELETE FROM Submission s WHERE s.studentTest.id IN (SELECT st.id FROM StudentTest st WHERE st.test.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 5. Delete submissions associated directly with questions of this subject
        entityManager.createQuery("DELETE FROM Submission s WHERE s.question.id IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 6. Delete all student tests associated with tests of this subject
        entityManager.createQuery("DELETE FROM StudentTest st WHERE st.test.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 7. Delete all test cases for questions of this subject
        entityManager.createQuery("DELETE FROM TestCase tc WHERE tc.question.id IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 8. Delete all student question status entries for questions of this subject
        entityManager.createQuery("DELETE FROM StudentQuestionStatus sqs WHERE sqs.questionId IN (SELECT q.id FROM Question q WHERE q.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 9. Clear test_questions join table natively
        entityManager.createNativeQuery("DELETE FROM test_questions WHERE test_id IN (SELECT id FROM tests WHERE subject_id = ?)")
                .setParameter(1, id)
                .executeUpdate();

        // 9.1 Clear subject_rankings
        entityManager.createQuery("DELETE FROM SubjectRanking sr WHERE sr.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 9.2 Clear student_achievements referencing tests of this subject
        entityManager.createQuery("DELETE FROM StudentAchievement sa WHERE sa.test.id IN (SELECT t.id FROM Test t WHERE t.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 9.2a Clear language_master_badges referencing this subject
        entityManager.createNativeQuery("DELETE FROM language_master_badges WHERE subject = :subName OR test_id IN (SELECT id FROM tests WHERE subject_id = :subId)")
                .setParameter("subName", subject.getName())
                .setParameter("subId", id)
                .executeUpdate();

        // 9.2b Clear student_badges referencing tests of this subject
        entityManager.createNativeQuery("DELETE FROM student_badges WHERE source_test_id IN (SELECT id FROM tests WHERE subject_id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 9.3 Clear badge_definitions referencing badge_sets of this subject
        entityManager.createQuery("DELETE FROM BadgeDefinition bd WHERE bd.badgeSet.id IN (SELECT bs.id FROM BadgeSet bs WHERE bs.subject.id = :subId)")
                .setParameter("subId", id)
                .executeUpdate();

        // 9.4 Clear badge_sets
        entityManager.createQuery("DELETE FROM BadgeSet bs WHERE bs.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 10. Delete tests belonging to this subject
        entityManager.createQuery("DELETE FROM Test t WHERE t.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 11. Delete questions belonging to this subject
        entityManager.createQuery("DELETE FROM Question q WHERE q.subject.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();

        // 12. Delete subject itself
        entityManager.createQuery("DELETE FROM Subject s WHERE s.id = :subId")
                .setParameter("subId", id)
                .executeUpdate();
    }

    public com.chillcode.assessment.dto.SubjectStatsDto getSubjectStats(Long subjectId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + subjectId));

        java.util.List<com.chillcode.assessment.entity.Test> tests = testRepository.findBySubjectId(subjectId);

        java.util.List<com.chillcode.assessment.entity.Question> subjectQuestions = questionRepository.findBySubjectId(subjectId);
        subjectQuestions.sort(java.util.Comparator.comparing(com.chillcode.assessment.entity.Question::getTitle)); // Sort questions alphabetically

        long questionsCount = subjectQuestions.size();

        // Feed active questions into the testDtos list for the frontend dropdown
        java.util.List<com.chillcode.assessment.dto.SubjectStatsDto.TestDto> testDtos = subjectQuestions.stream()
                .map(q -> new com.chillcode.assessment.dto.SubjectStatsDto.TestDto(q.getId(), q.getTitle()))
                .collect(java.util.stream.Collectors.toList());

        java.util.List<com.chillcode.assessment.entity.User> students = userRepository.findAll().stream()
                .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                .collect(java.util.stream.Collectors.toList());

        java.util.Set<Long> assignedStudentIds = new java.util.HashSet<>();
        java.util.Set<Long> attendedStudentIds = new java.util.HashSet<>();
        java.util.Set<Long> passedStudentIds = new java.util.HashSet<>();
        int totalScore = 0;
        int studentTestCount = 0;
        
        java.util.Map<Long, Integer> studentTotalScores = new java.util.HashMap<>();
        java.util.List<com.chillcode.assessment.dto.SubjectStatsDto.StudentMarkDto> studentMarks = new java.util.ArrayList<>();

        for (com.chillcode.assessment.entity.Test test : tests) {
            java.util.List<com.chillcode.assessment.entity.StudentTest> studentTests = studentTestRepository.findByTestId(test.getId());
            for (com.chillcode.assessment.entity.StudentTest st : studentTests) {
                Long sId = st.getStudent().getId();
                assignedStudentIds.add(sId);

                // Consider attended if status is not ASSIGNED or has started
                if (!"ASSIGNED".equals(st.getStatus()) || st.getStartedAt() != null) {
                    attendedStudentIds.add(sId);
                }

                int score = st.getScore() != null ? st.getScore() : 0;
                int maxMarks = test.getMaxMarks() != null ? test.getMaxMarks() : 100;
                
                studentTestCount++;
                totalScore += score;
                studentTotalScores.put(sId, studentTotalScores.getOrDefault(sId, 0) + score);
                
                if (score >= maxMarks * 0.4) {
                    passedStudentIds.add(sId);
                }
            }
        } // End of tests loop for metrics

        // Pre-fetch data for all students to avoid N+1 queries
        java.util.Map<Long, java.util.List<com.chillcode.assessment.entity.StudentTest>> stByStudent = new java.util.HashMap<>();
        java.util.List<com.chillcode.assessment.entity.StudentTest> allStudentTestsForTests = new java.util.ArrayList<>();
        for (com.chillcode.assessment.entity.Test test : tests) {
            allStudentTestsForTests.addAll(studentTestRepository.findByTestId(test.getId()));
        }
        for (com.chillcode.assessment.entity.StudentTest st : allStudentTestsForTests) {
            if (st.getStudent() != null) {
                stByStudent.computeIfAbsent(st.getStudent().getId(), k -> new java.util.ArrayList<>()).add(st);
            }
        }

        java.util.Map<Long, java.util.List<com.chillcode.assessment.entity.Submission>> subsByStudent = new java.util.HashMap<>();
        java.util.Map<Long, java.util.List<com.chillcode.assessment.entity.StudentQuestionStatus>> sqsByStudent = new java.util.HashMap<>();
        java.util.Map<Long, java.util.List<com.chillcode.assessment.entity.StudentBadge>> badgesByStudent = new java.util.HashMap<>();
        
        for (com.chillcode.assessment.entity.User student : students) {
            Long sId = student.getId();
            subsByStudent.put(sId, submissionRepository.findAllByStudentIdOrderByCreatedAtDesc(sId));
            sqsByStudent.put(sId, studentQuestionStatusRepository.findByStudentId(sId));
            badgesByStudent.put(sId, studentBadgeRepository.findByStudentId(sId));
        }

        // Loop over each Question once to avoid duplicates
        for (com.chillcode.assessment.entity.Question question : subjectQuestions) {
            java.util.List<Long> testIdsWithQuestion = tests.stream()
                    .filter(t -> t.getQuestions() != null && t.getQuestions().contains(question))
                    .map(com.chillcode.assessment.entity.Test::getId)
                    .collect(java.util.stream.Collectors.toList());

            if (testIdsWithQuestion.isEmpty()) continue;

            for (com.chillcode.assessment.entity.User student : students) {
                Long sId = student.getId();
                
                java.util.List<com.chillcode.assessment.entity.StudentTest> assignedTestRecords = stByStudent.getOrDefault(sId, java.util.Collections.emptyList())
                        .stream().filter(st -> testIdsWithQuestion.contains(st.getTest().getId()))
                        .collect(java.util.stream.Collectors.toList());

                if (!assignedTestRecords.isEmpty()) {
                    boolean hasAttended = assignedTestRecords.stream().anyMatch(st -> !"ASSIGNED".equals(st.getStatus()) || st.getStartedAt() != null);
                    boolean hasMalpractice = assignedTestRecords.stream().anyMatch(st -> (st.getIsSuspended() != null && st.getIsSuspended()) || (st.getWarningsCount() != null && st.getWarningsCount() > 0));
                    
                    boolean hasPassed = false;
                    if (hasAttended) {
                        hasPassed = subsByStudent.getOrDefault(sId, java.util.Collections.emptyList()).stream()
                                .filter(sub -> sub.getQuestion() != null && sub.getQuestion().getId().equals(question.getId()))
                                .filter(sub -> sub.getActive() == null || sub.getActive())
                                .anyMatch(sub -> "ACCEPTED".equals(sub.getStatus()));
                    }

                    String resultStatus = "N/A";
                    if (hasAttended) {
                        resultStatus = hasPassed ? "Pass" : "Fail";
                    }

                    int attempts = 0;
                    com.chillcode.assessment.entity.StudentQuestionStatus sqs = sqsByStudent.getOrDefault(sId, java.util.Collections.emptyList()).stream()
                            .filter(s -> s.getQuestionId().equals(question.getId()))
                            .findFirst().orElse(null);
                    if (sqs != null && sqs.getAttemptCount() != null) {
                        attempts = sqs.getAttemptCount();
                    }

                    java.util.List<com.chillcode.assessment.dto.BadgeDto> badgeDtos = new java.util.ArrayList<>();
                    for (com.chillcode.assessment.entity.StudentBadge sb : badgesByStudent.getOrDefault(sId, java.util.Collections.emptyList())) {
                        if (sb.getSourceTest() != null && testIdsWithQuestion.contains(sb.getSourceTest().getId())) {
                            badgeDtos.add(com.chillcode.assessment.dto.BadgeDto.builder()
                                    .id(sb.getBadge().getId())
                                    .name(sb.getBadge().getName())
                                    .icon(sb.getBadge().getIcon())
                                    .description(sb.getBadge().getDescription())
                                    .type(sb.getBadge().getType())
                                    .build());
                        }
                    }

                    String rollNo = student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername();

                    studentMarks.add(new com.chillcode.assessment.dto.SubjectStatsDto.StudentMarkDto(
                            question.getId(),
                            question.getTitle(),
                            student.getName(),
                            rollNo,
                            0, 
                            100, 
                            resultStatus,
                            badgeDtos,
                            subjectId, 
                            "Subject Arena", 
                            attempts,
                            hasMalpractice ? "YES" : "NO"
                    ));
                }
            }
        }

        long attendedCount = attendedStudentIds.size();
        long notAttendedCount = Math.max(0, assignedStudentIds.size() - attendedCount);
        long passedCount = passedStudentIds.size();

        String rankHolder = "N/A";
        double rankScore = 0.0;
        for (java.util.Map.Entry<Long, Integer> entry : studentTotalScores.entrySet()) {
            if (entry.getValue() > rankScore) {
                rankScore = entry.getValue();
                com.chillcode.assessment.entity.User u = userRepository.findById(entry.getKey()).orElse(null);
                if (u != null) {
                    rankHolder = u.getName();
                }
            }
        }

        double avgScore = studentTestCount > 0 ? (double) totalScore / studentTestCount : 0.0;
        double passRate = attendedCount > 0 ? (double) passedCount / attendedCount * 100 : 0.0;
        double failRate = attendedCount > 0 ? 100.0 - passRate : 0.0;

        return new com.chillcode.assessment.dto.SubjectStatsDto(
                questionsCount,
                Math.round(avgScore * 10.0) / 10.0,
                Math.round(passRate * 10.0) / 10.0,
                Math.round(failRate * 10.0) / 10.0,
                rankHolder,
                rankScore,
                attendedCount,
                notAttendedCount,
                testDtos,
                studentMarks
        );
    }

    /**
     * Generate an Excel (.xlsx) report for the subject with all student results.
     * Columns: Student Name, Register Number, Department, Assessment Name, Test ID,
     *          Attempt Date, Marks, Passing Marks, Percentage, PASS/FAIL, Time Taken, Rank, Attendance Status
     */
    public byte[] generateSubjectExcelReport(Long subjectId) {
        Subject subject = subjectRepository.findById(subjectId)
                .orElseThrow(() -> new RuntimeException("Subject not found with id: " + subjectId));

        java.util.List<com.chillcode.assessment.entity.Test> tests = testRepository.findBySubjectId(subjectId);
        java.util.List<com.chillcode.assessment.entity.User> allStudents = userRepository.findAll().stream()
                .filter(u -> u.getRole() == com.chillcode.assessment.entity.Role.STUDENT)
                .collect(java.util.stream.Collectors.toList());

        try (org.apache.poi.xssf.usermodel.XSSFWorkbook workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook()) {
            org.apache.poi.xssf.usermodel.XSSFSheet sheet = workbook.createSheet(subject.getName() + " Report");

            // Header styles
            org.apache.poi.xssf.usermodel.XSSFCellStyle headerStyle = workbook.createCellStyle();
            org.apache.poi.xssf.usermodel.XSSFFont headerFont = workbook.createFont();
            headerFont.setBold(true);
            headerFont.setFontHeightInPoints((short) 11);
            headerFont.setColor(org.apache.poi.xssf.usermodel.XSSFFont.DEFAULT_FONT_COLOR);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(new org.apache.poi.xssf.usermodel.XSSFColor(new byte[]{(byte)45, (byte)55, (byte)72}, null));
            headerStyle.setFillPattern(org.apache.poi.ss.usermodel.FillPatternType.SOLID_FOREGROUND);
            headerStyle.setAlignment(org.apache.poi.ss.usermodel.HorizontalAlignment.CENTER);
            headerStyle.setBorderBottom(org.apache.poi.ss.usermodel.BorderStyle.THIN);

            // Pass style (green)
            org.apache.poi.xssf.usermodel.XSSFCellStyle passStyle = workbook.createCellStyle();
            org.apache.poi.xssf.usermodel.XSSFFont passFont = workbook.createFont();
            passFont.setColor(new org.apache.poi.xssf.usermodel.XSSFColor(new byte[]{(byte)16, (byte)185, (byte)129}, null));
            passFont.setBold(true);
            passStyle.setFont(passFont);

            // Fail style (red)
            org.apache.poi.xssf.usermodel.XSSFCellStyle failStyle = workbook.createCellStyle();
            org.apache.poi.xssf.usermodel.XSSFFont failFont = workbook.createFont();
            failFont.setColor(new org.apache.poi.xssf.usermodel.XSSFColor(new byte[]{(byte)239, (byte)68, (byte)68}, null));
            failFont.setBold(true);
            failStyle.setFont(failFont);

            // Date style
            org.apache.poi.xssf.usermodel.XSSFCellStyle dateStyle = workbook.createCellStyle();
            org.apache.poi.ss.usermodel.CreationHelper createHelper = workbook.getCreationHelper();
            dateStyle.setDataFormat(createHelper.createDataFormat().getFormat("yyyy-MM-dd HH:mm"));

            // Column headers
            String[] headers = {
                "Student Name", "Register Number", "Department", "Assessment Name", "Test ID",
                "Attempt Date", "Marks", "Passing Marks", "Percentage", "PASS/FAIL",
                "Time Taken (min)", "Rank", "Attendance Status"
            };

            org.apache.poi.xssf.usermodel.XSSFRow headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                org.apache.poi.xssf.usermodel.XSSFCell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
            }

            // Freeze header row
            sheet.createFreezePane(0, 1);

            // Gather all student-test data and calculate ranks
            java.util.List<Object[]> rows = new java.util.ArrayList<>();

            for (com.chillcode.assessment.entity.Test test : tests) {
                java.util.List<com.chillcode.assessment.entity.StudentTest> studentTests =
                        studentTestRepository.findByTestId(test.getId());

                // Sort by score descending to determine rank
                java.util.List<com.chillcode.assessment.entity.StudentTest> sortedByScore = studentTests.stream()
                        .sorted((a, b) -> Integer.compare(
                                b.getScore() != null ? b.getScore() : 0,
                                a.getScore() != null ? a.getScore() : 0))
                        .collect(java.util.stream.Collectors.toList());

                java.util.Map<Long, Integer> rankMap = new java.util.HashMap<>();
                for (int i = 0; i < sortedByScore.size(); i++) {
                    com.chillcode.assessment.entity.StudentTest st = sortedByScore.get(i);
                    if (st.getStudent() != null) {
                        rankMap.put(st.getStudent().getId(), i + 1);
                    }
                }

                for (com.chillcode.assessment.entity.StudentTest st : studentTests) {
                    com.chillcode.assessment.entity.User student = st.getStudent();
                    if (student == null) continue;

                    boolean attended = "SUBMITTED".equals(st.getStatus()) || "EVALUATED".equals(st.getStatus())
                            || "COMPLETED".equals(st.getStatus()) || "PENDING".equals(st.getStatus())
                            || "STARTED".equals(st.getStatus());
                    String attendanceStatus = attended ? "Attended" : "Not Attended";

                    int score = st.getScore() != null ? st.getScore() : 0;
                    int maxMarks = test.getMaxMarks() != null ? test.getMaxMarks() : 100;

                    // Compute passingMarks from submissions
                    java.util.List<com.chillcode.assessment.entity.Submission> subs =
                            submissionRepository.findByStudentTestId(st.getId());
                    int passingMarks = subs.stream()
                            .mapToInt(s -> s.getPassingMarks() != null ? s.getPassingMarks() : 0)
                            .sum();
                    if (passingMarks == 0) passingMarks = maxMarks / 2;

                    double percentage = maxMarks > 0 ? Math.round((double) score / maxMarks * 1000.0) / 10.0 : 0.0;
                    String passFailStatus = attended ? (score >= passingMarks ? "PASS" : "FAIL") : "N/A";

                    long timeTakenMin = st.getTimeTakenSeconds() != null ? st.getTimeTakenSeconds() / 60 : 0;
                    int rank = rankMap.getOrDefault(student.getId(), 0);

                    String testCode = test.getTestCode() != null ? test.getTestCode() : "TEST-" + test.getId();
                    String department = student.getDepartment() != null ? student.getDepartment() : "N/A";
                    String registerNumber = student.getRegisterNumber() != null ? student.getRegisterNumber() : student.getUsername();

                    rows.add(new Object[]{
                        student.getName(),
                        registerNumber,
                        department,
                        test.getName(),
                        testCode,
                        st.getSubmittedAt() != null ? st.getSubmittedAt() : (st.getStartedAt() != null ? st.getStartedAt() : null),
                        score,
                        passingMarks,
                        percentage,
                        passFailStatus,
                        timeTakenMin,
                        rank > 0 ? rank : "N/A",
                        attendanceStatus
                    });
                }
            }

            // Write data rows
            int rowNum = 1;
            for (Object[] rowData : rows) {
                org.apache.poi.xssf.usermodel.XSSFRow row = sheet.createRow(rowNum++);
                for (int col = 0; col < rowData.length; col++) {
                    org.apache.poi.xssf.usermodel.XSSFCell cell = row.createCell(col);
                    Object val = rowData[col];
                    if (val == null) {
                        cell.setCellValue("N/A");
                    } else if (val instanceof java.time.LocalDateTime) {
                        java.time.LocalDateTime ldt = (java.time.LocalDateTime) val;
                        java.util.Date date = java.util.Date.from(ldt.atZone(java.time.ZoneId.systemDefault()).toInstant());
                        cell.setCellValue(date);
                        cell.setCellStyle(dateStyle);
                    } else if (val instanceof Number) {
                        cell.setCellValue(((Number) val).doubleValue());
                    } else {
                        String strVal = val.toString();
                        cell.setCellValue(strVal);
                        // Apply colour to PASS/FAIL column (col 9)
                        if (col == 9) {
                            if ("PASS".equals(strVal)) cell.setCellStyle(passStyle);
                            else if ("FAIL".equals(strVal)) cell.setCellStyle(failStyle);
                        }
                    }
                }
            }

            // Auto-size all columns
            for (int i = 0; i < headers.length; i++) {
                sheet.autoSizeColumn(i);
                // Ensure minimum width
                if (sheet.getColumnWidth(i) < 3000) sheet.setColumnWidth(i, 3000);
            }

            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            workbook.write(bos);
            return bos.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate Excel report: " + e.getMessage(), e);
        }
    }
}
