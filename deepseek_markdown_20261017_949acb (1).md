# System Specification: QuizWave
A Mentimeter-style live quiz platform with two roles (Host & Student),
multimedia questions (image + optional audio), and a speed-weighted leaderboard.

---

## 1. Goals & Scope

### In Scope (MVP)
- Two login types: **Host** and **Student**
- Host can create quizzes containing questions
- Each question supports:
  - Text prompt (required)
  - Image upload (optional)
  - Audio/voice-note upload (optional)
  - Multiple-choice answers (2–6 options) with one correct answer
- Host can launch a live quiz session
- During a live session:
  - Students see the current question, image, and can play audio
  - Students submit an answer within a time limit
  - Host sees **only the leaderboard** (not the questions)
- Leaderboard scoring: correct + faster = more points
- Persistent leaderboard per session

### Out of Scope (MVP)
- Word clouds, open-ended text, polls (future)
- Team mode / multiplayer grouping
- Video questions
- Mobile native apps (web responsive only)
- Payments / subscriptions

---

## 2. User Roles

| Role    | Description |
|---------|-------------|
| Host    | Creates quizzes, uploads media, launches sessions, views live leaderboard |
| Student | Joins a session via code/link, answers questions, sees their score |

---

## 3. Functional Requirements

### 3.1 Authentication
- FR-A1: Host registers/logs in with email + password (or OAuth).
- FR-A2: Student joins a session using **session code** + display name (no full account required for MVP; optional lightweight account later).
- FR-A3: Role is enforced at API level (middleware checks JWT role claim).

### 3.2 Host — Quiz Builder
- FR-H1: Create / edit / delete quizzes.
- FR-H2: Add questions with:
  - Prompt text
  - Optional image (jpg/png/webp, max 5 MB)
  - Optional audio (mp3/wav/m4a, max 10 MB)
  - 2–6 answer options, exactly one marked correct
  - Per-question time limit (default 20s)
- FR-H3: Reorder questions (drag & drop).
- FR-H4: Preview quiz before launch.

### 3.3 Host — Live Session Control
- FR-H1S: Start a session → generates a 6-digit session code + join link.
- FR-H2S: Host dashboard during live session shows **only**:
  - Current question number / total
  - Number of students connected
  - Live leaderboard (rank, name, score)
  - "Next question" / "End session" controls
- FR-H3S: Host cannot view question content or student answers during live mode (enforced by UI + API response shaping).
- FR-H4S: After session ends, host can view full results (per-question stats).

### 3.4 Student — Live Session
- FR-S1: Join via session code → wait in lobby until host starts.
- FR-S2: On question reveal, see:
  - Question text
  - Image (if any)
  - Audio play button (if any)
  - Answer option buttons
  - Countdown timer
- FR-S3: Submit **one** answer per question; locked after submit or timeout.
- FR-S4: See own score + rank after each question (aggregate feedback shown after question closes, not revealing correct answer mid-question).
- FR-S5: See final leaderboard at end.

### 3.5 Scoring (Leaderboard Principle)
- Only **correct** answers score points.
- Points per correct answer: