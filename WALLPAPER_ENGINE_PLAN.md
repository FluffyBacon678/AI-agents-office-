# Wallpaper Engine Plan

## Why Not Wallpaper Engine First

Wallpaper Engine is a good visual viewer, but it is a poor first home for the full product brain:

- Ollama calls can be slow and heavy
- persistent character/team editing needs reliable local storage
- task sessions need queue control and cancellation
- model errors need clear UI
- long-running local state is easier to debug in a desktop app
- future memory, files, and settings need a stronger app shell

The MVP therefore treats Agent Aquarium as the main app first.

## Future Architecture

### Main App

The desktop app owns:

- characters
- memory
- settings
- task sessions
- AI orchestration
- Ollama calls
- queue state
- final answers

It can expose a simplified live-state API later.

### Wallpaper Viewer

A future Wallpaper Engine web wallpaper should be visual-only:

- HTML/CSS/JS or canvas renderer
- connects to the main app over localhost HTTP or WebSocket
- mirrors agent positions, states, current task, current speaker, and speech bubbles
- shows idle animation if the main app is unavailable
- performs no Ollama calls
- stores no authoritative memory

## Example Live State

```json
{
  "agents": [
    {
      "id": "starter-bruno",
      "name": "Bruno",
      "role": "Project Manager",
      "x": 500,
      "y": 300,
      "state": "speaking",
      "bubble": "Let's split this into the core loop, AI queue, and persistence."
    }
  ],
  "currentTask": "Help me design a Wallpaper Engine AI office app.",
  "currentSpeakerId": "starter-bruno",
  "sessionStatus": "running"
}
```

## Risks

- localhost access may need user firewall or browser permission handling
- Wallpaper Engine should not become a second source of truth
- WebSocket reconnect behavior must be graceful
- the viewer must have fake idle fallback when the main app is closed

The wallpaper is a window into the office, not the office brain.
