# QuizWave (Mentimeter 2.0) 🌊

> A real-time, Mentimeter-style live quiz platform featuring multimedia questions (image + audio clues), a speed-weighted leaderboard, and an unbiased Host live controller.

Built in strict compliance with [`system.md`](file:///C:/Users/SHRUTIKA/OneDrive/Desktop/Menti_Meter_2.0/system.md) and [`architecture.md`](file:///C:/Users/SHRUTIKA/OneDrive/Desktop/Menti_Meter_2.0/architecture.md).

---

## 🌟 Key Features

### 1. Dual User Roles
- **Host**:
  - Full Quiz Builder with drag-and-drop / reordering, base points, and per-question time limits.
  - Multimedia questions supporting both **HD Images** and **Audio / Voice clues** with a responsive waveform player.
  - Live Session Controller with **Host Privacy (FR-H3S)**: Host sees *only* connection metrics and live animated leaderboards during live questions (no question spoilers or answer keys!).
  - Post-session review unlocking full question solutions and student accuracy statistics (**FR-H4S**).
- **Student**:
  - Zero-friction join via 6-digit Game PIN, scannable QR code, or direct link.
  - Personalized nickname & avatar selector (16 fun emoji avatars).
  - Synchronized countdown gauge with real-time sound cues (Web Audio API synthesized ticks, warning pulses, and chimes).
  - High-contrast, tactile multiple-choice buttons (▲ Red, ◆ Blue, ● Yellow, ■ Green, ✦ Purple, ★ Teal).
  - Immediate post-round feedback (correct/incorrect, points earned, current leaderboard standing).
  - Celebratory final podium with confetti!

### 2. Speed-Weighted Scoring Engine
Accurately implements the mathematical model specified in Section 3 of `architecture.md`:
$$\text{points} = \text{round}\left(\text{BASE} \times \left(0.5 + 0.5 \times \frac{\text{time\_remaining}}{\text{time\_limit}}\right)\right)$$
- Correct answers award up to 1,000 points based on speed.
- Incorrect or timed-out answers award 0 points.
- Ties are broken automatically by cumulative score, correct answers count, and cumulative response time.

### 3. Dual-Engine Real-Time Communication
- **Production Mode**: Ready for WebSocket / Socket.io server connection.
- **Local Simulation Bus (`BroadcastChannel`)**: Automatically synchronizes state across multiple browser tabs and windows on your computer without requiring any external Redis or database setup!
- **Interactive Split-Screen Demo**: Built-in 1-click simulator that places the Host controller and simulated Student phones side-by-side on one screen.

---

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ (tested with v24)
- npm v9+

### Running the Frontend
From the root directory:
```bash
npm run dev
```
Or from within `frontend/`:
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🎮 How to Test Live Multiplayer

### Option A: Built-in Split-Screen Demo (Easiest)
1. Click the **"Split Screen Demo"** button in the top navigation bar.
2. The Host screen appears on the left, and a simulated Student phone appears on the right.
3. Click **"Start Quiz"** on the host screen to test synced question reveals, audio clues, timers, answer submissions, and live leaderboard updates.

### Option B: Multi-Tab Live Testing
1. In Tab 1, navigate to **Host Studio** (`/host/dashboard`) and click **"Launch Live Session"** on any quiz.
2. Note the 6-digit Game PIN (e.g. `583-921`) or click **"Copy Join Link"**.
3. In Tab 2 (or a mobile phone on the same Wi-Fi / incognito window), open the join link or enter the PIN on the home page.
4. Pick an avatar and nickname. The Host lobby instantly shows your avatar pop in!
5. Hit **"Start Quiz"** in Tab 1 and play along in Tab 2 in real time.

---

## 📁 Project Structure

```
Menti_Meter_2.0/
├── system.md                    # Complete system functional specification
├── architecture.md              # High-level architecture & real-time spec
├── package.json                 # Root script runner
├── README.md                    # Project documentation
└── frontend/                    # React 19 + TypeScript + Vite + Tailwind CSS v4
    ├── src/
    │   ├── types/
    │   │   └── quiz.ts          # Core data models (Quiz, Question, Participant, DTOs)
    │   ├── services/
    │   │   ├── audioEffects.ts  # Web Audio API sound synthesizer (ticks, chords, fanfare)
    │   │   ├── realtimeEngine.ts# Real-time event bus (BroadcastChannel + WS ready)
    │   │   └── storage.ts       # LocalStorage CRUD + pre-loaded sample quizzes
    │   ├── components/
    │   │   ├── Navbar.tsx       # Brand header, sound toggle & view switcher
    │   │   ├── AudioPlayer.tsx  # Waveform audio player with autoplay fallback
    │   │   ├── TimerGauge.tsx   # SVG countdown timer with urgency transitions
    │   │   ├── QRCodeModal.tsx  # Dynamic QR code generator for easy mobile join
    │   │   └── SplitScreenDemo.tsx # Side-by-side host/student simulator
    │   └── views/
    │       ├── LandingView.tsx  # Home page with quick PIN join & feature showcase
    │       ├── HostDashboardView.tsx # Host quiz manager (CRUD, duplicate, launch)
    │       ├── QuizBuilderView.tsx   # Question editor (image/audio, options, time limit)
    │       ├── HostLiveView.tsx      # Unbiased Host live controller (FR-H3S compliant)
    │       ├── StudentJoinView.tsx   # Student PIN, nickname, and avatar selector
    │       └── StudentLiveView.tsx   # Student live question, feedback & podium view
```
