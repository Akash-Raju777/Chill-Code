# Chill Code - Project-Scoped Rules & Guardrails

This file guides all future AI pair-programming agents to maintain the critical performance, security, and port binding behavior established in this repository.

## 1. Cloud Deployments & Port Binding (Render/Railway/Heroku)
- **Rule**: Never hardcode `server.port=8080` in production files.
- **Enforcement**: Always bind the server port using the dynamic environment variable `${PORT:8080}` in `application.properties` to ensure dynamic port scan checks pass on Render.com.

## 2. Dynamic Input & Console Results (Run/Compile Flow)
- **Rule**: Supports up to 3 custom input boxes dynamically generated based on sample test case count.
- **Enforcement**: 
  - Backend must accept `customInput3` in payloads and map test results individually.
  - `TestCaseResultDto` must carry `inputData`, `expectedOutput`, and `actualOutput`.
  - Console RESULT tab must display these values side-by-side to ensure the student can verify their program's exact output streams.

## 3. Real-Time Account Security & Fullscreen Enforcements
- **Rule**: Deactivating a student must terminate their session instantly.
- **Enforcement**:
  - `JwtRequestFilter.java` must perform database checks on every incoming request, returning `403 Forbidden` if the student status is `INACTIVE` or `SUSPENDED`.
  - Student layout must query `/api/student/profile` every 5 seconds. If a `403` occurs, the frontend must dynamically log out the student.
  - Layout header must show `Security Status: Active` when not in a test session, and dynamically toggle the active security status on change.

## 4. Strict Development Rules & Guardrails
- **Stable Baseline**: Treat the current Git version as the stable baseline. Do NOT modify, refactor, migrate, delete, drop, truncate, or redesign any existing working functionality unless explicitly requested.
- **Workflow**:
  1. Inspect existing implementation first.
  2. Identify exact root cause.
  3. Modify only minimum required files/code.
  4. Show which files will be changed and why before modifying if existing functionality could be affected.
  5. Do not change database schema or existing data.
  6. Never execute SQL such as DROP TABLE, TRUNCATE, DELETE FROM without specific user approval.
  7. If database migration or destructive operation is required, STOP and ask for confirmation.
  8. Run backend compilation and frontend build after changes.
  9. Verify affected feature thoroughly before declaring success (never assume successful build means feature is correct).

