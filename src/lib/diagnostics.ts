import {
  AppSettings,
  Character,
  MemorySummary,
  OllamaStatus,
  ProjectWorkflow,
  SmokeTestResult,
  SmokeTestStatus,
  Station,
  TaskSession,
} from "../types";

const NEED_KEYS = ["focus", "recreation", "social", "energy"] as const;
const REQUIRED_STATION_CATEGORIES = ["work", "planning", "rest", "social", "management"] as const;

interface SmokeTestInput {
  characters: Character[];
  settings: AppSettings;
  memories: MemorySummary[];
  sessions: TaskSession[];
  workflows: ProjectWorkflow[];
  stations: Station[];
  finalAnswer: string;
  ollamaStatus: OllamaStatus;
}

function smokeId(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`;
}

function result(name: string, status: SmokeTestStatus, message: string): SmokeTestResult {
  return {
    id: smokeId(name),
    name,
    status,
    message,
    createdAt: new Date().toISOString(),
  };
}

function canUseLocalStorage(): boolean {
  if (typeof localStorage === "undefined") {
    return false;
  }

  try {
    const key = "__agent_aquarium_smoke__";
    localStorage.setItem(key, "ok");
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function runSmokeTests(input: SmokeTestInput): SmokeTestResult[] {
  const enabledCharacters = input.characters.filter((character) => character.enabled);
  const missingNeeds = enabledCharacters.filter((character) =>
    NEED_KEYS.some((key) => !Number.isFinite(character.needs?.[key])),
  );
  const stationCategories = new Set(input.stations.map((station) => station.category));
  const missingCategories = REQUIRED_STATION_CATEGORIES.filter((category) => !stationCategories.has(category));
  const occupiedStationCount = enabledCharacters.filter((character) => Boolean(character.currentStationId)).length;
  const erroredCharacters = enabledCharacters.filter((character) => character.state === "error");
  const latestWorkflow = input.workflows[0];
  const latestSession = input.sessions[0];
  const hasFinalAnswer = Boolean(input.finalAnswer.trim() || latestSession?.finalAnswer?.trim());
  const persistenceAvailable = canUseLocalStorage();

  return [
    result(
      "Team roster",
      enabledCharacters.length > 0 ? "pass" : "fail",
      enabledCharacters.length > 0
        ? `${enabledCharacters.length} enabled agents are available for the workday loop.`
        : "No enabled agents are available.",
    ),
    result(
      "Agent needs",
      missingNeeds.length === 0 ? "pass" : "fail",
      missingNeeds.length === 0
        ? "Every enabled agent has focus, recreation, social, and energy values."
        : `${missingNeeds.length} enabled agent(s) are missing valid need values.`,
    ),
    result(
      "Campus stations",
      missingCategories.length === 0 ? "pass" : "fail",
      missingCategories.length === 0
        ? `${input.stations.length} stations cover work, planning, rest, social, and management.`
        : `Missing station categories: ${missingCategories.join(", ")}.`,
    ),
    result(
      "Autonomous placement",
      occupiedStationCount > 0 ? "pass" : "warn",
      occupiedStationCount > 0
        ? `${occupiedStationCount} agent(s) have active station assignments.`
        : "No agents have station assignments yet; let the sim tick for a moment.",
    ),
    result(
      "Runtime agent state",
      erroredCharacters.length === 0 ? "pass" : "fail",
      erroredCharacters.length === 0
        ? "No enabled agents are in an error state."
        : `${erroredCharacters.length} enabled agent(s) are in an error state.`,
    ),
    result(
      "Workflow pipeline",
      latestWorkflow
        ? latestWorkflow.workItems.length > 0
          ? latestWorkflow.status === "complete"
            ? "pass"
            : "warn"
          : "fail"
        : "warn",
      latestWorkflow
        ? latestWorkflow.workItems.length > 0
          ? `Latest workflow is ${latestWorkflow.status} with ${latestWorkflow.workItems.length} work item(s).`
          : "Latest workflow has no work items."
        : "No workflow has been started yet.",
    ),
    result(
      "AI connection mode",
      input.settings.demoMode || input.ollamaStatus.state === "connected"
        ? "pass"
        : input.ollamaStatus.state === "failed"
          ? "fail"
          : "warn",
      input.settings.demoMode
        ? "Demo mode is enabled, so meetings can complete without Ollama."
        : input.ollamaStatus.state === "connected"
          ? "Ollama connection is ready."
          : input.ollamaStatus.message || "Ollama has not been tested yet.",
    ),
    result(
      "Task output",
      hasFinalAnswer ? "pass" : "warn",
      hasFinalAnswer
        ? "A final answer is present for the latest task."
        : "No final answer yet; run a task to verify meeting output.",
    ),
    result(
      "Memory ledger",
      input.memories.length > 0 ? "pass" : "warn",
      input.memories.length > 0
        ? `${input.memories.length} saved memory summar${input.memories.length === 1 ? "y" : "ies"} available.`
        : "No memories saved yet.",
    ),
    result(
      "Persistence",
      persistenceAvailable ? "pass" : "fail",
      persistenceAvailable
        ? "Browser localStorage accepts writes for save data."
        : "Browser localStorage is unavailable or blocked.",
    ),
  ];
}
