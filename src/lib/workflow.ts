import { Character, ProjectWorkflow, ProjectWorkflowStatus, ProjectWorkItem, WorkItemStatus, WorkItemType } from "../types";
import { shortId } from "./orchestration";

function nowIso(): string {
  return new Date().toISOString();
}

function roleIncludes(character: Character, ...terms: string[]): boolean {
  const role = character.role.toLowerCase();
  const skills = character.skills.join(" ").toLowerCase();
  return terms.some((term) => role.includes(term) || skills.includes(term));
}

export function pickManager(characters: Character[]): Character | undefined {
  return (
    characters.find((character) => character.enabled && character.managerRole === "teamLead") ??
    characters.find((character) => character.enabled && roleIncludes(character, "project manager", "manager", "lead"))
  );
}

export function pickReviewer(characters: Character[]): Character | undefined {
  return (
    characters.find((character) => character.enabled && character.managerRole === "reviewer") ??
    characters.find((character) => character.enabled && roleIncludes(character, "critic", "qa", "review"))
  );
}

export function pickQa(characters: Character[]): Character | undefined {
  return characters.find((character) => character.enabled && roleIncludes(character, "qa", "critic", "test"));
}

function pickWorker(characters: Character[], type: WorkItemType): Character | undefined {
  const enabled = characters.filter((character) => character.enabled);
  if (type === "code") return enabled.find((character) => roleIncludes(character, "programmer", "code", "typescript", "api"));
  if (type === "graphics") return enabled.find((character) => roleIncludes(character, "artist", "designer", "ux", "visual"));
  if (type === "research") return enabled.find((character) => roleIncludes(character, "research", "memory", "archive"));
  if (type === "qa") return pickQa(enabled);
  if (type === "memory") return enabled.find((character) => roleIncludes(character, "memory", "summary"));
  return pickManager(enabled);
}

function inferWorkTypes(task: string): WorkItemType[] {
  const lower = task.toLowerCase();
  const types = new Set<WorkItemType>(["planning"]);
  if (/code|app|api|typescript|bug|feature|tool|backend|frontend/.test(lower)) types.add("code");
  if (/visual|ui|sprite|texture|art|graphic|design|map|character/.test(lower)) types.add("graphics");
  if (/research|compare|find|investigate|unknown|ollama|model/.test(lower)) types.add("research");
  types.add("qa");
  types.add("memory");
  return Array.from(types).slice(0, 6);
}

function artifactName(type: WorkItemType): string {
  if (type === "code") return "draft-code-plan.md";
  if (type === "graphics") return "visual-asset-notes.md";
  if (type === "research") return "research-notes.md";
  if (type === "qa") return "smoke-test-report.md";
  if (type === "memory") return "decision-summary.md";
  return "implementation-plan.md";
}

function titleForType(type: WorkItemType, task: string): string {
  const hint = task.length > 54 ? `${task.slice(0, 54)}...` : task;
  if (type === "code") return `Implement code plan for "${hint}"`;
  if (type === "graphics") return `Prepare visual direction for "${hint}"`;
  if (type === "research") return `Research constraints for "${hint}"`;
  if (type === "qa") return `Smoke test plan for "${hint}"`;
  if (type === "memory") return `Capture decisions for "${hint}"`;
  return `Break down "${hint}"`;
}

export function createWorkflowFromTask(task: string, characters: Character[]): ProjectWorkflow {
  const manager = pickManager(characters);
  const reviewer = pickReviewer(characters);
  const qa = pickQa(characters);
  const types = inferWorkTypes(task);

  const workItems: ProjectWorkItem[] = types.map((type) => {
    const worker = pickWorker(characters, type);
    return {
      id: shortId("work"),
      title: titleForType(type, task),
      type,
      status: "assigned",
      assigneeId: worker?.id,
      reviewerId: reviewer?.id ?? manager?.id,
      qaId: qa?.id,
      progress: 0,
      summary: worker ? `${worker.name} is queued to start ${type} work.` : `Waiting for an available ${type} worker.`,
      artifactName: artifactName(type),
      updatedAt: nowIso(),
    };
  });

  return {
    id: shortId("workflow"),
    task,
    status: "planning",
    managerId: manager?.id,
    teamLeadIds: [manager?.id, reviewer?.id].filter(Boolean) as string[],
    workItems,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function advanceWorkItem(item: ProjectWorkItem): ProjectWorkItem {
  const updatedAt = nowIso();
  if (item.status === "accepted") return item;

  if (item.status === "assigned") {
    return {
      ...item,
      status: "working",
      progress: Math.max(item.progress, 12),
      summary: "Worker started drafting the assigned output.",
      updatedAt,
    };
  }

  if (item.status === "working") {
    const progress = Math.min(100, item.progress + 22 + Math.round(Math.random() * 18));
    if (progress >= 100) {
      return {
        ...item,
        status: "lead-review",
        progress: 100,
        summary: `Draft ready: ${item.artifactName}. Team lead is checking quality and scope.`,
        updatedAt,
      };
    }
    return {
      ...item,
      progress,
      summary: `Drafting ${item.artifactName}.`,
      updatedAt,
    };
  }

  if (item.status === "lead-review") {
    const needsRework = Math.random() < 0.18;
    return {
      ...item,
      status: needsRework ? "rework" : "qa-test",
      progress: needsRework ? 68 : 100,
      summary: needsRework
        ? "Lead found a gap and sent this back for rework."
        : "Lead approved the draft. QA smoke test is next.",
      updatedAt,
    };
  }

  if (item.status === "rework") {
    return {
      ...item,
      status: "working",
      progress: Math.min(92, item.progress + 18),
      summary: "Worker is addressing lead feedback.",
      updatedAt,
    };
  }

  if (item.status === "qa-test") {
    const passed = Math.random() < 0.82;
    return {
      ...item,
      status: passed ? "accepted" : "rework",
      progress: passed ? 100 : 72,
      summary: passed
        ? `QA smoke test passed. ${item.artifactName} is accepted for manager review.`
        : "QA smoke test found an issue. Sending back for rework.",
      updatedAt,
    };
  }

  return item;
}

export function getWorkflowStatus(items: ProjectWorkItem[]): ProjectWorkflowStatus {
  if (items.every((item) => item.status === "accepted")) return "complete";
  if (items.some((item) => item.status === "qa-test")) return "qa";
  if (items.some((item) => item.status === "lead-review")) return "reviewing";
  if (items.some((item) => item.status === "working" || item.status === "rework")) return "working";
  return "planning";
}

export function statusLabel(status: WorkItemStatus): string {
  if (status === "lead-review") return "Lead review";
  if (status === "qa-test") return "QA smoke test";
  return status;
}
