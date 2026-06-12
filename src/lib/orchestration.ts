import { AppSettings, Character, ConversationMessage, MemorySummary } from "../types";

const rolePriority = [
  "project manager",
  "programmer",
  "critic",
  "qa",
  "designer",
  "artist",
  "researcher",
  "memory",
  "sysadmin",
];

const roleKeywords: Record<string, string[]> = {
  "project manager": ["plan", "scope", "roadmap", "prioritize", "team", "mvp", "project"],
  programmer: ["code", "app", "api", "backend", "frontend", "architecture", "typescript", "ollama", "local"],
  "critic / qa": ["risk", "test", "bug", "quality", "feasible", "review", "warning"],
  critic: ["risk", "test", "bug", "quality", "feasible", "review", "warning"],
  qa: ["risk", "test", "bug", "quality", "feasible", "review", "warning"],
  "artist / ux designer": ["ui", "ux", "visual", "cozy", "design", "feel", "layout", "wallpaper"],
  artist: ["ui", "ux", "visual", "cozy", "design", "feel", "layout", "wallpaper"],
  designer: ["ui", "ux", "visual", "cozy", "design", "feel", "layout", "wallpaper"],
  researcher: ["research", "unknown", "compare", "find", "investigate"],
  "memory keeper": ["summary", "memory", "decision", "history", "remember"],
  memory: ["summary", "memory", "decision", "history", "remember"],
  sysadmin: ["windows", "local", "service", "performance", "config", "ollama", "gpu", "logs"],
};

export function shortId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function selectCharactersForTask(
  task: string,
  characters: Character[],
  settings: AppSettings,
): Character[] {
  const enabled = characters.filter((character) => character.enabled);
  const terms = task.toLowerCase();

  const scored = enabled.map((character, index) => {
    const role = character.role.toLowerCase();
    const skillText = character.skills.join(" ").toLowerCase();
    let score = 0;

    if (role.includes("project manager")) score += 12;
    if (role.includes("critic") || role.includes("qa")) score += 8;
    if (role.includes("memory")) score += 5;

    for (const [key, words] of Object.entries(roleKeywords)) {
      if (role.includes(key)) {
        score += words.filter((word) => terms.includes(word)).length * 4;
      }
    }

    for (const word of terms.split(/\W+/).filter((word) => word.length > 3)) {
      if (role.includes(word)) score += 3;
      if (skillText.includes(word)) score += 4;
      if (character.bio.toLowerCase().includes(word)) score += 1;
    }

    const priorityIndex = rolePriority.findIndex((priority) => role.includes(priority));
    const priority = priorityIndex === -1 ? rolePriority.length : priorityIndex;

    return { character, score, priority, index };
  });

  const selected = scored
    .sort((a, b) => b.score - a.score || a.priority - b.priority || a.index - b.index)
    .slice(0, Math.max(1, settings.maxAgentsPerMeeting))
    .map((item) => item.character);

  const projectManager = enabled.find((character) => character.role.toLowerCase().includes("project manager"));
  if (projectManager && !selected.some((character) => character.id === projectManager.id)) {
    selected.pop();
    selected.unshift(projectManager);
  }

  const critic = enabled.find((character) => {
    const role = character.role.toLowerCase();
    return role.includes("critic") || role.includes("qa");
  });
  if (critic && selected.length > 1 && !selected.some((character) => character.id === critic.id)) {
    selected[selected.length - 1] = critic;
  }

  const memoryKeeper = enabled.find((character) => character.role.toLowerCase().includes("memory"));
  if (memoryKeeper && selected.length >= 3 && !selected.some((character) => character.id === memoryKeeper.id)) {
    selected[selected.length - 1] = memoryKeeper;
  }

  return selected.slice(0, settings.maxAgentsPerMeeting);
}

export function orderSpeakers(characters: Character[]): Character[] {
  return [...characters].sort((a, b) => {
    const roleA = a.role.toLowerCase();
    const roleB = b.role.toLowerCase();
    const aIndex = rolePriority.findIndex((role) => roleA.includes(role));
    const bIndex = rolePriority.findIndex((role) => roleB.includes(role));
    return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex);
  });
}

export function createDemoResponse(params: {
  character: Character;
  task: string;
  messages: ConversationMessage[];
}): string {
  const role = params.character.role.toLowerCase();
  const taskHint = params.task.length > 80 ? `${params.task.slice(0, 80)}...` : params.task;

  if (role.includes("project manager")) {
    return `Let's split "${taskHint}" into the core loop, visible behavior, AI queue, and a final deliverable.`;
  }

  if (role.includes("programmer")) {
    return "Keep simulation state separate from AI orchestration so slow model calls never freeze the room.";
  }

  if (role.includes("critic") || role.includes("qa")) {
    return "The risk is overbuilding. Prove the loop first, show errors clearly, and avoid parallel local model calls.";
  }

  if (role.includes("artist") || role.includes("ux") || role.includes("designer")) {
    return "Make the office readable at a glance: warm zones, clear bubbles, and agents that visibly gather before talking.";
  }

  if (role.includes("memory")) {
    return "Saved decision candidate: standalone app first, visual wallpaper viewer later.";
  }

  if (role.includes("sysadmin")) {
    return "Treat Ollama as optional at launch. Test localhost, expose model names, and keep a demo fallback ready.";
  }

  if (role.includes("research")) {
    return "The unknowns are model availability, user hardware, and how much context each turn can afford.";
  }

  return "I would keep my contribution short, role-specific, and tied to the task outcome.";
}

export function createFinalAnswer(task: string, messages: ConversationMessage[], demoMode: boolean): string {
  const speeches = messages.filter((message) => message.kind === "speech");
  const bullets = speeches
    .slice(-6)
    .map((message) => `- ${message.speakerName}: ${message.text}`)
    .join("\n");

  if (!speeches.length) {
    return "The team did not produce enough discussion to synthesize a final answer.";
  }

  if (demoMode) {
    return [
      `Team answer for: ${task}`,
      "",
      "Recommended direction:",
      "- Build the standalone app as the primary runtime.",
      "- Keep the visible office simulation alive while AI work happens sequentially.",
      "- Use editable characters with role-specific prompts and local persistence.",
      "- Treat Ollama as optional through demo mode, clear connection testing, and user-editable model names.",
      "- Save a short memory summary after each completed task.",
      "",
      "Discussion signals:",
      bullets,
    ].join("\n");
  }

  return [
    `Team answer for: ${task}`,
    "",
    "Synthesis:",
    bullets,
    "",
    "Next step: turn the strongest points above into a concrete implementation plan or deliverable.",
  ].join("\n");
}

export function createMemorySummary(task: string, messages: ConversationMessage[]): string {
  const firstUseful = messages.find((message) => message.kind === "speech")?.text;
  const lastUseful = [...messages].reverse().find((message) => message.kind === "speech")?.text;
  const basis = lastUseful || firstUseful || "Team discussed the task.";
  return `Decision: For "${task.slice(0, 90)}${task.length > 90 ? "..." : ""}", the team concluded: ${basis}`;
}

export function cleanSpeech(text: string): string {
  return text
    .replace(/as an ai language model,?/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function bubblePreview(text: string, maxLength = 112): string {
  const clean = cleanSpeech(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength - 3).trim()}...`;
}
