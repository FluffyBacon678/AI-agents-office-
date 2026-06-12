import { Station, StationCategory, StationKind, Vector } from "../types";

function makeStation(params: {
  id: string;
  name: string;
  kind: StationKind;
  category: StationCategory;
  roomId: Station["roomId"];
  position: Vector;
  size: Vector;
  interactionSpots: Vector[];
  roleAffinity: string[];
  needEffects: Station["needEffects"];
  capacity: number;
  activity: string;
}): Station {
  return {
    ...params,
    interactionSpot: params.interactionSpots[0],
    roles: params.roleAffinity,
  };
}

export const stations: Station[] = [
  makeStation({
    id: "code-desk-a",
    name: "Code Desk",
    kind: "computer",
    category: "work",
    roomId: "desks",
    position: { x: 460, y: 500 },
    size: { x: 104, y: 58 },
    interactionSpots: [{ x: 462, y: 548 }],
    roleAffinity: ["programmer", "sysadmin"],
    needEffects: { focus: -0.7, energy: -0.35, recreation: -0.22, social: -0.12 },
    capacity: 1,
    activity: "coding",
  }),
  makeStation({
    id: "debug-desk",
    name: "Debug Desk",
    kind: "computer",
    category: "work",
    roomId: "desks",
    position: { x: 582, y: 500 },
    size: { x: 104, y: 58 },
    interactionSpots: [{ x: 584, y: 548 }],
    roleAffinity: ["programmer", "critic", "qa"],
    needEffects: { focus: -0.62, energy: -0.32, recreation: -0.24, social: -0.1 },
    capacity: 1,
    activity: "debugging",
  }),
  makeStation({
    id: "workbench",
    name: "Work Desk",
    kind: "workbench",
    category: "work",
    roomId: "desks",
    position: { x: 620, y: 580 },
    size: { x: 160, y: 50 },
    interactionSpots: [
      { x: 574, y: 606 },
      { x: 662, y: 606 },
    ],
    roleAffinity: ["programmer", "researcher", "project manager"],
    needEffects: { focus: -0.48, energy: -0.28, recreation: -0.18 },
    capacity: 2,
    activity: "drafting",
  }),
  makeStation({
    id: "art-table",
    name: "Art Table",
    kind: "art",
    category: "work",
    roomId: "art",
    position: { x: 210, y: 108 },
    size: { x: 185, y: 42 },
    interactionSpots: [
      { x: 164, y: 136 },
      { x: 244, y: 136 },
    ],
    roleAffinity: ["artist", "designer", "ux"],
    needEffects: { focus: -0.36, energy: -0.2, recreation: 0.12 },
    capacity: 2,
    activity: "sketching",
  }),
  makeStation({
    id: "research-terminal",
    name: "Research Terminal",
    kind: "archive",
    category: "work",
    roomId: "library",
    position: { x: 850, y: 572 },
    size: { x: 98, y: 62 },
    interactionSpots: [{ x: 850, y: 612 }],
    roleAffinity: ["researcher", "memory", "sysadmin"],
    needEffects: { focus: -0.42, energy: -0.22, recreation: -0.12 },
    capacity: 1,
    activity: "researching",
  }),
  makeStation({
    id: "archive-server",
    name: "Archive Server",
    kind: "archive",
    category: "work",
    roomId: "library",
    position: { x: 995, y: 542 },
    size: { x: 140, y: 92 },
    interactionSpots: [
      { x: 952, y: 604 },
      { x: 1030, y: 604 },
    ],
    roleAffinity: ["memory", "researcher", "sysadmin"],
    needEffects: { focus: -0.32, energy: -0.18, recreation: -0.08 },
    capacity: 2,
    activity: "archiving",
  }),
  makeStation({
    id: "meeting-table",
    name: "Meeting Table",
    kind: "meeting",
    category: "planning",
    roomId: "meeting",
    position: { x: 550, y: 282 },
    size: { x: 174, y: 92 },
    interactionSpots: [
      { x: 468, y: 246 },
      { x: 624, y: 246 },
      { x: 468, y: 340 },
      { x: 624, y: 340 },
      { x: 548, y: 382 },
    ],
    roleAffinity: ["project manager", "memory", "critic", "qa", "designer"],
    needEffects: { focus: 0.75, social: 0.45, energy: -0.16 },
    capacity: 5,
    activity: "planning",
  }),
  makeStation({
    id: "planning-board",
    name: "Planning Board",
    kind: "whiteboard",
    category: "planning",
    roomId: "whiteboard",
    position: { x: 856, y: 260 },
    size: { x: 180, y: 46 },
    interactionSpots: [
      { x: 796, y: 324 },
      { x: 866, y: 350 },
      { x: 932, y: 324 },
    ],
    roleAffinity: ["project manager", "critic", "qa", "researcher"],
    needEffects: { focus: 0.82, social: 0.2, energy: -0.1 },
    capacity: 3,
    activity: "reviewing",
  }),
  makeStation({
    id: "coffee-counter",
    name: "Coffee Counter",
    kind: "coffee",
    category: "social",
    roomId: "kitchen",
    position: { x: 182, y: 484 },
    size: { x: 170, y: 46 },
    interactionSpots: [
      { x: 124, y: 532 },
      { x: 196, y: 532 },
      { x: 260, y: 532 },
    ],
    roleAffinity: ["project manager", "programmer", "artist", "designer", "memory", "critic", "qa", "hr"],
    needEffects: { energy: 1.25, social: 1.35, recreation: 0.7, focus: 0.12 },
    capacity: 3,
    activity: "coffee break",
  }),
  makeStation({
    id: "snack-table",
    name: "Snack Table",
    kind: "social",
    category: "social",
    roomId: "kitchen",
    position: { x: 246, y: 554 },
    size: { x: 82, y: 44 },
    interactionSpots: [
      { x: 220, y: 580 },
      { x: 274, y: 580 },
    ],
    roleAffinity: ["project manager", "programmer", "artist", "designer", "memory", "critic", "qa", "hr"],
    needEffects: { social: 1.1, recreation: 0.92, energy: 0.55 },
    capacity: 2,
    activity: "snacking",
  }),
  makeStation({
    id: "lounge-sofa",
    name: "Lounge Sofa",
    kind: "lounge",
    category: "rest",
    roomId: "lounge",
    position: { x: 180, y: 242 },
    size: { x: 170, y: 58 },
    interactionSpots: [
      { x: 130, y: 294 },
      { x: 198, y: 306 },
      { x: 270, y: 294 },
    ],
    roleAffinity: ["artist", "designer", "memory", "programmer", "critic", "qa"],
    needEffects: { energy: 1.65, recreation: 1.45, social: 0.28, focus: 0.18 },
    capacity: 3,
    activity: "resting",
  }),
  makeStation({
    id: "game-corner",
    name: "Game Corner",
    kind: "lounge",
    category: "rest",
    roomId: "lounge",
    position: { x: 270, y: 328 },
    size: { x: 84, y: 48 },
    interactionSpots: [
      { x: 236, y: 330 },
      { x: 304, y: 330 },
    ],
    roleAffinity: ["programmer", "artist", "designer", "critic", "qa"],
    needEffects: { recreation: 1.75, social: 0.62, energy: 0.25, focus: 0.08 },
    capacity: 2,
    activity: "playing",
  }),
  makeStation({
    id: "team-lead-desk",
    name: "Lead Desk",
    kind: "manager",
    category: "management",
    roomId: "manager",
    position: { x: 880, y: 120 },
    size: { x: 98, y: 50 },
    interactionSpots: [{ x: 880, y: 152 }],
    roleAffinity: ["project manager", "manager", "lead"],
    needEffects: { focus: 0.5, social: 0.14, energy: -0.18 },
    capacity: 1,
    activity: "scheduling",
  }),
  makeStation({
    id: "hr-desk",
    name: "HR Desk",
    kind: "manager",
    category: "management",
    roomId: "manager",
    position: { x: 1020, y: 120 },
    size: { x: 98, y: 50 },
    interactionSpots: [{ x: 1020, y: 152 }],
    roleAffinity: ["hr", "project manager", "memory"],
    needEffects: { social: 0.65, recreation: 0.28, focus: 0.22, energy: -0.1 },
    capacity: 1,
    activity: "checking schedules",
  }),
];

export const stationById = stations.reduce(
  (acc, station) => {
    acc[station.id] = station;
    return acc;
  },
  {} as Record<string, Station>,
);

export function getStationsForRole(role: string, category?: StationCategory): Station[] {
  const cleanRole = role.toLowerCase();
  const source = category ? stations.filter((station) => station.category === category) : stations;
  const matched = source.filter((station) => station.roleAffinity.some((candidate) => cleanRole.includes(candidate)));
  return matched.length ? matched : source;
}

export function getRandomStationForRole(role: string, category?: StationCategory): Station {
  const candidates = getStationsForRole(role, category);
  return candidates[Math.floor(Math.random() * candidates.length)] ?? stations[0];
}
