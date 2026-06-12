# Limitations

This MVP proves the core loop, but it is not the final Agent Aquarium.

## AI

- Local models can be slow.
- Switching between different Ollama models can be expensive.
- The app runs one model request at a time by design.
- Final synthesis is simple; in real Ollama mode it summarizes the collected turns locally rather than making a second large synthesis call.
- Idle chatter is scripted and does not spend Ollama calls.

## Memory

- Shared memory is a short local list.
- Character personal memory exists in the data model but has minimal UI behavior.
- No vector database, embeddings, RAG, semantic recall, or long-term autonomy yet.
- Prompts include only a few recent memory notes to avoid huge slow contexts.

## Simulation

- Movement is smooth but simple.
- There is no real pathfinding, collision, furniture editing, or physics.
- Characters have states and idle movement, but no deep needs, mood, schedules, relationships, or goals yet.
- Visuals are simple canvas shapes rather than full sprite animation.

## Desktop Runtime

- The first build is browser-based Vite.
- It is designed to be wrapped by Tauri later.
- There is no Windows installer, tray mode, auto-start, or process supervisor yet.

## Wallpaper Engine

- Wallpaper Engine integration is intentionally not implemented in the MVP.
- A future wallpaper should be a viewer connected to the main app, not the AI brain.

## Product Surface

- No cloud sync.
- No login.
- No marketplace.
- No Steam Workshop structure.
- No character import/export yet.
- No file/project access.
- No voice/TTS.

These are deliberate deferrals so the first version can focus on the important loop: create characters, watch them live, give a task, see them gather and discuss, receive a final answer, and save a memory.
