# QuizWave (Mentimeter 2.0) 🌊

> A high-performance, real-time interactive quiz platform featuring multimedia questions (images, videos, and audio clues), visual multimedia answer choices, speed-weighted live leaderboards, and an unbiased Host live controller.

Built in strict compliance with [`system.md`](file:///C:/Users/SHRUTIKA/OneDrive/Desktop/Menti_Meter_2.0/system.md) and [`architecture.md`](file:///C:/Users/SHRUTIKA/OneDrive/Desktop/Menti_Meter_2.0/architecture.md).

---

## 🌟 Key Capabilities

### 1. Dual User Roles & Dedicated Workflows
- **Host**:
  - **Host Authentication (FR-A1)**: Email + password registration and login, with 1-click Quick Demo Host ("Professor Alex").
  - **Quiz Studio (FR-H1, FR-H2, FR-H3)**: Full quiz builder with reordering, base points, and configurable per-question time limits (5s–120s).
  - **Multimedia Questions**: Supports **Images** (jpg/png/webp, up to 5MB), **Videos** (mp4/webm, up to 50MB) with or without separate audio, and **Audio/Voice notes** (mp3/wav/m4a, up to 10MB).
  - **Multimedia Answer Choices (FR-1)**: Answer options support text, images, and video clips for rich visual trivia.
  - **Host Live Controller with Privacy (FR-H3S)**: During live rounds, the host screen displays **only** live ranking, response count, connected students, and flow controls. The host never receives question text or answer keys during live play.
  - **Post-Session Analytics (FR-H4S)**: After the session ends, full question solutions unlock alongside per-question accuracy rates, student response counts, and answer distribution charts.
- **Student**:
  - **Zero-Friction Join (FR-A2)**: Join via 6-digit Game PIN (e.g. `583-921`), scannable QR code, or direct join link. No account required.
  - **Personalized Profile**: Choose a nickname and pick from 16 emoji avatars.
  - **Real-Time Synchronized Player Screen (FR-S2)**: Countdown gauge with animated SVG urgency levels, embedded video player, image clue viewer, and responsive waveform audio player with browser autoplay fallback.
  - **Tactile Option Buttons**: Color-coded option tiles (▲ Red, ◆ Blue, ● Yellow, ■ Green, ✦ Purple, ★ Teal) with support for option images and video clips.
  - **Immediate Feedback & Podium (FR-S4, FR-S5)**: Score breakdown, points earned, correct answer reveal, sound effects (synthesized with Web Audio API), and final podium with celebratory confetti.

### 2. Speed-Weighted Scoring Engine
Accurately implements the mathematical model specified in Section 3 of `system.md` and `architecture.md`:

$$\text{points} = \begin{cases} \operatorname{round}\left(\text{BASE} \times \left(0.5 + 0.5 \times \frac{\text{time\_remaining}}{\text{time\_limit}}\right)\right) & \text{if answer is correct} \\ 0 & \text{if incorrect or timeout} \end{cases}$$

- `BASE = 1000` points (configurable per quiz).
- Fastest correct answer scores up to 1,000 pts; last-second answer scores ~500 pts.
- Anti-cheat: Server-authoritative timer, strictly 1 answer per student per question while in `OPEN` state.
- Automated tie-breaking: Higher total score $\rightarrow$ More correct answers $\rightarrow$ Lower cumulative response time.

### 3. Dual-Engine Real-Time Communication
- **Live Backend Mode**: Connected via REST API and Socket.io gateway running on port 4000. Provides real-time rooms (`host`, `students`, `participant`) with low-latency event fan-out.
- **Local Simulation Bus (`BroadcastChannel`)**: Automatically synchronizes state across multiple browser tabs or windows on the developer's computer even when the backend is offline.
- **Split-Screen Interactive Demo**: Built-in 1-click simulator that places the Host controller and simulated Student phones side-by-side in a single window for rapid testing.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ (tested on Node 22+)
- npm v9+

### Running Frontend & Backend

Open two terminals (or run via npm scripts):

#### Terminal 1 — Backend (Express + Socket.io on Port 4000)
```bash
npm run dev:backend
```
Backend will start on:
- REST API: `http://localhost:4000/api`
- WebSocket: `ws://localhost:4000` (Socket.io)
- Uploaded Media: `http://localhost:4000/media`

#### Terminal 2 — Frontend (React 19 + Vite on Port 5173)
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser. The navigation bar will display a 🟢 **Backend Live** badge indicating an active connection.

---

## 🧪 Verification & Smoke Testing

To run the automated end-to-end smoke test suite covering auth, quiz creation, live session orchestration, anti-cheat, scoring, and post-session analytics:

```bash
npm run smoke
```

To run TypeScript verification across frontend and backend:
```bash
npm run typecheck
npm run build
```

---

## 📁 Repository Structure

```
Menti_Meter_2.0/
├── system.md                    # Complete system functional specification
├── architecture.md              # System architecture, event flow & scoring spec
├── package.json                 # Root script runner (dev, build, smoke, typecheck)
├── README.md                    # Project documentation
│
├── backend/                     # Node.js + Express + TypeScript + Socket.io
│   ├── src/
│   │   ├── config/env.ts        # Environment configuration
│   │   ├── middleware/          # JWT auth & error handling middleware
│   │   ├── routes/              # auth, quizzes, sessions, media upload routes
│   │   ├── services/            # auth, quiz, session, scoring services
│   │   ├── storage/             # In-memory storage & Postgres/Redis adapter interfaces
│   │   ├── types/               # Domain models & DTOs
│   │   ├── utils/               # ID generation & Zod validation schemas
│   │   ├── ws/gateway.ts        # Socket.io gateway & real-time room handlers
│   │   ├── app.ts               # Express app configuration & rate limiting
│   │   └── index.ts             # Server entry point
│   ├── scripts/smoke.mjs        # 30-assertion automated smoke test suite
│   ├── uploads/                 # Local uploaded images, audio, and videos
│   ├── .env                     # Backend environment configuration
│   └── package.json
│
└── frontend/                    # React 19 + TypeScript + Vite + Tailwind CSS v4
    ├── src/
    │   ├── types/quiz.ts        # Frontend TypeScript interfaces & DTOs
    │   ├── services/
    │   │   ├── api.ts           # REST API client & remote/local mode detector
    │   │   ├── realtimeEngine.ts# Dual-mode realtime facade (Socket.io + BroadcastChannel)
    │   │   ├── storage.ts       # Storage service with seed showcase quizzes
    │   │   └── audioEffects.ts  # Web Audio API procedural sound synthesizer
    │   ├── components/
    │   │   ├── Navbar.tsx       # Navigation bar with connection pill & auth trigger
    │   │   ├── HostAuthModal.tsx# Host Login, Register & 1-click Demo Host modal
    │   │   ├── AudioPlayer.tsx  # Waveform audio player with autoplay fallback
    │   │   ├── VideoPlayer.tsx  # Video player for questions and multimedia options
    │   │   ├── TimerGauge.tsx   # SVG countdown timer with urgency transitions
    │   │   ├── QRCodeModal.tsx  # Dynamic QR code modal for mobile players
    │   │   └── SplitScreenDemo.tsx # Side-by-side host/student simulator
    │   └── views/
    │       ├── LandingView.tsx  # Hero page with quick PIN join & Host CTA
    │       ├── HostDashboardView.tsx # Host quiz manager (CRUD, duplicate, launch)
    │       ├── QuizBuilderView.tsx   # Question editor (multimedia options, timers, audio)
    │       ├── HostLiveView.tsx      # Unbiased Host live controller & post-session analytics
    │       ├── StudentJoinView.tsx   # Student PIN, nickname, and avatar selector
    │       └── StudentLiveView.tsx   # Student live question, feedback & podium view
    ├── .env                     # Frontend environment configuration (VITE_API_URL)
    └── package.json
```

---

## 🎮 How to Test Live Multiplayer

### Mode 1: Built-in Split-Screen Simulator (Quickest)
1. Click the **"Split Screen Demo"** button in the top navigation bar.
2. The Host screen appears on the left, and a simulated Student phone appears on the right.
3. Click **"Start Quiz"** on the host screen to test synced question reveals, audio clues, timers, answer submissions, and live leaderboard updates.

### Mode 2: Multi-Window Live Game
1. In Window 1, click **"Host Studio"** (or **"Host Login"** $\rightarrow$ 1-Click Demo Host) and click **"Launch Live Session"** on any quiz.
2. Note the 6-digit Game PIN (e.g. `583-921`) or click **"Copy Join Link"**.
3. In Window 2 (or a phone / incognito browser), go to [http://localhost:5173](http://localhost:5173), enter the PIN, choose an avatar and nickname, and join.
4. The Host lobby immediately shows the joined player.
5. Click **"Start Quiz"** in Window 1 and answer on Window 2 in real time!
