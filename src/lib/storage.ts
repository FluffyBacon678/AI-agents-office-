import { AppSettings, PersistedState } from "../types";

const STORAGE_KEY = "agent-aquarium:v1";

export const defaultSettings: AppSettings = {
  ollamaBaseUrl: "http://localhost:11434",
  defaultModel: "llama3.2:3b",
  demoMode: true,
  maxAgentsPerMeeting: 5,
  bubbleDurationMs: 5200,
  simulationSpeed: 1,
  aiRequestTimeoutMs: 90000,
};

export function loadPersistedState(): Partial<PersistedState> | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as Partial<PersistedState>;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
