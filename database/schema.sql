-- Users Table (Admins and Students)
CREATE TABLE IF NOT EXISTS app_users (
    id BIGSERIAL PRIMARY KEY,
    register_number VARCHAR(50) UNIQUE NULL, -- For students
    username VARCHAR(50) UNIQUE NULL,         -- For admins
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(15) NULL,
    department VARCHAR(100) NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'ADMIN', 'STUDENT'
    status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUSPENDED', 'INACTIVE'
    suspension_end_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    icon VARCHAR(50) DEFAULT 'BookOpen',
    color VARCHAR(50) DEFAULT '#3B82F6', -- Hex or Tailwind color class
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    difficulty VARCHAR(20) NOT NULL, -- 'EASY', 'MEDIUM', 'HARD'
    problem_statement TEXT NOT NULL,
    constraints TEXT NULL,
    input_format TEXT NULL,
    output_format TEXT NULL,
    marks INT DEFAULT 10,
    negative_marks INT DEFAULT 0,
    allowed_languages TEXT NULL, -- Comma separated: 'java,python,cpp,c,javascript'
    tags VARCHAR(255) NULL,       -- Comma separated tags
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Test Cases Table
CREATE TABLE IF NOT EXISTS test_cases (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL,
    input_data TEXT NOT NULL,
    expected_output TEXT NOT NULL,
    is_hidden BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Tests Table
CREATE TABLE IF NOT EXISTS tests (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    name VARCHAR(150) NOT NULL,
    duration_minutes INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    max_marks INT DEFAULT 100,
    instructions TEXT NULL,
    shuffle_questions BOOLEAN DEFAULT FALSE,
    auto_submit BOOLEAN DEFAULT TRUE,
    negative_marking BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Test Questions Relationship Table (Many-to-Many)
CREATE TABLE IF NOT EXISTS test_questions (
    test_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    PRIMARY KEY (test_id, question_id),
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Student-Test Association (Enrollment / Attempts)
CREATE TABLE IF NOT EXISTS student_tests (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    test_id BIGINT NOT NULL,
    score INT DEFAULT 0,
    status VARCHAR(30) DEFAULT 'ASSIGNED', -- 'ASSIGNED', 'STARTED', 'SUBMITTED', 'SUSPENDED', 'EVALUATED'
    started_at TIMESTAMP NULL,
    submitted_at TIMESTAMP NULL,
    warnings_count INT DEFAULT 0,
    is_suspended BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    CONSTRAINT unique_student_test UNIQUE (student_id, test_id)
);

-- Code Submissions
CREATE TABLE IF NOT EXISTS submissions (
    id BIGSERIAL PRIMARY KEY,
    student_test_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    language VARCHAR(20) NOT NULL,
    code TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'PENDING', -- 'ACCEPTED', 'WRONG_ANSWER', 'TIME_LIMIT_EXCEEDED', 'COMPILATION_ERROR', 'RUNTIME_ERROR'
    run_time_ms INT DEFAULT 0,
    memory_used_kb INT DEFAULT 0,
    score INT DEFAULT 0,
    compile_error TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_test_id) REFERENCES student_tests(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- Submission Test Cases details
CREATE TABLE IF NOT EXISTS submission_test_cases (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL,
    test_case_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL, -- 'PASSED', 'FAILED', 'TLE', 'RTE'
    run_time_ms INT DEFAULT 0,
    memory_used_kb INT DEFAULT 0,
    message VARCHAR(255) NULL,
    FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (test_case_id) REFERENCES test_cases(id) ON DELETE CASCADE
);

-- Warnings Table
CREATE TABLE IF NOT EXISTS warnings (
    id BIGSERIAL PRIMARY KEY,
    student_test_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'TAB_SWITCH', 'FULLSCREEN_EXIT', 'DEVTOOLS_OPEN'
    reason VARCHAR(255) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_test_id) REFERENCES student_tests(id) ON DELETE CASCADE
);

-- Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    title VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'GOLD', 'SILVER', 'BRONZE', 'LANGUAGE_SPECIALIST', 'CONSISTENCY'
    badge_icon VARCHAR(50) DEFAULT 'Award',
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) DEFAULT 'GENERAL', -- 'TEST_ALERT', 'SUSPENSION', 'CHEATING', 'RESULT', 'ACHIEVEMENT'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);

-- Activity/Audit Logs Table
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    action VARCHAR(100) NOT NULL,
    details TEXT NULL,
    ip_address VARCHAR(45) NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
);
