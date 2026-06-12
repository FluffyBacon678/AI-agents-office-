# Agent Aquarium

Agent Aquarium is a local-first desktop-app MVP prototype: a cozy 2D office where editable Ollama-powered characters walk around, gather for meetings, speak in bubbles, and produce a combined answer to a user task.

This first version is a Vite React/TypeScript app. It is intentionally structured so it can be wrapped in Tauri later, but the core product loop runs in the browser today.

## Run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5173`.

On Windows PowerShell, if `npm` is blocked by execution policy, use:

```bash
npm.cmd install
npm.cmd run dev
```

## Use Demo Mode

Demo mode is on by default. It lets the whole app work without Ollama:

- characters wander around the office
- task meetings gather selected agents
- speech bubbles and the log fill with role-specific responses
- a final answer is produced
- a short memory summary is saved

This is not a fake UI shell; it exercises the same meeting and persistence flow as real Ollama mode.

## Connect Ollama

1. Install and run Ollama locally.
2. Make sure the Ollama API is available at `http://localhost:11434`.
3. In Settings, turn demo mode off.
4. Edit character model names to match installed local models.
5. Press **Test Ollama**.
6. Start a task.

The app sends one request at a time to `/api/generate`. If a model is missing or Ollama is offline, the app shows an error in the conversation log and speech bubble instead of freezing.

## Create A Character

Use the **+** button in the Team panel. A character has:

- name
- role/job
- Ollama model
- bio/personality
- skills
- speaking style
- preferred room
- avatar color
- enabled/disabled state

Saved characters appear physically in the office and are persisted in localStorage.

## Current Starter Team

- Bruno, Project Manager
- Otto, Programmer
- Iris, Critic / QA
- Luna, Artist / UX Designer
- Memo, Memory Keeper

The starter characters are editable and removable.

## Known Limitations

See [LIMITATIONS.md](./LIMITATIONS.md) for the honest list. The short version: this is a serious MVP, not a full autonomous agent platform yet. Memory is simple, pathfinding is simple, Ollama can be slow, and Wallpaper Engine is intentionally deferred.
