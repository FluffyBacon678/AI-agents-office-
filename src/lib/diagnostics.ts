import {
  AIProvider,
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
const PROVIDER_LABELS: Record<AIProvider, string> = {
  ollama: "Local Ollama",
  openai: "ChatGPT / OpenAI",
  anthropic: "Claude / Anthropic",
  manual: "Demo/manual",
};

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

function getProvider(character: Character): AIProvider {
  if (character.provider) return character.provider;
  const model = character.model.toLowerCase();
  if (model.includes("claude") || model.includes("anthropic")) return "anthropic";
  if (model.includes("gpt") || model.includes("chatgpt") || model.includes("openai")) return "openai";
  if (model.includes("demo") || model.includes("manual")) return "manual";
  return "ollama";
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
  const providerCounts = enabledCharacters.reduce(
    (counts, character) => {
      const provider = getProvider(character);
      counts[provider] += 1;
      return counts;
    },
    { ollama: 0, openai: 0, anthropic: 0, manual: 0 } as Record<AIProvider, number>,
  );
  const remoteProviderCount = providerCounts.openai + providerCounts.anthropic;

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
      "Provider roster",
      remoteProviderCount > 0 ? "warn" : "pass",
      remoteProviderCount > 0
        ? `${remoteProviderCount} remote provider character(s) are configured for demo/planning until API connectors are added.`
        : `${PROVIDER_LABELS.ollama} covers the enabled roster.`,
    ),
    result(
      "Ollama discovery",
      input.ollamaStatus.state === "connected"
        ? input.ollamaStatus.models.length > 0
          ? "pass"
          : "warn"
        : input.ollamaStatus.state === "failed"
          ? "fail"
          : "warn",
      input.ollamaStatus.state === "connected"
        ? input.ollamaStatus.models.length > 0
          ? `${input.ollamaStatus.models.length} local Ollama model(s) detected.`
          : "Ollama responded, but did not list any local models."
        : input.ollamaStatus.message || "Ollama has not been checked yet.",
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
