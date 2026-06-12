import { Room, RoomId, Vector } from "../types";

export const WORLD_WIDTH = 1180;
export const WORLD_HEIGHT = 720;

export interface CampusPath {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
  kind: "stone" | "dirt" | "hall";
}

export interface CampusDecoration {
  id: string;
  kind: "tree" | "shrub" | "lamp" | "flowers" | "water";
  position: Vector;
  size?: number;
}

export const campusPaths: CampusPath[] = [
  { id: "main-east-west", kind: "stone", rect: { x: 30, y: 380, w: 1090, h: 42 } },
  { id: "north-walk", kind: "stone", rect: { x: 140, y: 42, w: 840, h: 34 } },
  { id: "left-vertical", kind: "dirt", rect: { x: 180, y: 64, w: 38, h: 558 } },
  { id: "center-vertical", kind: "stone", rect: { x: 560, y: 72, w: 42, h: 570 } },
  { id: "right-vertical", kind: "stone", rect: { x: 960, y: 68, w: 40, h: 570 } },
  { id: "office-connector", kind: "hall", rect: { x: 320, y: 258, w: 700, h: 34 } },
  { id: "south-walk", kind: "dirt", rect: { x: 120, y: 632, w: 930, h: 34 } },
];

export const campusDecorations: CampusDecoration[] = [
  { id: "tree-left", kind: "tree", position: { x: 86, y: 610 }, size: 40 },
  { id: "tree-top", kind: "tree", position: { x: 1042, y: 48 }, size: 30 },
  { id: "pond", kind: "water", position: { x: 112, y: 94 }, size: 48 },
  { id: "flowers-meeting", kind: "flowers", position: { x: 742, y: 420 }, size: 12 },
  { id: "flowers-lounge", kind: "flowers", position: { x: 72, y: 380 }, size: 12 },
  { id: "shrub-1", kind: "shrub", position: { x: 345, y: 612 }, size: 18 },
  { id: "shrub-2", kind: "shrub", position: { x: 760, y: 638 }, size: 18 },
  { id: "shrub-3", kind: "shrub", position: { x: 1090, y: 380 }, size: 18 },
  { id: "lamp-1", kind: "lamp", position: { x: 120, y: 382 }, size: 12 },
  { id: "lamp-2", kind: "lamp", position: { x: 540, y: 80 }, size: 12 },
  { id: "lamp-3", kind: "lamp", position: { x: 1004, y: 420 }, size: 12 },
  { id: "lamp-4", kind: "lamp", position: { x: 600, y: 632 }, size: 12 },
];

export const rooms: Room[] = [
  {
    id: "lounge",
    name: "Staff Room",
    type: "rest + social",
    rect: { x: 60, y: 176, w: 270, h: 188 },
    anchor: { x: 198, y: 270 },
    spots: [
      { x: 142, y: 250 },
      { x: 214, y: 304 },
      { x: 268, y: 252 },
    ],
    fill: "#38283a",
    stroke: "#9d6f91",
  },
  {
    id: "kitchen",
    name: "Coffee Nook",
    type: "breaks",
    rect: { x: 62, y: 446, w: 265, h: 145 },
    anchor: { x: 194, y: 520 },
    spots: [
      { x: 126, y: 520 },
      { x: 205, y: 490 },
      { x: 264, y: 548 },
    ],
    fill: "#3a3024",
    stroke: "#ae8157",
  },
  {
    id: "desks",
    name: "Work Room",
    type: "production",
    rect: { x: 382, y: 442, w: 340, h: 182 },
    anchor: { x: 552, y: 535 },
    spots: [
      { x: 462, y: 530 },
      { x: 572, y: 530 },
      { x: 636, y: 580 },
    ],
    fill: "#22354a",
    stroke: "#638ab1",
  },
  {
    id: "meeting",
    name: "Meeting Room",
    type: "planning",
    rect: { x: 390, y: 172, w: 320, h: 218 },
    anchor: { x: 550, y: 282 },
    spots: [
      { x: 468, y: 246 },
      { x: 624, y: 246 },
      { x: 468, y: 340 },
      { x: 624, y: 340 },
      { x: 548, y: 382 },
    ],
    fill: "#28253a",
    stroke: "#a37a52",
  },
  {
    id: "whiteboard",
    name: "Planning Wall",
    type: "review",
    rect: { x: 742, y: 190, w: 235, h: 218 },
    anchor: { x: 858, y: 300 },
    spots: [
      { x: 792, y: 314 },
      { x: 862, y: 348 },
      { x: 930, y: 318 },
    ],
    fill: "#203734",
    stroke: "#7db09f",
  },
  {
    id: "manager",
    name: "Manager / HR",
    type: "schedules",
    rect: { x: 802, y: 74, w: 290, h: 96 },
    anchor: { x: 948, y: 126 },
    spots: [
      { x: 868, y: 128 },
      { x: 956, y: 118 },
      { x: 1040, y: 130 },
    ],
    fill: "#2f2a24",
    stroke: "#aa865d",
  },
  {
    id: "library",
    name: "Archive / Server",
    type: "memory",
    rect: { x: 790, y: 466, w: 300, h: 160 },
    anchor: { x: 940, y: 548 },
    spots: [
      { x: 842, y: 552 },
      { x: 940, y: 520 },
      { x: 1030, y: 586 },
    ],
    fill: "#25362d",
    stroke: "#7da275",
  },
  {
    id: "art",
    name: "Art Studio",
    type: "visuals",
    rect: { x: 64, y: 66, w: 265, h: 86 },
    anchor: { x: 198, y: 112 },
    spots: [
      { x: 134, y: 116 },
      { x: 212, y: 104 },
      { x: 280, y: 122 },
    ],
    fill: "#3d2d28",
    stroke: "#c67c5f",
  },
];

export const roomById = rooms.reduce(
  (acc, room) => {
    acc[room.id] = room;
    return acc;
  },
  {} as Record<RoomId, Room>,
);

export function getRoomSpot(roomId: RoomId, index = 0): Vector {
  const room = roomById[roomId] ?? rooms[0];
  return room.spots[index % room.spots.length] ?? room.anchor;
}

export function getRandomRoomSpot(roomId: RoomId): Vector {
  const room = roomById[roomId] ?? rooms[0];
  const spot = room.spots[Math.floor(Math.random() * room.spots.length)] ?? room.anchor;
  return {
    x: spot.x + Math.random() * 34 - 17,
    y: spot.y + Math.random() * 26 - 13,
  };
}
