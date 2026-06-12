import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Bug,
  CheckCircle2,
  Edit3,
  GitPullRequest,
  ListChecks,
  PauseCircle,
  Play,
  Plus,
  Save,
  Settings2,
  Terminal,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import OfficeCanvas from "./components/OfficeCanvas";
import { getRandomRoomSpot, getRoomSpot, roomById, rooms } from "./data/rooms";
import { getRandomStationForRole, getStationsForRole, stationById, stations } from "./data/stations";
import { starterCharacters } from "./data/starterCharacters";
import {
  AppSettings,
  Character,
  CharacterNeeds,
  CharacterState,
  ConversationMessage,
  DiagnosticLevel,
  DiagnosticLogEntry,
  DiagnosticSource,
  ManagerRole,
  MemorySummary,
  NeedKey,
  OllamaStatus,
  PersistedState,
  ProjectWorkflow,
  RoomId,
  ScheduleMode,
  SpeechBubble,
  SmokeTestResult,
  Station,
  StationCategory,
  TaskSession,
  Vector,
} from "./types";
import { defaultSettings, loadPersistedState, savePersistedState } from "./lib/storage";
import {
  bubblePreview,
  cleanSpeech,
  createDemoResponse,
  createFinalAnswer,
  createMemorySummary,
  orderSpeakers,
  selectCharactersForTask,
  shortId,
} from "./lib/orchestration";
import { generateOllamaTurn, testOllamaConnection } from "./lib/ollama";
import {
  advanceWorkItem,
  createWorkflowFromTask,
  getWorkflowStatus,
  pickManager,
  statusLabel,
} from "./lib/workflow";
import { runSmokeTests } from "./lib/diagnostics";

const meetingOrder: RoomId[] = ["meeting", "meeting", "whiteboard", "art", "library", "desks"];
const needKeys: NeedKey[] = ["focus", "recreation", "social", "energy"];
const needLabels: Record<NeedKey, string> = {
  focus: "Focus",
  recreation: "Rec",
  social: "Social",
  energy: "Energy",
};

function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function detectManagerRole(role: string): ManagerRole | undefined {
  const clean = role.toLowerCase();
  if (clean.includes("hr")) return "hr";
  if (clean.includes("critic") || clean.includes("qa")) return "reviewer";
  if (clean.includes("project manager") || clean.includes("manager") || clean.includes("lead")) return "teamLead";
  return undefined;
}

function createDefaultNeeds(character: Pick<Character, "role" | "name">): CharacterNeeds {
  const role = character.role.toLowerCase();
  const needs: CharacterNeeds = {
    focus: 72,
    recreation: 68,
    social: 64,
    energy: 76,
  };

  if (role.includes("program")) {
    needs.focus += 8;
    needs.social -= 6;
  }
  if (role.includes("project") || role.includes("manager") || role.includes("hr")) {
    needs.social += 10;
    needs.focus += 4;
  }
  if (role.includes("artist") || role.includes("designer")) {
    needs.recreation += 8;
  }
  if (role.includes("critic") || role.includes("qa")) {
    needs.focus += 6;
  }

  return {
    focus: clampNeed(needs.focus),
    recreation: clampNeed(needs.recreation),
    social: clampNeed(needs.social),
    energy: clampNeed(needs.energy),
  };
}

function normalizeCharacter(character: Character): Character {
  const fallbackNeeds = createDefaultNeeds(character);
  const currentStationId = character.currentStationId ?? character.stationId;

  return {
    ...character,
    needs: {
      focus: clampNeed(character.needs?.focus ?? fallbackNeeds.focus),
      recreation: clampNeed(character.needs?.recreation ?? fallbackNeeds.recreation),
      social: clampNeed(character.needs?.social ?? fallbackNeeds.social),
      energy: clampNeed(character.needs?.energy ?? fallbackNeeds.energy),
    },
    scheduleMode: character.scheduleMode ?? "auto",
    managerRole: character.managerRole ?? detectManagerRole(character.role),
    currentStationId,
    stationId: currentStationId,
  };
}

function cloneStarters(): Character[] {
  return starterCharacters.map((character) => normalizeCharacter({
    ...character,
    skills: [...character.skills],
    personalMemory: [...character.personalMemory],
    position: { ...character.position },
    targetPosition: { ...character.targetPosition },
  }));
}

function nowIso(): string {
  return new Date().toISOString();
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function distance(a: Vector, b: Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function moveToward(position: Vector, target: Vector, maxDistance: number): Vector {
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxDistance || dist === 0) return { ...target };
  return {
    x: position.x + (dx / dist) * maxDistance,
    y: position.y + (dy / dist) * maxDistance,
  };
}

function getNearestRoom(position: Vector): RoomId {
  let best = rooms[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const room of rooms) {
    const current = distance(position, room.anchor);
    if (current < bestDistance) {
      best = room;
      bestDistance = current;
    }
  }
  return best.id;
}

function characterWithTarget(
  character: Character,
  state: CharacterState,
  target: Vector,
  roomId?: RoomId,
  stationId?: string,
  activity?: string,
): Character {
  return {
    ...character,
    state: character.enabled ? state : "disabled",
    currentRoom: roomId ?? character.currentRoom,
    targetPosition: target,
    currentStationId: stationId,
    stationId,
    activity,
  };
}

function getCurrentStationId(character: Character): string | undefined {
  return character.currentStationId ?? character.stationId;
}

function getStationOccupancy(characters: Character[]): Record<string, number> {
  return characters.reduce(
    (acc, character) => {
      const stationId = getCurrentStationId(character);
      if (stationId && character.enabled && ["working", "walking", "returning"].includes(character.state)) {
        acc[stationId] = (acc[stationId] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}

function getInteractionSpot(station: Station, occupancy: Record<string, number>): Vector {
  const index = Math.min(occupancy[station.id] ?? 0, station.interactionSpots.length - 1);
  return station.interactionSpots[index] ?? station.interactionSpot;
}

function pickNeedCategory(character: Character): StationCategory {
  const needs = character.needs;
  if (character.scheduleMode === "work") return "work";
  if (character.scheduleMode === "rest") return "rest";
  if (character.scheduleMode === "social") return "social";
  if (character.scheduleMode === "meeting") return "planning";

  if (needs.energy < 42) return "rest";
  if (needs.recreation < 40) return "rest";
  if (needs.social < 40) return "social";
  if (needs.focus < 42) return "planning";
  if (character.managerRole && Math.random() > 0.45) return "management";
  return "work";
}

function chooseStationForCharacter(character: Character, allCharacters: Character[]): Station {
  const category = pickNeedCategory(character);
  const occupancy = getStationOccupancy(allCharacters);
  const currentStationId = getCurrentStationId(character);
  const preferred = getStationsForRole(character.role, category);
  const availablePreferred = preferred.filter(
    (station) => station.id === currentStationId || (occupancy[station.id] ?? 0) < station.capacity,
  );

  if (availablePreferred.length) {
    return availablePreferred[Math.floor(Math.random() * availablePreferred.length)];
  }

  const fallback = stations.filter(
    (station) => station.category === category && (station.id === currentStationId || (occupancy[station.id] ?? 0) < station.capacity),
  );
  if (fallback.length) return fallback[Math.floor(Math.random() * fallback.length)];

  return getRandomStationForRole(character.role);
}

function chooseStationForWorkType(type: string, character: Character, allCharacters: Character[]): Station {
  const category: StationCategory = type === "qa" || type === "planning" ? "planning" : type === "memory" ? "work" : "work";
  const preferred = getStationsForRole(character.role, category);
  const occupancy = getStationOccupancy(allCharacters);
  const available = preferred.filter((station) => (occupancy[station.id] ?? 0) < station.capacity);
  if (available.length) return available[0];
  return preferred[0] ?? chooseStationForCharacter(character, allCharacters);
}

function applyNeedTick(character: Character, hrSupportActive: boolean): CharacterNeeds {
  const station = getCurrentStationId(character) ? stationById[getCurrentStationId(character)!] : undefined;
  const effects = character.state === "working" && station ? station.needEffects : {};
  const walkingDrain = character.state === "walking" || character.state === "returning" ? -0.18 : 0;
  const idleRecovery = character.state === "idle" ? 0.12 : 0;
  const hrSupport = hrSupportActive ? 0.12 : 0;

  return {
    focus: clampNeed(character.needs.focus - 0.34 + (effects.focus ?? 0) + idleRecovery),
    recreation: clampNeed(character.needs.recreation - 0.5 + (effects.recreation ?? 0) + hrSupport),
    social: clampNeed(character.needs.social - 0.42 + (effects.social ?? 0) + hrSupport),
    energy: clampNeed(character.needs.energy - 0.4 + (effects.energy ?? 0) + walkingDrain),
  };
}

function createNewCharacter(settings: AppSettings): Character {
  const position = getRandomRoomSpot("desks");
  return normalizeCharacter({
    id: shortId("character"),
    name: "New Agent",
    role: "Researcher",
    model: settings.defaultModel,
    bio: "Curious, local-first, and careful with assumptions.",
    skills: ["research", "planning"],
    speakingStyle: "concise, thoughtful",
    preferredRoom: "library",
    avatarColor: "#78b7a0",
    enabled: true,
    personalMemory: [],
    state: "idle",
    currentRoom: "desks",
    position,
    targetPosition: position,
    needs: createDefaultNeeds({ name: "New Agent", role: "Researcher" }),
    scheduleMode: "auto",
  });
}

function createIdleThought(character: Character): string {
  const role = character.role.toLowerCase();
  const room = roomById[character.currentRoom]?.name ?? "the office";
  const station = getCurrentStationId(character) ? stationById[getCurrentStationId(character)!] : undefined;

  if (character.activity && station) {
    const lowest = needKeys.reduce((worst, key) => (character.needs[key] < character.needs[worst] ? key : worst), "focus" as NeedKey);
    return `${character.activity} at ${station.name}. ${needLabels[lowest]} is ${character.needs[lowest]}.`;
  }

  if (role.includes("project manager")) {
    return Math.random() > 0.5 ? "I should keep the next meeting small." : `Checking the plan from ${room}.`;
  }

  if (role.includes("program")) {
    return Math.random() > 0.5 ? "Separating visuals from AI calls still feels right." : "I want clean interfaces before clever tricks.";
  }

  if (role.includes("critic") || role.includes("qa")) {
    return Math.random() > 0.5 ? "If it freezes, it fails the vibe check." : "I am watching the edge cases.";
  }

  if (role.includes("artist") || role.includes("ux") || role.includes("designer")) {
    return Math.random() > 0.5 ? "The room needs to read at a glance." : "Warm light helps slow tasks feel intentional.";
  }

  if (role.includes("memory")) {
    return Math.random() > 0.5 ? "Keeping the useful decisions tidy." : "Short memories. No context swamp.";
  }

  if (role.includes("sysadmin")) {
    return Math.random() > 0.5 ? "Local services should fail loudly and recover gently." : "One model request at a time.";
  }

  if (role.includes("research")) {
    return Math.random() > 0.5 ? "I am noting what we do not know yet." : `Looking for clues around ${room}.`;
  }

  return Math.random() > 0.5 ? "Quiet office loop looks healthy." : `Taking a lap through ${room}.`;
}

function App() {
  const stored = useMemo(() => loadPersistedState(), []);
  const [characters, setCharacters] = useState<Character[]>(() => stored?.characters?.map(normalizeCharacter) ?? cloneStarters());
  const [settings, setSettings] = useState<AppSettings>(() => ({ ...defaultSettings, ...stored?.settings }));
  const [memories, setMemories] = useState<MemorySummary[]>(() => stored?.memories ?? []);
  const [sessions, setSessions] = useState<TaskSession[]>(() => stored?.sessions ?? []);
  const [workflows, setWorkflows] = useState<ProjectWorkflow[]>(() => stored?.workflows ?? []);
  const [diagnosticLogs, setDiagnosticLogs] = useState<DiagnosticLogEntry[]>(() => stored?.diagnosticLogs ?? []);
  const [smokeTests, setSmokeTests] = useState<SmokeTestResult[]>(() => stored?.smokeTests ?? []);
  const [taskText, setTaskText] = useState("Help me design a Wallpaper Engine AI office app.");
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([]);
  const [sessionStatus, setSessionStatus] = useState<TaskSession["status"]>("idle");
  const [currentTask, setCurrentTask] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [currentSpeakerId, setCurrentSpeakerId] = useState<string | undefined>();
  const [activeCharacterId, setActiveCharacterId] = useState<string | undefined>();
  const [ambientNote, setAmbientNote] = useState("The office is awake and idling.");
  const [meetingProgress, setMeetingProgress] = useState({ current: 0, total: 0, label: "Idle" });
  const [simulationPaused, setSimulationPaused] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus>({
    state: "unknown",
    message: "Not tested yet.",
    models: [],
  });

  const abortRef = useRef<AbortController | null>(null);
  const runningRef = useRef(false);
  const charactersRef = useRef<Character[]>(characters);
  const settingsRef = useRef<AppSettings>(settings);
  const simulationPausedRef = useRef(simulationPaused);
  const ambientTickRef = useRef(0);
  const simTickRef = useRef(0);

  const addDiagnostic = (
    level: DiagnosticLevel,
    source: DiagnosticSource,
    message: string,
    details?: string,
  ): DiagnosticLogEntry => {
    const entry: DiagnosticLogEntry = {
      id: shortId("log"),
      createdAt: nowIso(),
      level,
      source,
      message,
      details,
    };
    setDiagnosticLogs((previous) => [entry, ...previous].slice(0, 200));
    return entry;
  };

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      addDiagnostic(
        "error",
        "runtime",
        event.message || "Runtime error",
        event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
      );
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason ?? "Unhandled promise rejection");
      addDiagnostic("error", "runtime", "Unhandled promise rejection", reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    simulationPausedRef.current = simulationPaused;
  }, [simulationPaused]);

  useEffect(() => {
    const state: PersistedState = {
      characters,
      settings,
      memories,
      sessions: sessions.slice(-12),
      workflows: workflows.slice(0, 8),
      diagnosticLogs: diagnosticLogs.slice(0, 200),
      smokeTests: smokeTests.slice(0, 24),
    };
    savePersistedState(state);
  }, [characters, settings, memories, sessions, workflows, diagnosticLogs, smokeTests]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (simulationPausedRef.current && !runningRef.current) return;

      setCharacters((previous) =>
        previous.map((character) => {
          if (!character.enabled) {
            return { ...character, state: "disabled" };
          }

          const nextPosition = moveToward(
            character.position,
            character.targetPosition,
            Math.max(1.2, 3.2 * settings.simulationSpeed),
          );
          const arrived = distance(nextPosition, character.targetPosition) < 1;
          let nextState = character.state;

          if (arrived && ["walking", "gathering", "returning"].includes(character.state)) {
            if (runningRef.current && selectedIds.includes(character.id)) {
              nextState = "waiting";
            } else if (getCurrentStationId(character) && character.activity && (character.state === "walking" || character.state === "returning")) {
              nextState = "working";
            } else {
              nextState = "idle";
            }
          }

          return {
            ...character,
            position: nextPosition,
            state: nextState,
            currentRoom: arrived ? getNearestRoom(nextPosition) : character.currentRoom,
          };
        }),
      );
    }, 33);

    return () => window.clearInterval(interval);
  }, [settings.simulationSpeed, selectedIds]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setBubbles((previous) => previous.filter((bubble) => bubble.expiresAt > Date.now()));

      if (runningRef.current || simulationPausedRef.current) return;

      simTickRef.current += 1;

      const currentCharacters = charactersRef.current;
      const hrSupportActive = currentCharacters.some((character) => {
        const stationId = getCurrentStationId(character);
        return character.enabled && character.managerRole === "hr" && character.state === "working" && stationId === "hr-desk";
      });

      const lead = currentCharacters.find(
        (character) => character.enabled && character.managerRole === "teamLead" && !["walking", "gathering"].includes(character.state),
      );
      const shouldCallSync =
        lead &&
        simTickRef.current % 9 === 0 &&
        currentCharacters.filter((character) => character.enabled).length >= 3 &&
        Math.random() > 0.52;

      if (shouldCallSync) {
        const meetingStation = stationById["meeting-table"];
        const participants = [
          lead,
          ...currentCharacters
            .filter((character) => character.enabled && character.id !== lead.id)
            .sort((a, b) => {
              const aNeed = Math.min(a.needs.focus, a.needs.social);
              const bNeed = Math.min(b.needs.focus, b.needs.social);
              return aNeed - bNeed;
            })
            .slice(0, Math.min(3, currentCharacters.length - 1)),
        ];
        const participantIds = participants.map((character) => character.id);
        addBubble(lead.id, "Quick sync at the meeting table.", "system");
        setAmbientNote(`${lead.name} called a quick team sync.`);
        addDiagnostic(
          "info",
          "simulation",
          `${lead.name} called a quick team sync.`,
          participants.map((character) => character.name).join(", "),
        );
        setCharacters((previous) =>
          previous.map((character) => {
            const index = participantIds.indexOf(character.id);
            if (index === -1) return character;
            return characterWithTarget(
              {
                ...character,
                scheduleMode: "meeting",
              },
              "walking",
              meetingStation.interactionSpots[index % meetingStation.interactionSpots.length],
              meetingStation.roomId,
              meetingStation.id,
              "quick sync",
            );
          }),
        );
        return;
      }

      setCharacters((previous) =>
        previous.map((character) => {
          if (
            !character.enabled ||
            character.state === "disabled" ||
            character.state === "error" ||
            character.state === "thinking" ||
            character.state === "speaking" ||
            character.state === "waiting"
          ) {
            return character;
          }

          const normalized = normalizeCharacter(character);
          const needs = applyNeedTick(normalized, hrSupportActive);
          const updated = {
            ...normalized,
            needs,
            scheduleMode: normalized.scheduleMode === "meeting" && normalized.state === "working" ? "auto" as ScheduleMode : normalized.scheduleMode,
          };

          if (updated.state === "walking" || updated.state === "returning" || updated.state === "gathering") {
            return updated;
          }

          const lowNeed = Math.min(updated.needs.focus, updated.needs.recreation, updated.needs.social, updated.needs.energy);
          const currentStation = getCurrentStationId(updated) ? stationById[getCurrentStationId(updated)!] : undefined;
          const currentCategory = currentStation?.category;
          const desiredCategory = pickNeedCategory(updated);
          const shouldMove =
            !currentStation ||
            currentCategory !== desiredCategory ||
            lowNeed < 38 ||
            (updated.state === "idle" && Math.random() > 0.2) ||
            Math.random() > 0.74;

          if (!shouldMove) return updated;

          const station = chooseStationForCharacter(updated, previous);
          const occupancy = getStationOccupancy(previous);
          return characterWithTarget(
            updated,
            "walking",
            getInteractionSpot(station, occupancy),
            station.roomId,
            station.id,
            station.activity,
          );
        }),
      );
    }, 3600);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (runningRef.current || simulationPausedRef.current) return;

      const workflow = workflows[0];
      if (!workflow || workflow.status === "complete") return;

      const activeItem =
        workflow.workItems.find((item) => item.status !== "accepted" && item.status !== "qa-test" && item.status !== "lead-review") ??
        workflow.workItems.find((item) => item.status === "lead-review") ??
        workflow.workItems.find((item) => item.status === "qa-test");
      if (!activeItem) return;

      const advanced = advanceWorkItem(activeItem);
      setWorkflows((previous) =>
        previous.map((candidate) => {
          if (candidate.id !== workflow.id) return candidate;
          const workItems = candidate.workItems.map((item) => (item.id === activeItem.id ? advanced : item));
          return {
            ...candidate,
            workItems,
            status: getWorkflowStatus(workItems),
            updatedAt: nowIso(),
          };
        }),
      );

      const responsibleId =
        advanced.status === "lead-review"
          ? advanced.reviewerId
          : advanced.status === "qa-test"
            ? advanced.qaId
            : advanced.assigneeId;
      const responsible = charactersRef.current.find((character) => character.id === responsibleId);
      if (responsible) {
        const station = chooseStationForWorkType(advanced.type, responsible, charactersRef.current);
        const occupancy = getStationOccupancy(charactersRef.current);
        setCharacters((previous) =>
          previous.map((character) =>
            character.id === responsible.id
              ? characterWithTarget(
                  {
                    ...normalizeCharacter(character),
                    scheduleMode: advanced.status === "qa-test" ? "meeting" : "work",
                  },
                  "walking",
                  getInteractionSpot(station, occupancy),
                  station.roomId,
                  station.id,
                  advanced.status === "qa-test"
                    ? "smoke testing"
                    : advanced.status === "lead-review"
                      ? "reviewing work"
                      : station.activity,
                )
              : character,
          ),
        );
        addBubble(responsible.id, advanced.summary, "system");
      }

      setAmbientNote(`Pipeline: ${advanced.summary}`);
      addDiagnostic(
        advanced.status === "accepted" ? "success" : "info",
        "workflow",
        advanced.summary,
        `${advanced.title} moved to ${statusLabel(advanced.status)} at ${advanced.progress}%.`,
      );
    }, 5200);

    return () => window.clearInterval(interval);
  }, [workflows]);

  const selectedCharacters = useMemo(
    () => selectedIds.map((id) => characters.find((character) => character.id === id)).filter(Boolean) as Character[],
    [characters, selectedIds],
  );

  const addBubble = (characterId: string, text: string, kind: SpeechBubble["kind"] = "speech") => {
    const bubble: SpeechBubble = {
      id: shortId("bubble"),
      characterId,
      text: bubblePreview(text),
      kind,
      expiresAt: Date.now() + settingsRef.current.bubbleDurationMs,
    };
    setBubbles((previous) => [...previous.filter((item) => item.characterId !== characterId), bubble].slice(-3));
  };

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (runningRef.current) return;

      const eligible = charactersRef.current.filter(
        (character) =>
          character.enabled &&
          (character.state === "idle" || character.state === "walking" || character.state === "working"),
      );
      ambientTickRef.current += 1;
      if (!eligible.length || (ambientTickRef.current > 1 && Math.random() > 0.72)) return;

      const character = eligible[Math.floor(Math.random() * eligible.length)];
      const text = createIdleThought(character);
      addBubble(character.id, text, "system");
      setAmbientNote(`${character.name}: ${text}`);
    }, 7800);

    return () => window.clearInterval(interval);
  }, []);

  const addMessage = (message: Omit<ConversationMessage, "id" | "createdAt">): ConversationMessage => {
    const next: ConversationMessage = {
      ...message,
      id: shortId("msg"),
      createdAt: nowIso(),
    };
    setMessages((previous) => [...previous, next]);
    return next;
  };

  const setCharacterState = (id: string, state: CharacterState, target?: Vector, roomId?: RoomId) => {
      setCharacters((previous) =>
      previous.map((character) =>
        character.id === id
          ? {
              ...character,
              state: character.enabled ? state : "disabled",
              targetPosition: target ?? character.targetPosition,
              currentRoom: roomId ?? character.currentRoom,
              currentStationId: state === "thinking" || state === "speaking" || state === "waiting" ? undefined : character.currentStationId,
              stationId: state === "thinking" || state === "speaking" || state === "waiting" ? undefined : character.stationId,
              activity: state === "thinking" || state === "speaking" || state === "waiting" ? undefined : character.activity,
            }
          : character,
      ),
    );
  };

  const returnSelectedAgents = (ids = selectedIds) => {
    setCharacters((previous) =>
      previous.map((character) => {
        if (!ids.includes(character.id)) return character;
        const updated = normalizeCharacter(character);
        const station = chooseStationForCharacter(updated, previous);
        const occupancy = getStationOccupancy(previous);
        return characterWithTarget(
          {
            ...updated,
            scheduleMode: "auto",
          },
          "returning",
          getInteractionSpot(station, occupancy),
          station.roomId,
          station.id,
          station.activity,
        );
      }),
    );
  };

  const handleSaveCharacter = (character: Character) => {
    setCharacters((previous) => {
      const exists = previous.some((item) => item.id === character.id);
      if (exists) {
        return previous.map((item) => (item.id === character.id ? character : item));
      }
      return [...previous, character];
    });
    setEditingCharacter(null);
  };

  const handleDeleteCharacter = (id: string) => {
    const character = characters.find((item) => item.id === id);
    if (!character) return;
    if (!window.confirm(`Remove ${character.name} from the office?`)) return;
    setCharacters((previous) => previous.filter((item) => item.id !== id));
    setSelectedIds((previous) => previous.filter((item) => item !== id));
    if (editingCharacter?.id === id) setEditingCharacter(null);
  };

  const handleToggleCharacter = (id: string) => {
    setCharacters((previous) =>
      previous.map((character) =>
        character.id === id
          ? {
              ...character,
              enabled: !character.enabled,
              state: character.enabled ? "disabled" : "idle",
            }
          : character,
      ),
    );
  };

  const handleTestOllama = async () => {
    setOllamaStatus({ state: "testing", message: "Testing Ollama connection...", models: [] });
    addDiagnostic("info", "ollama", "Testing Ollama connection.", settings.ollamaBaseUrl);
    const result = await testOllamaConnection(settings.ollamaBaseUrl, 6000);
    setOllamaStatus({
      state: result.ok ? "connected" : "failed",
      message: result.message,
      models: result.models,
    });
    addDiagnostic(
      result.ok ? "success" : "error",
      "ollama",
      result.message,
      result.models.length ? `Models: ${result.models.slice(0, 8).join(", ")}` : undefined,
    );
  };

  const handleRunSmokeTests = () => {
    const results = runSmokeTests({
      characters,
      settings,
      memories,
      sessions,
      workflows,
      stations,
      finalAnswer,
      ollamaStatus,
    });
    setSmokeTests(results);
    const failures = results.filter((item) => item.status === "fail").length;
    const warnings = results.filter((item) => item.status === "warn").length;
    addDiagnostic(
      failures ? "error" : warnings ? "warn" : "success",
      "smoke",
      `Smoke test complete: ${results.length - failures - warnings} passed, ${warnings} warning(s), ${failures} failure(s).`,
      results.map((item) => `${item.status.toUpperCase()}: ${item.name} - ${item.message}`).join("\n"),
    );
  };

  const handleClearDiagnostics = () => {
    setDiagnosticLogs([]);
    setSmokeTests([]);
  };

  const handleStopTask = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    runningRef.current = false;
    setSessionStatus("cancelled");
    setMeetingProgress({ current: 0, total: 0, label: "Cancelled" });
    setAmbientNote("Task cancelled. Agents are returning to the office loop.");
    addDiagnostic("warn", "system", "Task cancelled by operator.", currentTask || undefined);
    setCurrentSpeakerId(undefined);
    setActiveCharacterId(undefined);
    addMessage({
      sessionId: "current",
      speakerName: "System",
      text: "Task cancelled. The team is returning to idle rooms.",
      kind: "system",
    });
    returnSelectedAgents();
  };

  const handleStartTask = async (event?: FormEvent) => {
    event?.preventDefault();
    const task = taskText.trim();
    if (!task || runningRef.current) return;

    const enabled = characters.filter((character) => character.enabled);
    if (!enabled.length) {
      addDiagnostic("error", "system", "Task could not start because no agents are enabled.");
      addMessage({
        sessionId: "current",
        speakerName: "System",
        text: "No enabled characters are available. Enable or create an agent first.",
        kind: "error",
      });
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    runningRef.current = true;
    setSessionStatus("gathering");
    setCurrentTask(task);
    setFinalAnswer("");
    setMessages([]);
    setBubbles([]);

    const selected = orderSpeakers(selectCharactersForTask(task, characters, settings));
    const sessionId = shortId("session");
    const selectedCharacterIds = selected.map((character) => character.id);
    setSelectedIds(selectedCharacterIds);
    setMeetingProgress({ current: 0, total: selected.length, label: "Gathering" });
    setAmbientNote(`Meeting started: ${selected.map((character) => character.name).join(", ")} are gathering.`);
    addDiagnostic(
      "info",
      "system",
      `Task started with ${selected.length} agent(s).`,
      `${task} | ${selected.map((character) => character.name).join(", ")}`,
    );

    setCharacters((previous) =>
      previous.map((character) => {
        const selectedIndex = selectedCharacterIds.indexOf(character.id);
        if (selectedIndex === -1) return character;
        const roomId = meetingOrder[selectedIndex] ?? "meeting";
        const target = roomId === "meeting" ? getRoomSpot("meeting", selectedIndex) : getRoomSpot(roomId, selectedIndex);
        return characterWithTarget(character, "gathering", target, roomId);
      }),
    );

    addMessage({
      sessionId,
      speakerName: "System",
      text: `New task received. Inviting ${selected.map((character) => character.name).join(", ")} to the meeting.`,
      kind: "system",
    });

    for (const character of selected) {
      addBubble(character.id, "...", "thinking");
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1300));
    if (controller.signal.aborted) return;

    setSessionStatus("running");
    let transcript: ConversationMessage[] = [];

    for (const character of selected) {
      if (controller.signal.aborted) break;

      setCurrentSpeakerId(undefined);
      setActiveCharacterId(character.id);
      setMeetingProgress({ current: transcript.length + 1, total: selected.length, label: `${character.name} thinking` });
      setAmbientNote(`${character.name} is thinking through the task.`);
      setCharacterState(character.id, "thinking");
      addBubble(character.id, "...", "thinking");

      try {
        await new Promise((resolve) => window.setTimeout(resolve, settings.demoMode ? 700 : 200));
        if (controller.signal.aborted) break;

        const liveCharacter = characters.find((item) => item.id === character.id) ?? character;
        const text = settings.demoMode
          ? createDemoResponse({ character: liveCharacter, task, messages: transcript })
          : (
              await generateOllamaTurn({
                settings,
                character: liveCharacter,
                task,
                selectedCharacters: selected,
                recentMessages: transcript,
                memories,
                signal: controller.signal,
              })
            ).text;

        const cleaned = cleanSpeech(text);
        const message = {
          sessionId,
          speakerId: character.id,
          speakerName: character.name,
          role: character.role,
          text: cleaned,
          kind: "speech" as const,
        };
        const added = addMessage(message);
        transcript = [...transcript, added];
        setCurrentSpeakerId(character.id);
        setActiveCharacterId(undefined);
        setMeetingProgress({ current: transcript.length, total: selected.length, label: `${character.name} speaking` });
        setAmbientNote(`${character.name} is speaking to the team.`);
        setCharacterState(character.id, "speaking");
        addBubble(character.id, cleaned, "speech");
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(1800, settings.bubbleDurationMs * 0.45)));
        setCharacterState(character.id, "waiting");
      } catch (error) {
        const errorText =
          error instanceof Error
            ? error.message
            : "The local model request failed. Check Ollama or enable demo mode.";
        addDiagnostic("error", "ollama", `${character.name} turn failed.`, errorText);
        const message = addMessage({
          sessionId,
          speakerId: character.id,
          speakerName: character.name,
          role: character.role,
          text: errorText,
          kind: "error",
        });
        transcript = [...transcript, message];
        setCharacterState(character.id, "error");
        addBubble(character.id, "Model unavailable. Check settings.", "error");
        if (!settings.demoMode) break;
      }
    }

    if (!controller.signal.aborted) {
      const final = createFinalAnswer(task, transcript, settings.demoMode);
      const memoryText = createMemorySummary(task, transcript);
      const memory: MemorySummary = {
        id: shortId("memory"),
        createdAt: nowIso(),
        task,
        text: memoryText,
      };
      setFinalAnswer(final);
      setMeetingProgress({ current: selected.length, total: selected.length, label: "Final answer ready" });
      setAmbientNote("Team answer produced. Memory saved.");
      setMemories((previous) => [memory, ...previous].slice(0, 30));
      addMessage({
        sessionId,
        speakerName: "Team",
        text: "Final answer produced. Memo saved a short memory note.",
        kind: "final",
      });
      const memoryKeeper = selected.find((character) => character.role.toLowerCase().includes("memory"));
      if (memoryKeeper) addBubble(memoryKeeper.id, "Memory saved.", "system");

      const session: TaskSession = {
        id: sessionId,
        task,
        selectedCharacterIds,
        messages: transcript,
        finalAnswer: final,
        memorySummary: memoryText,
        status: "complete",
        createdAt: nowIso(),
        completedAt: nowIso(),
      };
      setSessions((previous) => [session, ...previous].slice(0, 12));
      const workflow = createWorkflowFromTask(task, characters);
      setWorkflows((previous) => [workflow, ...previous].slice(0, 8));
      addDiagnostic(
        "success",
        "workflow",
        "Production pipeline opened.",
        `${workflow.workItems.length} work item(s) created for manager review and QA.`,
      );
      const manager = pickManager(characters);
      if (manager) {
        addBubble(manager.id, "I opened a production pipeline for this task.", "system");
      }
      setSessionStatus("complete");
      addDiagnostic("success", "system", "Task completed and memory saved.", memoryText);
    }

    runningRef.current = false;
    abortRef.current = null;
    setCurrentSpeakerId(undefined);
    setActiveCharacterId(undefined);
    window.setTimeout(() => {
      returnSelectedAgents(selectedCharacterIds);
      setSessionStatus((status) => (status === "complete" ? "idle" : status));
      setMeetingProgress((progress) =>
        progress.label === "Final answer ready" ? { current: 0, total: 0, label: "Idle" } : progress,
      );
    }, 1400);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Local-first desktop MVP</p>
          <h1>Agent Aquarium</h1>
        </div>
        <div className="topbar-actions">
          <span className={`connection-pill connection-pill--${ollamaStatus.state}`}>
            {ollamaStatus.state === "connected" ? <Wifi size={16} /> : <WifiOff size={16} />}
            {settings.demoMode ? "Demo mode" : ollamaStatus.message}
          </span>
          <span className={`status-pill status-pill--${sessionStatus}`}>{sessionStatus}</span>
        </div>
      </header>

      <main className="workspace">
        <section className="simulation-column">
          <div className="stage-header">
            <div>
              <h2>Tiny Office</h2>
              <p>{currentTask || "Agents idle, wander, and wait for a task."}</p>
            </div>
            <div className="queue-chip">
              <Bot size={16} />
              {activeCharacterId
                ? `${characters.find((character) => character.id === activeCharacterId)?.name ?? "Agent"} thinking`
                : currentSpeakerId
                  ? `${characters.find((character) => character.id === currentSpeakerId)?.name ?? "Agent"} speaking`
                  : runningRef.current
                    ? "Queue active"
                : "Queue idle"}
            </div>
          </div>
          <div className="activity-strip">
            <span className="activity-dot" />
            <span>{ambientNote}</span>
            <button className="activity-toggle" type="button" onClick={() => setSimulationPaused((value) => !value)}>
              {simulationPaused ? <Play size={13} /> : <PauseCircle size={13} />}
              {simulationPaused ? "Resume sim" : "Pause sim"}
            </button>
            <strong>{characters.filter((character) => character.enabled).length} active agents</strong>
          </div>
          <OfficeCanvas
            characters={characters}
            bubbles={bubbles}
            currentSpeakerId={currentSpeakerId}
            activeCharacterId={activeCharacterId}
            selectedCharacterIds={selectedIds}
            meetingActive={sessionStatus === "gathering" || sessionStatus === "running"}
          />
          <ConversationLog messages={messages} />
        </section>

        <aside className="control-column">
          <TaskPanel
            taskText={taskText}
            setTaskText={setTaskText}
            status={sessionStatus}
            onStart={handleStartTask}
            onStop={handleStopTask}
            selectedCharacters={selectedCharacters}
            progress={meetingProgress}
          />

          <TeamPanel
            characters={characters}
            onAdd={() => setEditingCharacter(createNewCharacter(settings))}
            onEdit={setEditingCharacter}
            onDelete={handleDeleteCharacter}
            onToggle={handleToggleCharacter}
          />

          <FinalAnswerPanel finalAnswer={finalAnswer} />
          <WorkflowPanel workflows={workflows} characters={characters} />
          <DiagnosticsPanel
            logs={diagnosticLogs}
            smokeTests={smokeTests}
            onRunSmokeTests={handleRunSmokeTests}
            onClear={handleClearDiagnostics}
          />
          <MemoryPanel memories={memories} />
          <SettingsPanel
            settings={settings}
            setSettings={setSettings}
            ollamaStatus={ollamaStatus}
            onTestOllama={handleTestOllama}
          />
        </aside>
      </main>

      {editingCharacter && (
        <CharacterEditor
          key={editingCharacter.id}
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onSave={handleSaveCharacter}
        />
      )}
    </div>
  );
}

interface TaskPanelProps {
  taskText: string;
  setTaskText: (value: string) => void;
  status: TaskSession["status"];
  onStart: (event?: FormEvent) => void;
  onStop: () => void;
  selectedCharacters: Character[];
  progress: {
    current: number;
    total: number;
    label: string;
  };
}

function TaskPanel({ taskText, setTaskText, status, onStart, onStop, selectedCharacters, progress }: TaskPanelProps) {
  const running = status === "gathering" || status === "running";
  const progressPercent = progress.total ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Task</h2>
        <span>{running ? "in progress" : "ready"}</span>
      </div>
      <form onSubmit={onStart}>
        <textarea
          value={taskText}
          onChange={(event) => setTaskText(event.target.value)}
          placeholder="Give the tiny team a task..."
          rows={4}
        />
        <div className="button-row">
          <button className="primary-button" type="submit" disabled={running || !taskText.trim()}>
            <Play size={16} />
            Start Task
          </button>
          <button className="ghost-button" type="button" onClick={onStop} disabled={!running}>
            <PauseCircle size={16} />
            Stop
          </button>
        </div>
      </form>
      <div className="meeting-list">
        {selectedCharacters.length ? (
          selectedCharacters.map((character) => (
            <span key={character.id} style={{ borderColor: character.avatarColor }}>
              {character.name}
            </span>
          ))
        ) : (
          <span>No active meeting yet</span>
        )}
      </div>
      <div className="meeting-progress" aria-label="Meeting progress">
        <div>
          <span>{progress.label}</span>
          <strong>{progress.total ? `${progress.current}/${progress.total}` : "idle"}</strong>
        </div>
        <meter min={0} max={100} value={progressPercent} />
      </div>
    </section>
  );
}

interface TeamPanelProps {
  characters: Character[];
  onAdd: () => void;
  onEdit: (character: Character) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
}

function TeamPanel({ characters, onAdd, onEdit, onDelete, onToggle }: TeamPanelProps) {
  return (
    <section className="panel team-panel">
      <div className="panel-title">
        <h2>Team</h2>
        <button className="icon-button" onClick={onAdd} aria-label="Add character" title="Add character">
          <Plus size={17} />
        </button>
      </div>
      <div className="team-list">
        {characters.map((character) => (
          <article className="team-row" key={character.id}>
            <button className="enable-dot" onClick={() => onToggle(character.id)} title="Enable or disable character">
              <span
                style={{
                  background: character.enabled ? character.avatarColor : "#58606a",
                }}
              />
            </button>
            <div className="team-main">
              <strong>{character.name}</strong>
              <small>{character.role}</small>
              <small>{character.model}</small>
              <NeedStack needs={character.needs} />
            </div>
            <div className="team-state">
              <span className={`state-badge state-badge--${character.enabled ? character.state : "disabled"}`}>
                {character.enabled ? character.state : "off"}
              </span>
              <small>{roomById[character.currentRoom]?.name ?? character.currentRoom}</small>
            </div>
            <button className="icon-button" onClick={() => onEdit(character)} aria-label={`Edit ${character.name}`} title="Edit">
              <Edit3 size={15} />
            </button>
            <button className="icon-button danger" onClick={() => onDelete(character.id)} aria-label={`Delete ${character.name}`} title="Delete">
              <Trash2 size={15} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function NeedStack({ needs }: { needs: CharacterNeeds }) {
  return (
    <div className="need-stack" aria-label="Agent needs">
      {needKeys.map((key) => (
        <span className={`need-bar need-bar--${key}`} key={key} title={`${needLabels[key]} ${needs[key]}`}>
          <i style={{ width: `${needs[key]}%` }} />
        </span>
      ))}
    </div>
  );
}

function ConversationLog({ messages }: { messages: ConversationMessage[] }) {
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length]);

  return (
    <section className="conversation-panel">
      <div className="panel-title">
        <h2>Conversation</h2>
        <span>{messages.length} entries</span>
      </div>
      <div className="conversation-log" ref={logRef}>
        {messages.length ? (
          messages.map((message, index) => (
            <article
              className={`message message--${message.kind}${index === messages.length - 1 ? " message--latest" : ""}`}
              key={message.id}
            >
              <div className="message-meta">
                <strong>{message.speakerName}</strong>
                {message.role && <span>{message.role}</span>}
                <time>{formatTime(message.createdAt)}</time>
              </div>
              <p>{message.text}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">No session yet. The room is quietly doing idle loops.</p>
        )}
      </div>
    </section>
  );
}

function FinalAnswerPanel({ finalAnswer }: { finalAnswer: string }) {
  return (
    <section className="panel final-panel">
      <div className="panel-title">
        <h2>Final Answer</h2>
        {finalAnswer && <CheckCircle2 size={17} />}
      </div>
      <pre>{finalAnswer || "The synthesized team result will appear here after a session."}</pre>
    </section>
  );
}

function WorkflowPanel({ workflows, characters }: { workflows: ProjectWorkflow[]; characters: Character[] }) {
  const workflow = workflows[0];
  const characterName = (id?: string) => characters.find((character) => character.id === id)?.name ?? "Unassigned";

  return (
    <section className="panel workflow-panel">
      <div className="panel-title">
        <h2>Production Pipeline</h2>
        <GitPullRequest size={17} />
      </div>
      {workflow ? (
        <>
          <div className="workflow-summary">
            <strong>{workflow.status}</strong>
            <span>{workflow.task}</span>
          </div>
          <div className="workflow-meta">
            <span>Manager: {characterName(workflow.managerId)}</span>
            <span>{workflow.workItems.filter((item) => item.status === "accepted").length}/{workflow.workItems.length} accepted</span>
          </div>
          <div className="work-list">
            {workflow.workItems.map((item) => (
              <article className={`work-item work-item--${item.status}`} key={item.id}>
                <div className="work-item__head">
                  <strong>{item.title}</strong>
                  <span>{statusLabel(item.status)}</span>
                </div>
                <meter min={0} max={100} value={item.progress} />
                <p>{item.summary}</p>
                <div className="work-item__meta">
                  <span>{item.artifactName}</span>
                  <span>{characterName(item.assigneeId)}</span>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <p className="empty-state">After a team meeting, managers will open draft work items here for workers, leads, and QA.</p>
      )}
    </section>
  );
}

interface DiagnosticsPanelProps {
  logs: DiagnosticLogEntry[];
  smokeTests: SmokeTestResult[];
  onRunSmokeTests: () => void;
  onClear: () => void;
}

function DiagnosticsPanel({ logs, smokeTests, onRunSmokeTests, onClear }: DiagnosticsPanelProps) {
  const passCount = smokeTests.filter((item) => item.status === "pass").length;
  const warnCount = smokeTests.filter((item) => item.status === "warn").length;
  const failCount = smokeTests.filter((item) => item.status === "fail").length;

  return (
    <section className="panel diagnostics-panel">
      <div className="panel-title">
        <h2>Diagnostics Terminal</h2>
        <Terminal size={17} />
      </div>
      <div className="diagnostics-toolbar">
        <button className="primary-button" type="button" onClick={onRunSmokeTests}>
          <ListChecks size={16} />
          Run Smoke Test
        </button>
        <button className="ghost-button" type="button" onClick={onClear} disabled={!logs.length && !smokeTests.length}>
          <Trash2 size={16} />
          Clear
        </button>
      </div>
      <div className="smoke-summary" aria-label="Smoke test summary">
        <span className="smoke-summary--pass">{passCount} pass</span>
        <span className="smoke-summary--warn">{warnCount} warn</span>
        <span className="smoke-summary--fail">{failCount} fail</span>
      </div>
      {smokeTests.length ? (
        <div className="smoke-list">
          {smokeTests.map((item) => (
            <article className={`smoke-result smoke-result--${item.status}`} key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{item.status}</span>
              </div>
              <p>{item.message}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty-state">Run a smoke test to check the office loop, workflow, model mode, memory, and persistence.</p>
      )}
      <div className="terminal-window" aria-label="Diagnostic event log">
        {logs.length ? (
          logs.slice(0, 14).map((entry) => (
            <article className={`terminal-line terminal-line--${entry.level}`} key={entry.id}>
              <span>[{formatTime(entry.createdAt)}]</span>
              <strong>{entry.level}</strong>
              <em>{entry.source}</em>
              <p>{entry.message}</p>
              {entry.details && <small>{entry.details}</small>}
            </article>
          ))
        ) : (
          <div className="terminal-empty">
            <Bug size={16} />
            <span>No diagnostic events yet.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function MemoryPanel({ memories }: { memories: MemorySummary[] }) {
  return (
    <section className="panel memory-panel">
      <div className="panel-title">
        <h2>Memory</h2>
        <span>{memories.length}</span>
      </div>
      <div className="memory-list">
        {memories.length ? (
          memories.slice(0, 6).map((memory) => (
            <article key={memory.id}>
              <time>{formatTime(memory.createdAt)}</time>
              <p>{memory.text}</p>
            </article>
          ))
        ) : (
          <p className="empty-state">Completed tasks will save short shared memory summaries.</p>
        )}
      </div>
    </section>
  );
}

interface SettingsPanelProps {
  settings: AppSettings;
  setSettings: (settings: AppSettings) => void;
  ollamaStatus: OllamaStatus;
  onTestOllama: () => void;
}

function SettingsPanel({ settings, setSettings, ollamaStatus, onTestOllama }: SettingsPanelProps) {
  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings({ ...settings, [key]: value });
  };

  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <h2>Settings</h2>
        <Settings2 size={17} />
      </div>
      <label className="switch-row">
        <span>Demo mode</span>
        <input type="checkbox" checked={settings.demoMode} onChange={(event) => update("demoMode", event.target.checked)} />
      </label>
      <label>
        Ollama base URL
        <input value={settings.ollamaBaseUrl} onChange={(event) => update("ollamaBaseUrl", event.target.value)} />
      </label>
      <label>
        Default model
        <input value={settings.defaultModel} onChange={(event) => update("defaultModel", event.target.value)} />
      </label>
      <div className="settings-grid">
        <label>
          Max agents
          <input
            type="number"
            min={1}
            max={8}
            value={settings.maxAgentsPerMeeting}
            onChange={(event) => update("maxAgentsPerMeeting", Number(event.target.value))}
          />
        </label>
        <label>
          Bubble ms
          <input
            type="number"
            min={1500}
            step={500}
            value={settings.bubbleDurationMs}
            onChange={(event) => update("bubbleDurationMs", Number(event.target.value))}
          />
        </label>
        <label>
          Sim speed
          <input
            type="number"
            min={0.4}
            max={2.4}
            step={0.1}
            value={settings.simulationSpeed}
            onChange={(event) => update("simulationSpeed", Number(event.target.value))}
          />
        </label>
        <label>
          Timeout ms
          <input
            type="number"
            min={5000}
            step={5000}
            value={settings.aiRequestTimeoutMs}
            onChange={(event) => update("aiRequestTimeoutMs", Number(event.target.value))}
          />
        </label>
      </div>
      <button className="secondary-button" type="button" onClick={onTestOllama}>
        <Wifi size={16} />
        Test Ollama
      </button>
      <p className={`connection-note connection-note--${ollamaStatus.state}`}>{ollamaStatus.message}</p>
      {ollamaStatus.models.length > 0 && <p className="model-note">Models: {ollamaStatus.models.slice(0, 5).join(", ")}</p>}
    </section>
  );
}

interface CharacterEditorProps {
  character: Character;
  onClose: () => void;
  onSave: (character: Character) => void;
}

function CharacterEditor({ character, onClose, onSave }: CharacterEditorProps) {
  const [draft, setDraft] = useState<Character>(character);

  const update = <K extends keyof Character>(key: K, value: Character[K]) => {
    setDraft((previous) => ({ ...previous, [key]: value }));
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const roomChanged = draft.preferredRoom !== character.preferredRoom;
    const target = roomChanged ? getRandomRoomSpot(draft.preferredRoom) : draft.targetPosition;
    onSave({
      ...draft,
      name: draft.name.trim() || "Unnamed Agent",
      role: draft.role.trim() || "Generalist",
      model: draft.model.trim(),
      skills: draft.skills.map((skill) => skill.trim()).filter(Boolean),
      state: draft.enabled ? draft.state === "disabled" ? "idle" : draft.state : "disabled",
      targetPosition: target,
      currentRoom: roomChanged ? draft.preferredRoom : draft.currentRoom,
    });
  };

  return (
    <div className="modal-backdrop">
      <form className="character-editor" onSubmit={save}>
        <div className="panel-title">
          <h2>{character.name === "New Agent" ? "Create Character" : `Edit ${character.name}`}</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close editor" title="Close">
            <X size={18} />
          </button>
        </div>
        <div className="editor-grid">
          <label>
            Name
            <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
          </label>
          <label>
            Role/job
            <input value={draft.role} onChange={(event) => update("role", event.target.value)} />
          </label>
          <label>
            Model
            <input value={draft.model} onChange={(event) => update("model", event.target.value)} />
          </label>
          <label>
            Preferred room
            <select value={draft.preferredRoom} onChange={(event) => update("preferredRoom", event.target.value as RoomId)}>
              {rooms.map((room) => (
                <option value={room.id} key={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Avatar color
            <input type="color" value={draft.avatarColor} onChange={(event) => update("avatarColor", event.target.value)} />
          </label>
          <label className="switch-row">
            <span>Enabled</span>
            <input type="checkbox" checked={draft.enabled} onChange={(event) => update("enabled", event.target.checked)} />
          </label>
        </div>
        <label>
          Bio/personality
          <textarea value={draft.bio} onChange={(event) => update("bio", event.target.value)} rows={3} />
        </label>
        <label>
          Skills
          <input
            value={draft.skills.join(", ")}
            onChange={(event) => update("skills", event.target.value.split(",") as Character["skills"])}
          />
        </label>
        <label>
          Speaking style
          <input value={draft.speakingStyle} onChange={(event) => update("speakingStyle", event.target.value)} />
        </label>
        <div className="button-row">
          <button className="primary-button" type="submit">
            <Save size={16} />
            Save Character
          </button>
          <button className="ghost-button" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
