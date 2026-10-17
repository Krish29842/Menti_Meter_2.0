# System Specification: QuizWave
A Mentimeter-style live quiz platform with two roles (Host & Student), multimedia questions (image + optional audio), and a speed-weighted leaderboard.

---

## 1. Goals & Scope

### In Scope (MVP)
- Two login types: **Host** and **Student**
- Host can create quizzes containing questions
- Each question supports:
  - Text prompt (required)
  - Image upload/URL (optional)
  - Audio/voice-note upload/URL (optional)
  - Multiple-choice answers (2–6 options) with one correct answer
  - Per-question time limit (default 20s)
- Host can launch a live quiz session
- During a live session:
  - Students see the current question, image, and can play audio
  - Students submit an answer within a time limit
  - Host sees **only the leaderboard & session controls** (not the questions during live mode)
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
| **Host**    | Creates quizzes, uploads media, launches sessions, controls quiz flow, views live leaderboard & post-session analytics |
| **Student** | Joins a session via 6-digit code or link + display name, answers questions on their device, sees live feedback & ranking |

---

## 3. Functional Requirements

### 3.1 Authentication
- **FR-A1**: Host registers/logs in with email + password (with demo quick-login support).
- **FR-A2**: Student joins a session using **session code** + display name (no account required).
- **FR-A3**: Role is enforced at API and UI level.

### 3.2 Host — Quiz Builder
- **FR-H1**: Create, edit, duplicate, and delete quizzes.
- **FR-H2**: Add questions with:
  - Prompt text
  - Optional image (jpg/png/webp, max 5 MB)
  - Optional audio (mp3/wav/m4a/ogg, max 10 MB)
  - 2–6 answer options, exactly one marked correct
  - Per-question time limit (default 20s, configurable 5s–120s)
  - Base points per question (default 1000)
- **FR-H3**: Reorder questions (drag & drop or move up/down).
- **FR-H4**: Preview quiz before launch.

### 3.3 Host — Live Session Control
- **FR-H1S**: Start a session → generates a 6-digit session code + join link + QR code.
- **FR-H2S**: Host dashboard during live session shows **only**:
  - Current question number / total
  - Number of students connected & joined lobby list
  - Live leaderboard (rank, name, score, delta points)
  - "Next question" / "End session" / "Show results" controls
- **FR-H3S**: Host cannot view question content or student answer choices during live mode (enforced by UI + API response shaping).
- **FR-H4S**: After session ends, host can view full results (per-question statistics, accuracy rates, student breakdown).

### 3.4 Student — Live Session
- **FR-S1**: Join via session code → wait in lobby until host starts.
- **FR-S2**: On question reveal, see:
  - Question text
  - Image (if any)
  - Audio play button / waveform (if any)
  - Color-coded answer option buttons
  - Real-time countdown timer & progress bar
- **FR-S3**: Submit **one** answer per question; locked after submit or timeout.
- **FR-S4**: See own score + rank after each question closes (score breakdown + correct/incorrect status).
- **FR-S5**: See final podium & leaderboard at end.

### 3.5 Scoring (Leaderboard Principle)
- Only **correct** answers score points.
- Points formula:
  $$\text{points} = \text{round}\left(\text{BASE} \times \left(0.5 + 0.5 \times \frac{\text{time\_remaining}}{\text{time\_limit}}\right)\right)$$
  *(Or linear speed-scale: $\text{BASE} \times \frac{\text{time\_remaining}}{\text{time\_limit}}$, min 100 pts for correct)*
- `BASE = 1000` (configurable per quiz)
- `time_remaining` = seconds left when submitted (server-measured)
- Fastest correct answer → up to 1000 pts; last-second correct → near 500 (or near 0); incorrect or timeout → 0 pts.
- Ties broken by: higher total score → more correct answers → lower cumulative response time.

### 3.6 Media Handling
- Images and audio stored in object storage (S3-compatible) or local media assets.
- Host uploads via pre-signed URL or direct upload.
- Students stream/play audio with responsive audio controls and fallback if autoplay is blocked.

### 3.7 Anti-Cheat & Fairness
- Server-authoritative timer.
- One answer per student per question.
- Answers accepted only while question state = `OPEN`.

---

## 4. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Latency** | Question push → student screen < 500 ms p95 |
| **Concurrency** | 200 students per session, 50 concurrent sessions |
| **Availability** | 99.5% uptime target |
| **Security** | JWT auth, HTTPS/WSS, role-based access control, sanitization |
| **Responsiveness** | Mobile-first student UI, projector/desktop friendly host UI |
| **Browsers** | Latest Chrome, Firefox, Safari, Edge (iOS/Android/Desktop) |

---

## 5. Tech Stack (Proposed)

| Layer | Choice |
|---|---|
| **Frontend** | React 18/19 + TypeScript + Vite + Tailwind CSS + Lucide Icons |
| **Realtime** | WebSocket / Socket.io client (with BroadcastChannel multi-tab local testing bridge) |
| **State Management** | Zustand or React Context with robust lifecycle stores |
| **Animations / Confetti** | Canvas Confetti, Framer Motion / CSS keyframes |
| **Backend** | Node.js (Express / Fastify / NestJS) + TypeScript |
| **Database & Cache** | PostgreSQL (source of truth) + Redis (Pub/Sub & session state) |
| **Media Storage** | S3 / MinIO / Cloudflare R2 |
