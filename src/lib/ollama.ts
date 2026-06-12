import { AppSettings, Character, ConversationMessage, MemorySummary } from "../types";

export interface OllamaGenerateResult {
  text: string;
}

export interface OllamaTestResult {
  ok: boolean;
  message: string;
  models: string[];
}

function joinBase(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function makeTimeoutSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      window.clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    },
    { once: true },
  );

  return controller.signal;
}

export async function testOllamaConnection(baseUrl: string, timeoutMs: number): Promise<OllamaTestResult> {
  try {
    const signal = makeTimeoutSignal(undefined, timeoutMs);
    const response = await fetch(joinBase(baseUrl, "/api/tags"), { signal });
    if (!response.ok) {
      return {
        ok: false,
        message: `Ollama replied with HTTP ${response.status}.`,
        models: [],
      };
    }

    const data = (await response.json()) as { models?: Array<{ name?: string }> };
    const models = (data.models ?? []).map((model) => model.name).filter(Boolean) as string[];
    return {
      ok: true,
      message: models.length ? `Connected. Found ${models.length} local model(s).` : "Connected. No local models were listed.",
      models,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not reach Ollama.",
      models: [],
    };
  }
}

export function buildCharacterPrompt(params: {
  character: Character;
  task: string;
  selectedCharacters: Character[];
  recentMessages: ConversationMessage[];
  memories: MemorySummary[];
}): string {
  const { character, task, selectedCharacters, recentMessages, memories } = params;
  const others = selectedCharacters
    .filter((agent) => agent.id !== character.id)
    .map((agent) => `${agent.name} (${agent.role})`)
    .join(", ");
  const recent = recentMessages
    .slice(-6)
    .map((message) => `${message.speakerName}: ${message.text}`)
    .join("\n");
  const memoryText = memories
    .slice(-3)
    .map((memory) => `- ${memory.text}`)
    .join("\n");

  return [
    `You are ${character.name}, a character in a tiny local AI office simulation.`,
    `Role/job: ${character.role}`,
    `Bio/personality: ${character.bio}`,
    `Skills: ${character.skills.join(", ") || "general reasoning"}`,
    `Speaking style: ${character.speakingStyle}`,
    `Preferred/current room: ${character.preferredRoom}`,
    `Current user task: ${task}`,
    others ? `Other agents present: ${others}` : "Other agents present: none",
    memoryText ? `Recent team memory:\n${memoryText}` : "Recent team memory: none",
    recent ? `Recent discussion:\n${recent}` : "Recent discussion: none yet",
    "Stay in character and be useful.",
    "Do not say that you are an AI language model.",
    "Respond as the character.",
    "Keep the response short enough for speech bubbles: one concise paragraph, 1 to 3 short sentences.",
  ].join("\n\n");
}

export async function generateOllamaTurn(params: {
  settings: AppSettings;
  character: Character;
  task: string;
  selectedCharacters: Character[];
  recentMessages: ConversationMessage[];
  memories: MemorySummary[];
  signal?: AbortSignal;
}): Promise<OllamaGenerateResult> {
  const prompt = buildCharacterPrompt(params);
  const signal = makeTimeoutSignal(params.signal, params.settings.aiRequestTimeoutMs);

  const response = await fetch(joinBase(params.settings.ollamaBaseUrl, "/api/generate"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: params.character.model || params.settings.defaultModel,
      prompt,
      stream: false,
      options: {
        num_predict: 120,
        temperature: 0.7,
      },
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed with HTTP ${response.status}. Check the model name or enable demo mode.`);
  }

  const data = (await response.json()) as { response?: string; error?: string };
  if (data.error) {
    throw new Error(data.error);
  }

  const text = (data.response ?? "").trim();
  if (!text) {
    throw new Error("Ollama returned an empty response.");
  }

  return { text };
}
