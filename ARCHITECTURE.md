# Architecture

## Stack

- React + TypeScript + Vite
- Canvas-based 2D office rendering with DOM speech bubbles
- Browser localStorage persistence
- Local Ollama HTTP API integration
- No cloud services, accounts, marketplace, or Wallpaper Engine runtime in the MVP

The code is kept browser-first so the product loop can be tested immediately. The service boundaries are simple enough to move behind Tauri commands later if needed.

## Major Systems

### Data Models

`src/types.ts` defines characters, rooms, settings, task sessions, conversation messages, memory summaries, and speech bubbles.

Characters include model name, role, bio, skills, speaking style, preferred room, enabled state, memory, current state, current room, position, and target position.

### Starter Data

`src/data/starterCharacters.ts` creates the five starter characters. They are not permanent hardcoded UI rows; they are just initial local data used when no persisted state exists.

`src/data/rooms.ts` defines the office map, room rectangles, room anchors, and standing spots.

### Storage

`src/lib/storage.ts` persists:

- characters
- settings
- memory summaries
- recent task sessions

The current storage backend is localStorage. A future Tauri wrapper could swap this for JSON files or SQLite without changing the main product loop.

### Simulation

`src/components/OfficeCanvas.tsx` draws the office, zones, furniture, character bodies, state labels, highlights, and thinking marks.

`src/App.tsx` owns the movement loop:

- agents move smoothly toward target positions
- idle agents occasionally wander
- selected meeting agents walk to table, whiteboard, art desk, or library spots
- after a session, agents return to preferred rooms

Game logic controls movement. AI only controls words.

### Speech Bubbles

Speech bubbles are DOM elements layered above the canvas. They track character world positions through the same canvas transform and expire after the configured duration. Long text is shortened for bubbles while the full text remains in the conversation log.

### AI Orchestration

`src/lib/orchestration.ts` handles:

- selecting relevant enabled characters
- ordering speakers
- demo-mode role responses
- final answer synthesis
- memory summary creation
- speech cleanup and bubble previews

The selection logic is deliberately understandable: always favor a project manager, include QA/critic and memory keeper when useful, score role/skill keywords, and cap the number of agents.

### Ollama Service

`src/lib/ollama.ts` handles:

- connection test through `/api/tags`
- character prompt construction
- single-turn generation through `/api/generate`
- timeout and cancellation support

The MVP calls Ollama sequentially. It does not parallelize local model requests.

### State Flow

1. User starts a task.
2. App selects enabled characters.
3. Selected agents receive meeting targets.
4. The queue runs one character turn at a time.
5. Each turn updates character state, bubble, and conversation log.
6. The app creates a final answer from the transcript.
7. The app creates and saves a short shared memory note.
8. Agents return to idle rooms.

## Tauri Path

The app can later be wrapped in Tauri by moving storage and Ollama fetches behind Tauri commands if browser CORS, filesystem access, or process control becomes limiting. The MVP does not require that wrapper to prove the core loop.
