export type RoomId =
  | "meeting"
  | "whiteboard"
  | "desks"
  | "kitchen"
  | "lounge"
  | "library"
  | "art"
  | "manager";

export type CharacterState =
  | "idle"
  | "working"
  | "walking"
  | "gathering"
  | "waiting"
  | "thinking"
  | "speaking"
  | "returning"
  | "error"
  | "disabled";

export type SessionStatus =
  | "idle"
  | "gathering"
  | "running"
  | "complete"
  | "cancelled"
  | "error";

export type DiagnosticLevel = "info" | "warn" | "error" | "success";
export type DiagnosticSource =
  | "system"
  | "ollama"
  | "openai"
  | "anthropic"
  | "workflow"
  | "simulation"
  | "smoke"
  | "runtime";
export type SmokeTestStatus = "pass" | "warn" | "fail";

export interface Vector {
  x: number;
  y: number;
}

export interface Room {
  id: RoomId;
  name: string;
  type: string;
  rect: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  anchor: Vector;
  spots: Vector[];
  fill: string;
  stroke: string;
}

export type NeedKey = "focus" | "recreation" | "social" | "energy";

export type CharacterNeeds = Record<NeedKey, number>;

export type ScheduleMode = "auto" | "work" | "rest" | "social" | "meeting";

export type ManagerRole = "teamLead" | "hr" | "reviewer";

export type AIProvider = "ollama" | "openai" | "anthropic" | "manual";

export type StationKind =
  | "computer"
  | "workbench"
  | "whiteboard"
  | "coffee"
  | "lounge"
  | "archive"
  | "art"
  | "meeting"
  | "manager"
  | "social";

export type StationCategory = "work" | "planning" | "rest" | "social" | "management";

export interface Station {
  id: string;
  name: string;
  kind: StationKind;
  category: StationCategory;
  roomId: RoomId;
  position: Vector;
  size: Vector;
  interactionSpot: Vector;
  interactionSpots: Vector[];
  roles: string[];
  roleAffinity: string[];
  needEffects: Partial<CharacterNeeds>;
  capacity: number;
  activity: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  model: string;
  provider?: AIProvider;
  bio: string;
  skills: string[];
  speakingStyle: string;
  preferredRoom: RoomId;
  avatarColor: string;
  enabled: boolean;
  personalMemory: string[];
  state: CharacterState;
  currentRoom: RoomId;
  position: Vector;
  targetPosition: Vector;
  needs: CharacterNeeds;
  scheduleMode: ScheduleMode;
  managerRole?: ManagerRole;
  currentStationId?: string;
  stationId?: string;
  activity?: string;
}

export interface AppSettings {
  ollamaBaseUrl: string;
  defaultModel: string;
  demoMode: boolean;
  maxAgentsPerMeeting: number;
  bubbleDurationMs: number;
  simulationSpeed: number;
  aiRequestTimeoutMs: number;
}

export type MessageKind = "speech" | "system" | "error" | "final" | "memory";

export interface ConversationMessage {
  id: string;
  sessionId: string;
  speakerId?: string;
  speakerName: string;
  role?: string;
  text: string;
  kind: MessageKind;
  createdAt: string;
}

export interface MemorySummary {
  id: string;
  createdAt: string;
  task: string;
  text: string;
}

export interface TaskSession {
  id: string;
  task: string;
  selectedCharacterIds: string[];
  messages: ConversationMessage[];
  finalAnswer?: string;
  memorySummary?: string;
  status: SessionStatus;
  createdAt: string;
  completedAt?: string;
}

export type WorkItemType = "code" | "graphics" | "research" | "qa" | "planning" | "memory";

export type WorkItemStatus =
  | "assigned"
  | "working"
  | "lead-review"
  | "qa-test"
  | "accepted"
  | "rework";

export interface ProjectWorkItem {
  id: string;
  title: string;
  type: WorkItemType;
  status: WorkItemStatus;
  assigneeId?: string;
  reviewerId?: string;
  qaId?: string;
  progress: number;
  summary: string;
  artifactName: string;
  updatedAt: string;
}

export type ProjectWorkflowStatus = "idle" | "planning" | "working" | "reviewing" | "qa" | "complete";

export interface ProjectWorkflow {
  id: string;
  task: string;
  status: ProjectWorkflowStatus;
  managerId?: string;
  teamLeadIds: string[];
  workItems: ProjectWorkItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DiagnosticLogEntry {
  id: string;
  createdAt: string;
  level: DiagnosticLevel;
  source: DiagnosticSource;
  message: string;
  details?: string;
}

export interface SmokeTestResult {
  id: string;
  name: string;
  status: SmokeTestStatus;
  message: string;
  createdAt: string;
}

export interface SpeechBubble {
  id: string;
  characterId: string;
  text: string;
  kind: "speech" | "thinking" | "error" | "system";
  expiresAt: number;
}

export interface PersistedState {
  characters: Character[];
  settings: AppSettings;
  memories: MemorySummary[];
  sessions: TaskSession[];
  workflows?: ProjectWorkflow[];
  diagnosticLogs?: DiagnosticLogEntry[];
  smokeTests?: SmokeTestResult[];
}

export interface OllamaStatus {
  state: "unknown" | "testing" | "connected" | "failed";
  message: string;
  models: string[];
}
