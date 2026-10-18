# System Architecture: QuizWave

## 1. High-Level Architecture

QuizWave is designed as an event-driven, real-time interactive quiz platform supporting two primary roles: **Host** and **Student**. The architecture cleanly decouples the host management and presentation interface from the high-throughput, low-latency student answering pipeline.

```
+-------------------------------------------------------------------------+
|                              CLIENT TIER                                |
|                                                                         |
|  +---------------------------+             +--------------------------+ |
|  |     Host Web SPA          |             |     Student Mobile/Web   | |
|  |  - Quiz Builder           |             |  - Lobby / Pin Join      | |
|  |  - Media Uploads          |             |  - Real-time Question UI | |
|  |  - Host Live Controller   |             |  - Audio Player & Options| |
|  |    (Leaderboard ONLY)     |             |  - Score / Rank Reveal   | |
|  +-------------+-------------+             +------------+-------------+ |
+----------------|----------------------------------------|---------------+
                 | HTTPS / WSS                            | HTTPS / WSS
+----------------v----------------------------------------v---------------+
|                   LOAD BALANCER & REVERSE PROXY                         |
|                   (TLS Termination, Rate Limiting, WSS)                 |
+--------------------------------+----------------------------------------+
                                 |
+--------------------------------v----------------------------------------+
|                     BACKEND SERVICES TIER (Node.js/TS)                  |
|                                                                         |
|  +-------------------------+             +---------------------------+  |
|  |     REST API Gateway    |             |    WebSocket Gateway      |  |
|  |  - Auth & JWT Service   |             |  - Room/Session Hub       |  |
|  |  - Quiz CRUD Service    |             |  - Live Question Streamer |  |
|  |  - Media Presigned URL  |             |  - Response Collector     |  |
|  |  - Session Lifecycle    |             |  - Scoring Engine         |  |
|  +------------+------------+             +-------------+-------------+  |
+---------------|----------------------------------------|----------------+
                |                                        |
+---------------v--------------------+ +-----------------v----------------+
|          DATA STORAGE              | |          REALTIME CACHE          |
|                                    | |                                  |
|   +----------------------------+   | |   +--------------------------+   |
|   |         PostgreSQL         |   | |   |      Redis Cluster       |   |
|   | - Users & Quizzes          |   | |   | - Session State (TTL)    |   |
|   | - Questions & Options      |   | |   | - Pub/Sub Fan-out        |   |
|   | - Sessions & Participants  |   | |   | - Leaderboard Sorted Set |   |
|   | - Historic Scores/Analytics|   | |   | - Distributed Locks      |   |
|   +----------------------------+   | |   +--------------------------+   |
+------------------------------------+ +----------------------------------+
                |
+---------------v--------------------+
|       OBJECT STORAGE + CDN         |
|   - S3 / R2 / MinIO (Images/Audio) |
|   - Signed CDN URLs for Streaming  |
+------------------------------------+
```

### Component Responsibilities

| Component | Responsibility |
|---|---|
| **Host SPA** | Quiz builder, question creation with image/video (with or without audio) and option images/videos, live session controls, and live leaderboard display. **Host sees only the leaderboard and controls during live mode** (no question spoilers). |
| **Student SPA** | Join lobby with 6-digit pin + name, view question prompt, play media (image/video/audio), interactive option media tiles (images/videos in answer choices), countdown timer, submit answer, view instant score feedback and podium. Mobile-first design. |
| **API Gateway / LB** | TLS termination, routing, rate limiting, request validation. |
| **Backend Service** | Business logic, JWT verification, session orchestration, scoring calculation. |
| **WebSocket Gateway** | Low-latency state synchronization (`session:started`, `question:open`, `question:closed`, `leaderboard:update`, `session:ended`). |
| **PostgreSQL** | Relational source of truth: users, quizzes, questions, answers, session archives, and final scores. |
| **Redis** | In-memory session state, distributed locks (`SETNX`), room pub/sub across backend pods, and `ZSET` for instant $O(\log N)$ real-time leaderboard ranking. |
| **Object Storage + CDN**| Secure storage of question & option media files (images, videos, audio) with signed URLs. |

---

## 2. Real-Time Architecture & Event Flow

### WebSocket State Machine
```
   [ LOBBY ] ----------> [ QUESTION_OPEN ] ----------> [ QUESTION_CLOSED ]
       ^                        |                              |
       |                        |                              |
       +-----------------(Next Question) <---------------------+
                                |
                          (All questions done)
                                |
                                v
                            [ ENDED ]
```

### Event Flow: Question Lifecycle
1. **Host advances**: Host clicks "Next Question" or "Start Quiz".
2. **Server Broadcast**:
   - `question:open` payload sent to Students: `{ questionId, prompt, imageUrl, audioUrl, options: [{id, text}], timeLimit, startedAt }`.
   - `question:open` payload sent to Host: `{ questionIndex, totalQuestions, status: 'active', timeLimit }` (*stripped of question content and answer keys*).
3. **Student submits**: `POST /sessions/:id/answer` or WS `answer:submit` with `{ questionId, optionId }`.
4. **Scoring Engine**: Evaluates validity, measures latency server-side, scores if correct.
5. **Question Close**: Timer expires or all students answer. Server broadcasts `question:closed` + `leaderboard:update`.
6. **Student Feedback**: Student screen shows whether their pick was correct, points earned, and current rank. Host screen updates the animated leaderboard.

---

## 3. Scoring Engine

### Scoring Formula
$$\text{points} = \begin{cases} \operatorname{round}\left(\text{BASE} \times \left(0.5 + 0.5 \times \frac{\text{time\_remaining}}{\text{time\_limit}}\right)\right) & \text{if answer is correct} \\ 0 & \text{if answer is incorrect or timeout} \end{cases}$$

- `BASE = 1000` (configurable per quiz)
- `time_remaining = max(0, deadline - submitted_at_server)`
- Fastest correct answer yields up to 1000 points; answers near the deadline yield 500 points.
- Leaderboard storage: Redis Sorted Set `ZADD leaderboard:{session_id} <score> <participant_id>`.

---

## 4. Security & Privacy Architecture

| Concern | Mitigation |
|---|---|
| **Role Separation** | JWT with role claims; middleware strictly guards `/host/*` and `/student/*`. |
| **Host Privacy in Live Mode** | Host never receives answer keys or question text during live sessions, guaranteeing unbiased hosting. |
| **Anti-Cheat** | Server-authoritative timer. Duplicate answers rejected with 409 Conflict. Option keys sanitized before transmission. |
| **Media Streaming** | Direct-to-storage signed URLs prevent unauthorized asset scraping. |

---

## 5. Frontend Architecture & Modular Design

The frontend is architected as a modern, unified single-page application with distinct route trees:
- `/` - Landing page with quick-join pin input and Host CTA.
- `/host/login` & `/host/register` - Host authentication (with 1-click guest/demo host mode).
- `/host/dashboard` - Host quiz management (create, edit, delete, preview, launch session).
- `/host/quiz-builder` & `/host/quiz-builder/:id` - Interactive question builder with image/audio support, option selector, reordering, and timer configuration.
- `/host/live/:sessionId` - Dedicated Host Live Session Controller displaying **exclusively** connection counts, question progress, live dynamic leaderboard, and next/end controls.
- `/join` & `/join/:pin` - Mobile-optimized student join flow with avatar picker.
- `/student/lobby/:sessionId` - Waiting lobby with interactive waiting animations and participant list.
- `/student/live/:sessionId` - Interactive live student screen with countdown gauge, media display (image + custom audio player), color-coded answer tiles, and post-question result banners.
- `/student/podium/:sessionId` & `/host/podium/:sessionId` - Celebratory podium with confetti, ranking badges, and performance breakdown.

### Local Simulation & Multi-Tab Synchronization
To enable testing without requiring external cloud databases or Redis instances immediately, the frontend incorporates a dual-mode communication layer:
1. **Live WebSocket Mode**: Connects to the QuizWave backend WebSocket server.
2. **Local Multi-Tab Simulation Engine (BroadcastChannel / LocalStorage)**: Allows opening a Host window and one or more Student windows in different browser tabs/windows or mobile browsers, enabling real-time quiz sessions directly on the developer's machine!
