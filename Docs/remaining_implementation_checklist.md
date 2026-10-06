# PROCTR Remaining Implementation Checklist

This is the consolidated implementation list from the scope document, the earlier “things to make dynamic” list, the current code audit, and the multi-PC LAN requirements. Work should generally be completed in the order shown because later modules depend on earlier ones.

## 1. LAN and multi-PC compatibility — do before multi-device testing

- [ ] Replace the Desktop `localhost:5000` API address with one central configurable server URL.
- [ ] Derive the Desktop REST and Socket.IO addresses from the same server configuration.
- [ ] Update the Desktop CSP to permit only the configured backend server.
- [ ] Replace the offline queue’s localhost fallback with the configured backend address.
- [ ] Update Desktop submission URL validation to allow the configured LAN server rather than localhost only.
- [ ] Remove or consolidate unused duplicate API configuration files.
- [ ] Add a simple first-run/server-address configuration screen or packaged configuration file.
- [ ] Validate the configured URL, protocol, hostname and port before saving it.
- [ ] Add the website LAN origin to `FRONTEND_URL` and `ALLOWED_ORIGINS`.
- [ ] Configure each real lab’s CIDR range, such as `192.168.18.0/24`, through Admin.
- [ ] Document required Windows Firewall rules for ports 5000 and 5173/deployed website port.
- [ ] Test one backend/website machine, one teacher machine and at least two student PCs on the same LAN.
- [ ] Test Socket.IO reconnect, exam reveal, starter-code download, monitoring and submission across separate PCs.
- [ ] Detect and clearly report an unreachable or incorrectly configured server.
- [ ] Decide how packaged Desktop clients discover the server if its DHCP address changes; preferably use a static IP or internal DNS name.

## 2. Complete server-side exam enforcement

- [ ] Allow students to join only a published, scheduled exam in which they are actively enrolled.
- [ ] Enforce the official exam date, start time, end time and configurable early-join window on the server.
- [ ] Verify the student IP belongs to the assigned lab range at join and periodically during the exam.
- [ ] Reject joining from the wrong lab even if the session code and passcode are correct.
- [ ] Lock submissions after the effective deadline.
- [ ] Allow submissions after the original deadline only when an authorized extension exists.
- [ ] Automatically end the live session when the server-side timer expires.
- [ ] Prevent a completed exam from creating another live session unless Admin performs an explicit reset/reopen action.
- [ ] Make reveal, timer start, extension and end operations idempotent.
- [ ] Store a complete exam-session state-transition history.
- [ ] Add transactional protection against two invigilators starting the same exam simultaneously.
- [ ] Test early, on-time, late, wrong-lab, unenrolled and duplicate-session cases.

## 3. Complete crash recovery and resume

- [ ] Save periodic exam-work checkpoints without reading files outside the PROCTR workspace.
- [ ] Encrypt checkpoint metadata and recovery state locally.
- [ ] Restore the authenticated session after an application restart.
- [ ] Restore the active exam ID, live-session identity and server connection.
- [ ] Restore the authoritative remaining time from the server rather than trusting the PC clock.
- [ ] Restore question-paper reveal and starter-code installation state.
- [ ] Resume monitoring sensors and verify their health.
- [ ] Restore pending offline events and submission state.
- [ ] Make offline-queue event identifiers idempotent so replay cannot create duplicates.
- [ ] Prevent duplicate final submissions after an automatic/manual retry.
- [ ] Define safe behavior when the backend is unavailable at exam end.
- [ ] Test renderer reload, Electron crash, backend restart, network loss and full PC restart.

## 4. Instructor test-case and rubric management

- [ ] Add teacher UI and APIs for creating programming questions.
- [ ] Allow visible/sample and hidden test cases.
- [ ] Store test input, expected output and marks per test case.
- [ ] Support test-case file import where appropriate.
- [ ] Validate total test-case marks against exam/question marks.
- [ ] Version test cases and rubrics when an approved exam is revised.
- [ ] Prevent students from accessing hidden tests before or during the exam.
- [ ] Connect the currently uploaded rubric to the checking and teacher-review workflow.
- [ ] Add HOD preview of rubric/test-case summaries without exposing hidden answers unnecessarily.

## 5. Automated code checking

- [ ] Choose the supported programming languages for the FYP demonstration.
- [ ] Detect or require the submission language and entry file.
- [ ] Execute student code in an isolated container/sandbox, never directly in the backend process.
- [ ] Disable network access inside the execution sandbox.
- [ ] Apply CPU, memory, process-count, file-size and execution-time limits.
- [ ] Compile code and store compiler errors safely.
- [ ] Run each instructor test case independently.
- [ ] Record actual output, expected output, runtime, exit code and timeout/error evidence.
- [ ] Calculate per-test and total automated marks.
- [ ] Apply teacher rubric criteria that cannot be represented as test cases.
- [ ] Add teacher review, comments, score override and finalization.
- [ ] Ensure malicious student output is escaped before display.
- [ ] Add a job queue so many submissions cannot overload the checking service.

## 6. MOSS/plagiarism analysis

- [ ] Integrate MOSS or an approved equivalent for supported languages.
- [ ] Group comparisons by exam/course rather than comparing unrelated submissions.
- [ ] Exclude teacher-provided starter code from similarity calculations.
- [ ] Store similarity percentages, matched files/pairs and analysis status.
- [ ] Provide teachers with evidence links and side-by-side review.
- [ ] Treat similarity as an indicator requiring human review, not automatic proof of cheating.
- [ ] Add plagiarism findings to post-exam reports.

## 7. Complete behavioral risk analysis

- [ ] Automatically forward relevant Desktop events to the fuzzy evaluator.
- [ ] Start, stop and health-check the fuzzy sidecar as part of the backend/application lifecycle.
- [ ] Make the fuzzy-service URL and port configurable.
- [ ] Make risk thresholds, weights and fuzzy rules configurable/versioned.
- [ ] Calculate and store a current cheating probability for each student.
- [ ] Combine USB, clipboard, focus loss, unauthorized app/site, network and file-access signals.
- [ ] Show Low, Medium, High and Critical risk levels with contributing reasons.
- [ ] Calculate a final post-exam risk score and preserve the evidence used.
- [ ] Allow invigilators/teachers to acknowledge events and mark false positives.
- [ ] Implement the planned starter-code exemption for legitimate code/content.
- [ ] Resolve Python/NumPy/SciPy compatibility warnings and pin compatible versions.
- [ ] Validate fuzzy rules using controlled mock-exam data.

## 8. Complete exam environment control

- [ ] Enforce the per-exam allowed application/process list.
- [ ] Enforce the per-exam allowed domain list without blocking required PROCTR/Cloudinary/server traffic.
- [ ] Improve detection/blocking of unauthorized browsers and AI tools.
- [ ] Restrict access to files outside the assigned exam workspace where safely possible.
- [ ] Detect attempts to terminate the Electron app or Python sensor process.
- [ ] Detect sensor crashes and notify the invigilator immediately.
- [ ] Restart recoverable sensors and record the outage period.
- [ ] Protect offline logs/checkpoints from undetected modification using authenticated hashes/signatures.
- [ ] Restore modified Windows/network settings after normal exit and crashes.
- [ ] Make USB, DNS, LAN, filesystem and process polling intervals configurable.
- [ ] Test Windows permission limitations using non-administrator student accounts.

## 9. Complete live monitoring

- [ ] Remove any remaining mock students, exam IDs and fallback monitoring data.
- [ ] Display accurate connected, disconnected, reconnecting, submitted and recovered states.
- [ ] Display each student’s current risk probability and sensor-health status.
- [ ] Add filters for student, severity, violation type and connection status.
- [ ] Let invigilators acknowledge/comment on alerts.
- [ ] Buffer events reliably during temporary Socket.IO disconnections.
- [ ] Restore authorized Socket.IO rooms after reconnect and session revalidation.
- [ ] Show whether the student received the paper/starter files successfully.
- [ ] Show submission progress and final server acknowledgement.
- [ ] Provide an authorized emergency end/force-submit workflow.

## 10. Results, grading and publishing

- [ ] Replace the student’s placeholder/empty past-exam data with real result APIs.
- [ ] Build the teacher result-review page.
- [ ] Show test-case marks, rubric marks, behavior risk and plagiarism indicators separately.
- [ ] Allow teacher comments and mark overrides with an audit reason.
- [ ] Add result draft, finalized and published states.
- [ ] Let students see only published marks and allowed feedback.
- [ ] Show submission details without exposing private security evidence that students should not receive.
- [ ] Notify students when results are published or revised.
- [ ] Preserve result revision and publication history.

## 11. Analytics and reports

- [ ] Complete Director, HOD and DEC dashboards using real department/role-scoped data.
- [ ] Add pass/fail rates, averages, highest/lowest marks and grade distributions.
- [ ] Add violation-category and risk-level distributions.
- [ ] Add course, section, department, lab and time-period comparisons.
- [ ] Generate an individual student activity timeline.
- [ ] Generate an exam-level security and performance summary.
- [ ] Generate automated-checking, plagiarism and final marks reports.
- [ ] Export authorized reports as PDF and CSV.
- [ ] Add report generation status, failure handling and regeneration.
- [ ] Ensure exports apply the same authorization rules as dashboards.

## 12. Complete Admin controls

- [ ] Add user creation with the matching Student/Teacher/HOD/DEC/Coordinator/Director profile.
- [ ] Add editing of names, emails, registration numbers, departments, programs and batches.
- [ ] Add safe role assignment/change with validation of dependent records.
- [ ] Add an Admin-assisted password-reset workflow without exposing passwords.
- [ ] Add user search, filters, pagination and bulk import if required.
- [ ] Add exam/session oversight across departments.
- [ ] Show active sessions and allow an audited force-end/reopen operation.
- [ ] Add configuration history and rollback for high-impact settings.
- [ ] Add retention controls for sessions, attempts, security logs and exam data.
- [ ] Add an audit view for academic actions, not only cybersecurity events.

## 13. Notifications and scheduled automation

- [ ] Send upcoming-exam notifications to enrolled students and assigned invigilators.
- [ ] Send schedule creation/change/cancellation notifications.
- [ ] Send HOD feedback/revision notifications to the correct teacher.
- [ ] Send DEC assignment and approved-swap notifications.
- [ ] Send result-publication notifications.
- [ ] Add scheduled jobs for reminders and automatic session expiry/end.
- [ ] Make notification polling interval and retry behavior configurable.
- [ ] Record background-job execution, failures and retries.
- [ ] Avoid duplicate notifications through idempotency keys.

## 14. Make remaining hardcoded values dynamic

- [ ] Backend API hostname, protocol and port for packaged Desktop clients.
- [ ] Socket.IO hostname, protocol and port.
- [ ] AI/fuzzy sidecar hostname and port.
- [ ] Lab CIDR/range per physical lab.
- [ ] Exam dates, times, durations, marks, warning time and extension limits.
- [ ] Allowed applications/processes per exam or policy template.
- [ ] Allowed domains per exam or policy template.
- [ ] Whitelist suggestions by course/programming language.
- [ ] Clipboard threshold and focus-loss timeout.
- [ ] USB, DNS, LAN, filesystem and process polling intervals.
- [ ] Violation codes, titles, descriptions, severities and risk weights.
- [ ] Fuzzy risk thresholds and rules.
- [ ] Exam workspace, recovery, offline-log and backup directories.
- [ ] Submission storage provider and storage paths.
- [ ] Cloudinary folder names and delivery mode.
- [ ] Upload extensions and size/count limits.
- [ ] Offline queue batch size, retry count, backoff and timeout.
- [ ] Notification polling and background-job intervals.
- [ ] Session duration and persistence/security policies.
- [ ] Report names, formats, branding and retention.
- [ ] University name, logo, departments and portal branding.
- [ ] Project-team/About-page information if it must remain editable.
- [ ] Remove development/demo fallback users, IDs, mock arrays and placeholder records.

Values already derived from the database—such as user identity, course, section, teacher, schedule, invigilator and live connected-student records—must not be replaced with new hardcoded fallbacks when completing the remaining screens.

## 15. Database integrity and migrations

- [ ] Remove remaining runtime `CREATE TABLE` and `ALTER TABLE` operations from controllers/server startup.
- [ ] Move every schema change into ordered, versioned migrations.
- [ ] Add a migration-history table and repeatable migration runner.
- [ ] Add missing foreign keys, uniqueness rules, indexes and status constraints.
- [ ] Define valid exam, schedule, live-session, result and submission state transitions.
- [ ] Use database transactions for multi-step approval, scheduling, swap, grading and publishing operations.
- [ ] Confirm the Neon schema matches the canonical repository schema.
- [ ] Add safe cleanup jobs for expired sessions and old attempt records.
- [ ] Document backup and restoration procedures and test a restore.

## 16. Remaining production security work

- [ ] Replace the testing Admin password before any shared-network demonstration.
- [ ] Serve the website, backend and WebSocket connection over HTTPS/WSS in production.
- [ ] Configure Cloudinary authenticated/private delivery with short-lived, ownership-checked signed URLs.
- [ ] Rotate any database, Cloudinary, SMTP or session secret that was shared or committed.
- [ ] Enable MFA on Neon, Cloudinary, Gmail, GitHub and hosting accounts.
- [ ] Replace the in-memory HTTP limiter with a shared Redis/gateway limiter if multiple backend instances are used.
- [ ] Add application-level MFA for privileged roles if required by the university.
- [ ] Define security/audit-log retention and alerting rules.
- [ ] Package and sign the Electron application.
- [ ] Apply suitable Windows permissions to `C:\PROCTR_Exams`.
- [ ] Perform dependency and vulnerability auditing before release.

## 17. Client cleanup, quality and deployment

- [ ] Centralize authenticated API calls and consistent error handling.
- [ ] Standardize endpoint and field names across website, Desktop and backend.
- [ ] Remove remaining localhost URLs and environment-specific values.
- [ ] Remove obsolete code paths and duplicate configuration modules.
- [ ] Fix all current project-wide frontend lint errors and warnings.
- [ ] Complete responsive and accessibility testing for each role portal.
- [ ] Add backend integration tests for authentication, authorization and full academic workflows.
- [ ] Add database/migration tests.
- [ ] Add React component and role-navigation tests.
- [ ] Add Electron end-to-end tests.
- [ ] Add multi-PC mock-exam tests with network interruption and recovery.
- [ ] Add CI for linting, tests, builds, migration validation and dependency auditing.
- [ ] Prepare separate development, testing and production configurations.
- [ ] Add structured application logs, health checks and operational monitoring.
- [ ] Write installation, LAN setup, Admin, teacher, student and troubleshooting documentation.

## Recommended execution order

- [ ] Phase 1: LAN configuration and multi-PC connectivity.
- [ ] Phase 2: Server-side schedule, lab and submission enforcement.
- [ ] Phase 3: Crash recovery and idempotent offline replay.
- [ ] Phase 4: Teacher test cases and isolated automated checking.
- [ ] Phase 5: MOSS and full behavioral-risk integration.
- [ ] Phase 6: Results, analytics and reports.
- [ ] Phase 7: Admin/user management and scheduled notifications.
- [ ] Phase 8: Database cleanup, automated testing and production deployment.

## Major functionality already implemented

- [x] Role-based login and password recovery through email.
- [x] Revocable server-side sessions and security auditing.
- [x] Baseline role, ownership, exam and department authorization.
- [x] Admin lab/network configuration and system settings.
- [x] Teacher exam creation, paper/rubric/starter-code upload and approval sharing.
- [x] HOD approval/rejection workflow and department routing.
- [x] DEC invigilator assignment and duty-swap foundation.
- [x] Coordinator schedule and lab-assignment foundation.
- [x] Live exam creation, hashed passcode, reveal, timer, extension and end controls.
- [x] Enrollment-aware exam join and lab-network validation foundation.
- [x] Cloudinary-backed exam/starter assets with local fallback.
- [x] Student workspace creation, starter-code installation and submission upload.
- [x] Teacher submission browsing and security-log reports.
- [x] USB/window/clipboard/filesystem sensor foundation and live violation feed.
- [x] Offline violation queue/logging foundation.
- [x] Admin security audit page, account disable and session revocation.
- [x] XSS, CSRF, IDOR, brute-force, upload and WebSocket hardening foundation.

