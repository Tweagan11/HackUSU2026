# Code Sergeant

> **1st Place -- Tool Development Category @ HackUSU 2026**

A VS Code extension that hijacks your editor with a drill-sergeant-themed code reviewer. Code Sergeant scans your codebase for bugs, challenges you to fix them under pressure, and yells at you if you fail. Fail enough times, and it **calls you on the phone** to chew you out.

Built in 24 hours at **HackUSU 2026** (February 27-28, 2026) by **Team ZDT+C**:

-   **Chase Hammond**
-   **Dennis Panchekha**
-   **Zach Royer**
-   **Teagan Smith**

---

## How It Works

1.  **Auto-triggers** when you run code, open a terminal, or start a debug session
2.  **Locks your editor** in a fullscreen retro-military webview you can't escape
3.  **Scans your codebase** for bugs using a LangGraph agent (GPT-4.1-mini + ChromaDB RAG)
4.  **Generates a timed challenge** -- a buggy code snippet inspired by real bugs in your project, with 90 seconds on the clock
5.  **Grades your fix** with the LLM
6.  **Pass** -- confetti, a medal, and Sergeant Debugger salutes you
7.  **Fail** -- screen shake, angry sergeant, creative punishments escalating from insults to **real phone calls**

---

## The Punishment Ladder

Strike

Punishment

1st fail

Creative drill-sergeant insult + mandatory "write lines" (type a phrase 3-15 times before retry unlocks)

2nd fail

More severe insults, longer write-lines

3rd+ fail

**Email to your boss** -- a formal "disciplinary report" describing your failures

Final resort

**Phone call from Sergeant Debugger** via Twilio + ElevenLabs TTS -- a multi-turn voice conversation about your bugs

---

## Architecture

```
┌─────────────────────────────────────────────┐│         VS Code Extension (TypeScript)       ││   Locked Webview <-> React + Monaco Editor    │└───────────────────┬─────────────────────────┘                    │ WebSocket + HTTP┌───────────────────▼─────────────────────────┐│          FastAPI Server (Python)              ││    /start  /submit  /timeout  /ws  /call/*   │└───────────────────┬─────────────────────────┘                    │┌───────────────────▼─────────────────────────┐│         LangGraph Agent (3-phase)            ││  Bug Discovery -> Challenge Gen -> Grading    ││  GPT-4.1-mini + ChromaDB RAG                │└───────────────────┬─────────────────────────┘                    │        ┌───────────┼───────────┐        ▼           ▼           ▼    Twilio      ElevenLabs    Resend  (phone calls)   (TTS)   (boss emails)
```

### Extension Host (`src/extension.ts`)

-   Registers the `code-sergeant.drill` command
-   Auto-triggers on terminal execution of `python`, `node`, `go run`, `cargo run`, `npm run`, etc.
-   Spawns the Python FastAPI server, auto-creating a `.venv` and installing dependencies
-   Opens a **locked webview panel** that re-opens itself if closed
-   Bridges WebSocket messages between the backend and React frontend

### Frontend (`src/frontend/`)

-   **React** app rendered inside the VS Code webview
-   **Monaco Editor** for editing the buggy code challenge
-   **Retro pixel-art military UI** with CRT scanlines, radar animations, and screen shake effects
-   **Web Audio API** speech blips (Undertale-style square-wave oscillator), klaxon alarms, sonar pings, anger rumbles
-   State machine: `BOOTING -> BUG_ALERT -> TRAINING_SPLASH -> BRIEFING_HOLD -> IDLE -> ANALYZING -> RESULT -> MISSION_COMPLETE`

### Agent (`agent/`)

-   **LangGraph** 3-phase state machine:
    -   **Phase 1 -- Bug Discovery**: RAG search over your codebase via ChromaDB, producing a structured `BugReport`
    -   **Phase 2 -- Challenge Generation**: Creates a new buggy snippet inspired by discovered bugs
    -   **Phase 3 -- Grading Loop**: Grades the fix, assigns punishments on failure, retries up to the limit
-   Supports Python, JavaScript, TypeScript, Java, C/C++, Go, Ruby, and Rust files

### Server (`server/`)

-   **FastAPI** with real-time **WebSocket** state push
-   **ngrok** tunnel for Twilio webhook callbacks
-   Phone call system: Twilio outbound calls, ElevenLabs TTS, speech recognition, and multi-turn conversation in the sergeant persona

---

## Tech Stack

Layer

Technologies

Extension

TypeScript, VS Code Extension API, WebSocket (`ws`)

Frontend

React, Monaco Editor, Web Audio API, CSS animations

Backend

Python, FastAPI, uvicorn

AI Agent

LangGraph, LangChain, OpenAI GPT-4.1-mini, ChromaDB, OpenAI Embeddings

Phone Calls

Twilio (outbound calls, TwiML, speech recognition), ElevenLabs (TTS)

Email

Resend API

Tunneling

pyngrok (ngrok)

Testing

pytest, FastAPI TestClient, httpx AsyncClient

Build

webpack, ESLint, TypeScript

---

## Getting Started

### Prerequisites

-   **Node.js** (v18+)
-   **Python** (3.10+)
-   **VS Code** (1.109+)

### Installation

```bash
# Clone the repogit clone https://github.com/your-org/HackUSU2026.gitcd HackUSU2026/code-sergeant# Install Node dependenciesnpm install# Install Python dependencies (or let the extension auto-create a venv)pip install -r server/requirements.txt
```

### Environment Variables

Create a `.env` file in `code-sergeant/server/` with the following keys:

```env
# RequiredOPENAI_API_KEY=sk-...# Phone calls (optional, needed for call punishment)TWILIO_ACCOUNT_SID=AC...TWILIO_AUTH_TOKEN=...TWILIO_PHONE_NUMBER=+1...ELEVENLABS_API_KEY=...ELEVENLABS_VOICE_ID=...# Boss email (optional, needed for email punishment)RESEND_API_KEY=re_...RESEND_FROM_ADDRESS=sergeant@yourdomain.com# Contact info (optional)RECRUIT_EMAIL=you@example.comBOSS_EMAIL=boss@example.comRECRUIT_PHONE=+1234567890# ngrok (optional, for Twilio webhooks)NGROK_DOMAIN=your-domain.ngrok-free.app
```

### Running

Press **F5** in VS Code to launch the extension in a development host. The extension will auto-start the FastAPI server and open the drill webview.

Or manually:

```bash
# Buildnpm run compile# Start the server separately (optional)cd server && python main.py
```

### Scripts

Command

Description

`npm run compile`

Build extension + webview

`npm run watch`

Watch-mode TypeScript compilation

`npm run lint`

Run ESLint

`npm run test`

Run extension tests

---

## Testing

```bash
# Server tests (from code-sergeant/server/)pytest# Includes:#   - API endpoint tests (health, start, submit, timeout, state)#   - Call router tests (Twilio/ElevenLabs mocked)#   - End-to-end integration tests (full agent workflows)
```

---

## Project Structure

```
HackUSU2026/├── README.md├── buggy_code/               # Example buggy files for demo│   └── stats.py├── buggy_code_2/│   └── inventory.js└── code-sergeant/    ├── package.json    ├── tsconfig.json    ├── webpack.config.js    ├── agent/                # LangGraph AI agent    │   ├── agent.py          #   Graph definition and entry points    │   ├── nodes.py          #   LLM call, grading, punishment nodes    │   ├── state.py          #   Agent state schema    │   ├── tools.py          #   RAG search, punishment, email, call tools    │   └── utils.py          #   ChromaDB vector store builder    ├── server/               # FastAPI backend    │   ├── main.py           #   API endpoints & WebSocket    │   ├── call_router.py    #   Twilio/ElevenLabs phone call system    │   ├── requirements.txt    │   └── tests/            #   pytest test suite    └── src/        ├── extension.ts      # VS Code extension entry point        └── frontend/         # React webview app            ├── App.tsx            ├── bridge.ts     #   Webview <-> Extension messaging            ├── reducer.ts    #   State machine            ├── speechBlip.ts #   Retro audio effects            ├── styles.css    #   Pixel-art military CSS theme            └── components/   #   UI components
```

---

## License

Built for HackUSU 2026.