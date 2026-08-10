# 🚀 PROCTR System Development — Week 6 Progress Report

**Project Title:** PROCTR — Automated Exam Monitoring & Security System  
**Date:** August 10, 2026  
**Week Focus:** Week 6 — Offline-First Logging, Cloud Storage Integration, Session Persistence, Exam Expiry Engine, Synchronized Live Timer & OS Sensor Enhancements

---

## 📌 Executive Summary

During **Week 6**, major reliability, security, and resilience features were implemented across the **PROCTR Desktop Application** and **Express/Node.js Backend**. 

Key accomplishments include:
1. **Offline-First Storage Architecture & Resiliency (`offlineQueue.js`)**: Protection against intentional or unintentional network drops during live exams via local file logging and auto-sync queue.
2. **Cloudinary CDN Integration**: Cloud file storage support for exam paper PDFs and user avatars with automatic local fallback.
3. **Session Persistence**: Complete session restoration across app reloads (`Ctrl+R` / `Ctrl+Shift+R`) preventing accidental logouts.
4. **Exam Date Expiry & Lifecycle Engine**: Smart status handling for past, active, conducted, and unconducted exams.
5. **Synchronized Live Countdown Timer & 5-Minute Warning**: Real-time `1h 30m 0s` countdown display with an animated 5-minute remaining submission warning banner.
6. **OS-Level Sensor Audit & Starter Code Exemption Design**: Status review of Python OS sensors (~75% complete) and architectural design for Teacher Starter Code exception filtering.

---

## 🔑 Deliverables & Technical Implementation

### 1. 💾 Offline-First Storage & Network Interruption Handling (`offlineQueue.js`)
- **Problem Addressed**: If internet connection drops (or is intentionally turned off by a student), violation alerts and session logs were previously lost.
- **Solution**:
  - **Local Disk Log (`C:\PROCTR_Exams\offline_logs\`)**: Every security event and violation is written immediately to a local JSON file (`offline_log_YYYY-MM-DD.json`) via Electron IPC `write-local-log`.
  - **Offline Queue**: Failed backend API calls are saved in `localStorage` under `proctr_offline_queue`.
  - **Auto-Sync Flush**: Listens for the browser/Electron `online` event to automatically flush queued items to the backend in batches.
  - **Real-Time Status Badge**: Floating UI indicator displays `🟢 Online (x pending)` or `🔴 Offline — Logs saved locally`.

### 2. ☁️ Cloudinary CDN Storage Integration (`upload.js`)
- **Exam Papers & Profile Pictures**: Upgraded file upload pipeline using `multer-storage-cloudinary` to store approved exam question PDFs and user avatars on Cloudinary's global CDN.
- **Graceful Local Fallback**: If Cloudinary environment variables (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`) are not set, the backend seamlessly falls back to local disk storage (`uploads/` directory) with zero breaking changes.
- **Unified `getFileUrl` Helper**: Controllers (`teacherController.js`, `authController.js`) automatically resolve file URLs regardless of the storage backend active.

### 3. 🔄 Session Persistence Across Reloads
- **Persistent State**: Integrated `saveSession()`, `restoreSession()`, and `clearSession()` in `app.js` using `localStorage`.
- **Reload Safety**: Normal reload (`Ctrl+R`) or forced reload (`Ctrl+Shift+R`) inside the Electron desktop client restores the active user profile (Student Dashboard or Teacher Overview) without kicking the user back to the login screen.
- **Clean Logout**: Explicitly clicking "Logout" clears the stored session and returns to authentication safely.

### 4. 📅 Exam Date Expiry & Status Engine
- **Date+Time Comparison**: Evaluates `exam_date` and `end_time` against current system time (`Date.now()`).
- **Student View Protection**: If an exam date has passed, student join controls are disabled with status `📅 Exam Date Passed`.
- **Teacher View Differentiation**:
  - **Conducted Exam (Date Passed + Submissions > 0)**: Displays `📁 View Submissions & Logs`.
  - **Unconducted Exam (Date Passed + Submissions = 0)**: Displays red status badge `❌ Exam Not Conducted`.

### 5. ⏱️ Synchronized Live Countdown Timer & 5-Minute Warning
- **Human-Readable Format**: Upgraded countdown timer format to display `1h 30m 0s` ➔ `1h 29m 59s`.
- **Dual-Side Synchronization**: Live countdown updates synchronously in the Invigilator Live Control Room (`#teacher-timer`) and Student Exam Environment (`#student-room-timer`).
- **Low-Overhead Ticking**: Uses client-side local 1-second interval ticking with periodic 5s/10s server syncs to prevent server overload.
- **5-Minute Warning Banner**: Automatically displays a pulsing alert banner (`⏰ Only 5 Minutes Remaining! Please save and Submit your work now`) when $\le 300\text{s}$ remain.

### 6. 🛡️ OS-Level Monitoring & Teacher Starter Code Exemption (Architecture)
- **Current OS Sensor Audit (~75% Complete)**:
  - `USBSensor` (H1): Detects removable USB drives via `win32file`.
  - `WindowSensor` (H2 & H3): Tracks active foreground window titles and focus loss >15s.
  - `ClipboardSensor` (H4a): Intercepts copy-paste buffers >300 characters.
  - `FileSystemSensor` (H4b): Watches workspace directory changes via `watchdog`.
- **Teacher Starter Code Safe-Zone (Planned Enhancement)**:
  - Active window or clipboard contents originating from teacher-provided starter code files will be exempted from triggering H2/H4a violations.
  - Will be passed to the Python sensor engine via CLI arguments (`--starter_files`).

---

## 📊 Summary of Week 6 Changes

| Component | Status | Verification / Action |
|---|---|---|
| **Offline Log Buffer** | ✅ Implemented | Written to `C:\PROCTR_Exams\offline_logs\` |
| **Offline API Queue** | ✅ Implemented | Queued in `localStorage` & auto-synced on reconnect |
| **Cloudinary Integration** | ✅ Implemented | Configured with local disk fallback |
| **Session Persistence** | ✅ Implemented | Verified across page reloads |
| **Exam Date Expiry** | ✅ Implemented | Verified for conducted vs unconducted exams |
| **Live Timer & 5m Alert** | ✅ Implemented | Verified on Teacher & Student screens |
| **OS Sensors (H1 - H4b)** | ✅ Operational | ~75% complete, stdout IPC connected |
| **Starter Code Exemption** | 📐 Architecture Ready | Scheduled for next implementation phase |

---

*Report compiled for PROCTR FYP Week 6 project tracking and documentation.*
