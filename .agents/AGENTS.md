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
