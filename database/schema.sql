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
    ai_requests_count INT DEFAULT 0,
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
    time_taken_seconds BIGINT NULL,
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

-- Student Question Status Table
CREATE TABLE IF NOT EXISTS student_question_status (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    question_id BIGINT NOT NULL,
    status VARCHAR(30) DEFAULT 'NOT_COMPLETED',
    attempt_count INT DEFAULT 0,
    last_submission_id BIGINT NULL,
    completed_at TIMESTAMP NULL,
    last_attempt_at TIMESTAMP NULL,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    CONSTRAINT unique_student_question UNIQUE (student_id, question_id)
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

-- AI Hint Cache Table
CREATE TABLE IF NOT EXISTS ai_hint_cache (
    id BIGSERIAL PRIMARY KEY,
    hash VARCHAR(64) UNIQUE NOT NULL,
    ai_hint TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Badges Table
CREATE TABLE IF NOT EXISTS badges (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    icon VARCHAR(100) DEFAULT 'Award',
    type VARCHAR(50) NOT NULL, -- 'SUBJECT_RANKING', 'LANGUAGE_MASTER', 'CONTEST', 'CUSTOM'
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Badge Rules Table
CREATE TABLE IF NOT EXISTS badge_rules (
    id BIGSERIAL PRIMARY KEY,
    badge_id BIGINT NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'LANGUAGE', 'SUBJECT', 'GENERAL'
    target_subject_id BIGINT NULL,
    target_language VARCHAR(30) NULL, -- 'java', 'python', 'c', 'cpp', 'javascript'
    min_accepted_tests INT DEFAULT 0,
    min_avg_score DOUBLE PRECISION DEFAULT 0.0,
    min_problems_solved INT DEFAULT 0,
    rank_position INT NULL, -- 1 for Gold, 2 for Silver, 3 for Bronze
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
    FOREIGN KEY (target_subject_id) REFERENCES subjects(id) ON DELETE SET NULL
);

-- Student Badges Table
CREATE TABLE IF NOT EXISTS student_badges (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    badge_id BIGINT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_test_id BIGINT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
    FOREIGN KEY (source_test_id) REFERENCES tests(id) ON DELETE SET NULL,
    CONSTRAINT unique_student_badge UNIQUE (student_id, badge_id)
);

-- Subject Rankings Table
CREATE TABLE IF NOT EXISTS subject_rankings (
    id BIGSERIAL PRIMARY KEY,
    subject_id BIGINT NOT NULL,
    student_id BIGINT NOT NULL,
    rank_position INT NOT NULL,
    total_score INT DEFAULT 0,
    test_cases_passed INT DEFAULT 0,
    total_time_taken_seconds BIGINT DEFAULT 0,
    last_submission_time TIMESTAMP NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE,
    CONSTRAINT unique_subject_student_rank UNIQUE (subject_id, student_id)
);

-- Badge Sets Table
CREATE TABLE IF NOT EXISTS badge_sets (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    test_id BIGINT NOT NULL,
    test_code VARCHAR(50) NOT NULL,
    subject_id BIGINT NOT NULL,
    number_of_winners INT DEFAULT 3,
    enable_language_badge BOOLEAN DEFAULT false,
    language_name VARCHAR(50) NULL,
    language_badge_name VARCHAR(150) NULL,
    language_badge_icon VARCHAR(50) DEFAULT '☕',
    language_award_rank INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

-- Badge Definitions Table
CREATE TABLE IF NOT EXISTS badge_definitions (
    id BIGSERIAL PRIMARY KEY,
    badge_set_id BIGINT NOT NULL,
    rank_position INT NOT NULL,
    badge_name VARCHAR(150) NOT NULL,
    badge_icon VARCHAR(100) DEFAULT 'Award',
    badge_color VARCHAR(30) DEFAULT '#f59e0b',
    badge_order INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (badge_set_id) REFERENCES badge_sets(id) ON DELETE CASCADE
);

-- Student Achievements Table (Permanent Historical Record)
CREATE TABLE IF NOT EXISTS student_achievements (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    badge_name VARCHAR(150) NOT NULL,
    badge_icon VARCHAR(100) DEFAULT 'Award',
    badge_category VARCHAR(50) DEFAULT 'Test Ranking',
    test_id BIGINT NULL,
    test_code VARCHAR(50) NULL,
    test_name VARCHAR(150) NULL,
    subject_name VARCHAR(100) NULL,
    rank_achieved VARCHAR(50) NULL,
    awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    awarded_by VARCHAR(100) DEFAULT 'Automatic System',
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE SET NULL
);

-- Language Master Badges Table
CREATE TABLE IF NOT EXISTS language_master_badges (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    test_id BIGINT NOT NULL,
    subject VARCHAR(100) NOT NULL,
    badge_name VARCHAR(150) NOT NULL,
    badge_icon VARCHAR(50) DEFAULT '☕',
    awarded_rank INT DEFAULT 1,
    awarded_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES app_users(id) ON DELETE CASCADE,
    FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
);

-- Enable Row Level Security (RLS) for all tables
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_question_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_hint_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_rankings ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE language_master_badges ENABLE ROW LEVEL SECURITY;


