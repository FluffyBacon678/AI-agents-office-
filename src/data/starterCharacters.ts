import { Character } from "../types";
import { getRoomSpot } from "./rooms";

const makeCharacter = (
  id: string,
  name: string,
  role: string,
  model: string,
  bio: string,
  skills: string[],
  speakingStyle: string,
  preferredRoom: Character["preferredRoom"],
  avatarColor: string,
  spotIndex: number,
): Character => {
  const position = getRoomSpot(preferredRoom, spotIndex);

  return {
    id,
    name,
    role,
    model,
    provider: "ollama",
    bio,
    skills,
    speakingStyle,
    preferredRoom,
    avatarColor,
    enabled: true,
    personalMemory: [],
    needs: {
      focus: 74,
      recreation: 68,
      social: 66,
      energy: 78,
    },
    scheduleMode: "auto",
    managerRole: role.toLowerCase().includes("project manager")
      ? "teamLead"
      : role.toLowerCase().includes("hr")
        ? "hr"
        : undefined,
    state: "idle",
    currentRoom: preferredRoom,
    position,
    targetPosition: position,
  };
};

export const starterCharacters: Character[] = [
  makeCharacter(
    "starter-bruno",
    "Bruno",
    "Project Manager",
    "llama3.2:3b",
    "Friendly but pushy. Keeps everyone focused. Breaks messy ideas into practical tasks.",
    ["planning", "task breakdown", "prioritization", "summarization"],
    "practical, short, organized",
    "meeting",
    "#d89555",
    0,
  ),
  makeCharacter(
    "starter-otto",
    "Otto",
    "Programmer",
    "qwen2.5-coder:7b",
    "Quiet, technical, precise. Dislikes vague requirements and wants implementation details.",
    ["architecture", "APIs", "local apps", "debugging", "TypeScript"],
    "direct, technical, concise",
    "desks",
    "#72a7d9",
    1,
  ),
  makeCharacter(
    "starter-iris",
    "Iris",
    "Critic / QA",
    "mistral:7b",
    "Skeptical and direct. Checks if ideas are realistic, overcomplicated, or risky.",
    ["critique", "feasibility", "QA", "risk analysis"],
    "blunt, clear, skeptical",
    "whiteboard",
    "#d46f6f",
    0,
  ),
  makeCharacter(
    "starter-luna",
    "Luna",
    "Artist / UX Designer",
    "gemma3:4b",
    "Creative visual thinker. Likes cozy, readable, expressive UI ideas.",
    ["visual design", "UX", "mood", "layout", "character ideas"],
    "imaginative but understandable",
    "art",
    "#c982c7",
    1,
  ),
  makeCharacter(
    "starter-memo",
    "Memo",
    "Memory Keeper",
    "llama3.2:3b",
    "Quiet archivist. Summarizes what happened and saves useful project decisions.",
    ["summarization", "notes", "memory", "project history"],
    "short, archival, neutral",
    "library",
    "#8dc27f",
    1,
  ),
  makeCharacter(
    "starter-penny",
    "Penny",
    "HR Coordinator",
    "llama3.2:3b",
    "Warm but organized. Watches the team's energy, social rhythm, and meeting cadence.",
    ["schedules", "team health", "coordination", "check-ins"],
    "gentle, brief, observant",
    "manager",
    "#e5b56f",
    1,
  ),
];
