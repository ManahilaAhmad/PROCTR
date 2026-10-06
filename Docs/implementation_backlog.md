# PROCTR Implementation Backlog

This checklist is ordered by risk and dependency. An item is complete only after implementation, validation, and regression testing.

## 1. Security and access control

- [x] Require a valid signed session for every currently registered private API endpoint.
- [x] Apply baseline role-based access rules for Admin, Director, HOD, DEC, Coordinator, Teacher, and Student.
- [x] Prevent direct cross-user access to profiles, schedules, notifications, submissions, or password changes.
- [ ] Restrict HOD and DEC records to their assigned department.
- [ ] Verify exam, course-offering, submission, and session ownership before mutations or downloads.
- [x] Send the session token automatically from both the website and desktop application.
- [ ] Add audit logging for privileged Admin and academic workflow actions.
- [ ] Add rate limiting and lockout protection to login and password-reset endpoints.

## 2. Database integrity

- [ ] Move all runtime `CREATE TABLE` and `ALTER TABLE` statements into versioned migrations.
- [ ] Add live-exam, desktop-session, violation-log, profile-picture, and proposed-date definitions to the canonical schema.
- [ ] Add foreign keys, uniqueness rules, indexes, and lifecycle constraints where missing.
- [ ] Add a repeatable migration runner and document migration order.
- [ ] Confirm Neon production schema matches the repository schema.

## 3. Exam enforcement

- [ ] Verify student enrollment before allowing an exam join.
- [ ] Enforce published schedules, start time, end time, and allowed lab on the server.
- [ ] Lock submissions after the deadline unless an authorized extension exists.
- [ ] Generate session codes and passcodes with cryptographically secure randomness.
- [ ] Make reveal, timer start, extension, and end operations idempotent and role-restricted.

## 4. Live monitoring and proctoring

- [ ] Connect desktop telemetry to the fuzzy-cheating evaluator automatically.
- [ ] Start and health-check the fuzzy sidecar as part of the application lifecycle.
- [ ] Replace hardcoded fuzzy-service and localhost addresses with configuration.
- [ ] Align Socket.IO event names and rooms between server and clients.
- [ ] Remove hardcoded exam IDs from monitoring pages.
- [ ] Replace static invigilator assignments and live-student data with APIs.
- [ ] Add reliable reconnect, event buffering, and live-dashboard refresh behavior.
- [ ] Resolve the NumPy/SciPy compatibility warning in the fuzzy service.

## 5. Crash recovery

- [ ] Save periodic encrypted exam checkpoints locally and/or on the server.
- [ ] Restore answers, remaining time, session identity, and upload state after restart.
- [ ] Prevent duplicate submissions when queued work is replayed.
- [ ] Define and test offline, server-failure, and power-loss recovery paths.

## 6. AI exam checking

- [ ] Implement isolated code execution with strict CPU, memory, time, and network limits.
- [ ] Support instructor test cases and per-test scoring.
- [ ] Add MOSS or an equivalent plagiarism-analysis workflow.
- [ ] Store automated scores, evidence, execution logs, and errors.
- [ ] Add teacher review, comments, score override, and finalization.

## 7. Results and analytics

- [ ] Replace the student's hardcoded empty past-exams list with result APIs.
- [ ] Add teacher result review and publishing.
- [ ] Add student marks, feedback, flags, and submission details.
- [ ] Complete Director/HOD/DEC dashboards with real scoped metrics.
- [ ] Add exportable post-exam and institutional reports.

## 8. Administration and automation

- [ ] Complete user creation/editing and role/profile assignment in Admin.
- [ ] Add Admin exam/session oversight and audit-log views.
- [ ] Make lab ranges, ports, service URLs, thresholds, and policies database-driven.
- [ ] Implement scheduled automatic session start/end and notification jobs.
- [ ] Add configuration validation and safe defaults.

## 9. Client cleanup and consistency

- [ ] Remove hardcoded localhost URLs, IDs, mock arrays, and environment-specific values.
- [ ] Centralize authenticated API access and error handling.
- [ ] Standardize endpoint names used by the website, desktop app, and backend.
- [ ] Add clear expired-session handling and redirect to login.
- [ ] Finish responsive and accessibility checks for each role portal.

## 10. Quality, deployment, and operations

- [ ] Add backend integration tests for authentication, authorization, workflows, and database rules.
- [ ] Add website and desktop component/end-to-end tests.
- [ ] Fix the current frontend lint errors and warnings.
- [ ] Add CI for linting, tests, builds, migration validation, and dependency auditing.
- [ ] Pin compatible dependencies and address security advisories.
- [ ] Add structured logs, health checks, monitoring, backups, and restore procedures.
- [ ] Prepare separate development, test, and production configuration and deployment documentation.
