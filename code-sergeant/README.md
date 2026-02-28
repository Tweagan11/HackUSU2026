# Code Sergeant

A VS Code extension that acts as a drill-sergeant code reviewer. Code Sergeant finds bugs in your code, challenges you to fix them under pressure, and yells at you (with love) if you fail.

## Architecture

- **`src/`** — TypeScript VS Code extension + React webview frontend
- **`agent/`** — Python LangGraph agent for code analysis (ChromaDB-backed)
- **`server/`** — FastAPI server with Twilio phone-call integration & ElevenLabs TTS

## Getting Started

1. `npm install`
2. `pip install -r server/requirements.txt`
3. Copy `.env.example` to `.env` and fill in API keys
4. Press **F5** to launch the extension in a dev host

## Scripts

| Command | Description |
|---------|-------------|
| `npm run compile` | Build extension + webview |
| `npm run watch` | Watch-mode TypeScript compilation |
| `npm run lint` | ESLint |

