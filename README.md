<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Ada Computing — Kinematic Engine

A React + TypeScript application that interprets user language through a "kinematic" reasoning model and an AI-assisted evaluation pipeline.

> **Important:** this app uses **Puter.js** as the primary AI provider (with free browser-side access), **not Gemini**.

## What the app does

The UI has 4 main tabs:

- **Ada** (`AdaConsole`) — chat-like interface where queries are analyzed, scored, and explained.
- **Solver** (`SemanticSolver`) — processes one-off natural language queries into a resolved "shape" with confidence and proof labeling.
- **Engine** (`WordMechanic`) — visual/mechanical breakdown of token and glyph structure.
- **Glyphs** (`GlyphLab`) — interactive explorer for glyph roles and physical semantics.

## How it works (end-to-end)

1. User enters a query in **Ada Console**.
2. `AdaEngine.process(...)` builds a structured governance prompt, includes recent session history, and requests strict JSON output.
3. `callFreeAI(...)` sends that request to **Puter.js** first.
   - Tries configured models in order (`gpt-4o-mini`, then `claude-3-5-haiku-latest`).
4. If Puter is unavailable/fails, the app falls back to Pollinations endpoints with retries + timeout logic.
5. Engine normalizes output into:
   - correctness / misconception scores
   - cognitive state + constraint status
   - proof labels and ledger steps
   - trajectory points + optional glyph analysis
6. UI renders the result card, confidence bars, trajectory chart, and exportable JSON shape object.

## AI provider stack

### Primary: Puter.js (no API key required)

- Loaded globally in `index.html` via:
  - `https://js.puter.com/v2/`
- Accessed from `window.puter.ai.chat(...)` in `services/aiClient.ts`.

### Fallback: Pollinations

- Proxied in dev through Vite (`/api/ai/pollinations/*`) to avoid CORS/firewall issues.
- Direct endpoint fallback is also configured for non-proxied scenarios.

## Local development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Run

```bash
npm run dev
```

Then open:

- `http://localhost:3000`

## Build

```bash
npm run build
npm run preview
```

## Project structure

```text
.
├── App.tsx                      # Top-level tabbed shell
├── components/
│   ├── AdaConsole.tsx           # Main chat + ledger + export flow
│   ├── SemanticSolver.tsx       # Single-query resolution view
│   ├── WordMechanic.tsx         # Mechanical/glyph profile visualizer
│   └── GlyphLab.tsx             # Glyph reference explorer
├── services/
│   ├── adaEngine.ts             # Core reasoning + scoring pipeline
│   ├── aiClient.ts              # Puter-first AI client + fallbacks
│   └── kinematicEngine.ts       # Query shape + mechanics analyzer
├── config.ts                    # AI providers, retry/cache, thresholds
├── constants.ts                 # Glyph database and static constants
├── types.ts                     # Shared types and enums
├── index.html                   # Includes Puter.js and app shell
└── vite.config.ts               # Dev server + AI proxy configuration
```

## Notes

- No Gemini key is needed for this app.
- If Puter is blocked in a browser/network environment, Pollinations fallbacks keep the app functional.
- The app is optimized for deterministic-ish structured responses by enforcing strict JSON parsing and normalization.
