import { useEffect, useMemo, useRef, useState } from "react";
import { Character, SpeechBubble, Station } from "../types";
import { campusDecorations, campusPaths, roomById, rooms, WORLD_HEIGHT, WORLD_WIDTH } from "../data/rooms";
import { stationById, stations } from "../data/stations";

interface OfficeCanvasProps {
  characters: Character[];
  bubbles: SpeechBubble[];
  currentSpeakerId?: string;
  activeCharacterId?: string;
  selectedCharacterIds?: string[];
  meetingActive?: boolean;
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

interface DrawContext {
  time: number;
  selectedIds: Set<string>;
  currentSpeakerId?: string;
  activeCharacterId?: string;
  meetingActive: boolean;
}

const stateLabel: Record<string, string> = {
  idle: "idle",
  working: "working",
  walking: "walking",
  gathering: "meeting",
  waiting: "waiting",
  thinking: "thinking",
  speaking: "speaking",
  returning: "returning",
  error: "error",
  disabled: "off",
};

const stationIcon: Record<string, string> = {
  computer: "PC",
  workbench: "WRK",
  whiteboard: "BRD",
  coffee: "CAF",
  lounge: "RST",
  archive: "ARC",
  art: "ART",
  meeting: "MTG",
  manager: "MGR",
  social: "SOC",
};

const roomTexture: Record<string, { stripe: string; light: string }> = {
  meeting: { stripe: "rgba(218, 168, 97, 0.08)", light: "rgba(230, 171, 97, 0.12)" },
  whiteboard: { stripe: "rgba(119, 193, 178, 0.08)", light: "rgba(118, 191, 173, 0.1)" },
  desks: { stripe: "rgba(105, 154, 199, 0.08)", light: "rgba(100, 145, 201, 0.12)" },
  kitchen: { stripe: "rgba(196, 143, 86, 0.08)", light: "rgba(230, 178, 105, 0.11)" },
  lounge: { stripe: "rgba(204, 126, 168, 0.08)", light: "rgba(207, 132, 173, 0.1)" },
  library: { stripe: "rgba(132, 184, 111, 0.08)", light: "rgba(127, 184, 114, 0.11)" },
  art: { stripe: "rgba(210, 118, 87, 0.08)", light: "rgba(221, 136, 97, 0.11)" },
  manager: { stripe: "rgba(218, 165, 103, 0.08)", light: "rgba(224, 169, 102, 0.1)" },
};

function getCharacterStationId(character: Character): string | undefined {
  return character.currentStationId ?? character.stationId;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shadeColor(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const num = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawSoftLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 1,
): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.55, color.replace(/[\d.]+\)$/u, `${0.16 * alpha})`));
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

function drawFloor(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#172213";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const background = ctx.createLinearGradient(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  background.addColorStop(0, "#2f421d");
  background.addColorStop(0.44, "#26391e");
  background.addColorStop(1, "#1c2d1b");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.strokeStyle = "rgba(237, 220, 168, 0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < WORLD_WIDTH; x += 36) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 18, WORLD_HEIGHT);
    ctx.stroke();
  }

  for (const path of campusPaths) {
    const isStone = path.kind === "stone" || path.kind === "hall";
    ctx.fillStyle = isStone ? "#777465" : "#755c3f";
    roundRect(ctx, path.rect.x, path.rect.y, path.rect.w, path.rect.h, path.kind === "hall" ? 4 : 9);
    ctx.fill();
    ctx.strokeStyle = isStone ? "rgba(230, 222, 190, 0.22)" : "rgba(236, 200, 144, 0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.strokeStyle = isStone ? "rgba(40, 38, 34, 0.16)" : "rgba(52, 36, 22, 0.18)";
    ctx.lineWidth = 1;
    for (let offset = path.rect.x + 14; offset < path.rect.x + path.rect.w; offset += 36) {
      ctx.beginPath();
      ctx.moveTo(offset, path.rect.y + 4);
      ctx.lineTo(offset - 8, path.rect.y + path.rect.h - 4);
      ctx.stroke();
    }
  }

  for (const decor of campusDecorations) {
    const size = decor.size ?? 16;
    if (decor.kind === "tree") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.beginPath();
      ctx.ellipse(decor.position.x, decor.position.y + size * 0.45, size * 0.7, size * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#5a3b22";
      roundRect(ctx, decor.position.x - size * 0.12, decor.position.y, size * 0.24, size * 0.7, 4);
      ctx.fill();
      ctx.fillStyle = "#315f2b";
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath();
        ctx.arc(decor.position.x + Math.cos(i) * size * 0.28, decor.position.y - size * 0.05 + Math.sin(i) * size * 0.2, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (decor.kind === "water") {
      ctx.fillStyle = "#2f6674";
      ctx.beginPath();
      ctx.ellipse(decor.position.x, decor.position.y, size, size * 0.58, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(170, 224, 220, 0.28)";
      ctx.stroke();
    } else if (decor.kind === "flowers") {
      for (let i = 0; i < 7; i += 1) {
        ctx.fillStyle = i % 2 ? "#b96aa0" : "#d5b05f";
        ctx.beginPath();
        ctx.arc(decor.position.x + i * size * 0.7, decor.position.y + Math.sin(i) * 4, size * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (decor.kind === "lamp") {
      ctx.fillStyle = "#161616";
      ctx.fillRect(decor.position.x - 2, decor.position.y - size, 4, size * 2);
      drawSoftLight(ctx, decor.position.x, decor.position.y - size, size * 4, "rgba(240, 196, 119, 0.15)");
      ctx.fillStyle = "#f0c477";
      ctx.beginPath();
      ctx.arc(decor.position.x, decor.position.y - size, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "#47763b";
      ctx.beginPath();
      ctx.arc(decor.position.x, decor.position.y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawRoom(ctx: CanvasRenderingContext2D, roomId: string, meetingActive: boolean): void {
  const room = roomById[roomId as keyof typeof roomById];
  if (!room) return;

  const texture = roomTexture[room.id] ?? roomTexture.meeting;
  const isFocusRoom = meetingActive && (room.id === "meeting" || room.id === "whiteboard");

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = isFocusRoom ? 20 : 12;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = "#17120e";
  roundRect(ctx, room.rect.x - 10, room.rect.y - 10, room.rect.w + 20, room.rect.h + 20, 7);
  ctx.fill();
  ctx.fillStyle = room.fill;
  ctx.strokeStyle = isFocusRoom ? "#f0c477" : room.stroke;
  ctx.lineWidth = isFocusRoom ? 3 : 2;
  roundRect(ctx, room.rect.x, room.rect.y, room.rect.w, room.rect.h, 5);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.stroke();

  ctx.clip();
  ctx.fillStyle = texture.stripe;
  for (let x = room.rect.x - room.rect.h; x < room.rect.x + room.rect.w + room.rect.h; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, room.rect.y);
    ctx.lineTo(x + room.rect.h, room.rect.y + room.rect.h);
    ctx.lineTo(x + room.rect.h - 10, room.rect.y + room.rect.h);
    ctx.lineTo(x - 10, room.rect.y);
    ctx.closePath();
    ctx.fill();
  }

  const lamp = ctx.createRadialGradient(room.anchor.x, room.anchor.y, 10, room.anchor.x, room.anchor.y, 210);
  lamp.addColorStop(0, texture.light);
  lamp.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = lamp;
  ctx.fillRect(room.rect.x, room.rect.y, room.rect.w, room.rect.h);

  ctx.restore();

  ctx.fillStyle = "rgba(255, 242, 217, 0.86)";
  ctx.font = "700 18px Inter, system-ui, sans-serif";
  ctx.fillText(room.name, room.rect.x + 18, room.rect.y + 30);
  ctx.fillStyle = "rgba(234, 221, 199, 0.46)";
  ctx.font = "12px Inter, system-ui, sans-serif";
  ctx.fillText(room.type, room.rect.x + 18, room.rect.y + 51);

  ctx.fillStyle = "rgba(111, 171, 120, 0.9)";
  roundRect(ctx, room.anchor.x - 18, room.rect.y + room.rect.h - 6, 36, 12, 2);
  ctx.fill();
}

function drawDesk(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glow: string): void {
  ctx.fillStyle = "#2b221c";
  ctx.strokeStyle = "#8f6a49";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 9);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#0d141c";
  ctx.strokeStyle = "#78a2ce";
  roundRect(ctx, x + 20, y + 10, 72, 28, 5);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = glow;
  roundRect(ctx, x + 27, y + 15, 58, 15, 4);
  ctx.fill();

  ctx.fillStyle = "#161a1e";
  roundRect(ctx, x + w - 66, y + 15, 45, 13, 4);
  ctx.fill();
}

function drawStationObject(ctx: CanvasRenderingContext2D, station: Station, time: number, meetingActive: boolean): void {
  const x = station.position.x - station.size.x / 2;
  const y = station.position.y - station.size.y / 2;

  ctx.save();
  ctx.lineWidth = 2;

  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.beginPath();
  ctx.ellipse(station.position.x, station.position.y + station.size.y * 0.45, station.size.x * 0.46, station.size.y * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  if (station.kind === "meeting") {
    ctx.fillStyle = "#78543a";
    ctx.strokeStyle = meetingActive ? "#f4c77d" : "#c49463";
    ctx.beginPath();
    ctx.ellipse(station.position.x, station.position.y, station.size.x / 2, station.size.y / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (const spot of station.interactionSpots.slice(0, 4)) {
      ctx.fillStyle = "#3b2a25";
      roundRect(ctx, spot.x - 16, spot.y - 12, 32, 20, 6);
      ctx.fill();
    }
  } else if (station.kind === "computer" || station.kind === "workbench" || station.kind === "manager") {
    ctx.fillStyle = station.kind === "manager" ? "#5a3c29" : "#2b221c";
    ctx.strokeStyle = "#8f6a49";
    roundRect(ctx, x, y, station.size.x, station.size.y, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#0d141c";
    ctx.strokeStyle = "#78a2ce";
    roundRect(ctx, x + 16, y + 9, Math.min(66, station.size.x - 38), 25, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = station.kind === "manager" ? "rgba(240, 196, 119, 0.32)" : "rgba(99, 170, 220, 0.42)";
    roundRect(ctx, x + 23, y + 14, Math.min(50, station.size.x - 52), 13, 3);
    ctx.fill();
    ctx.fillStyle = "#17120f";
    roundRect(ctx, x + station.size.x - 43, y + 14, 28, 18, 5);
    ctx.fill();
  } else if (station.kind === "whiteboard") {
    ctx.fillStyle = "#e3ece9";
    ctx.strokeStyle = "#82b5aa";
    roundRect(ctx, x, y, station.size.x, station.size.y, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#42645f";
    ctx.fillRect(x + 20, y + 17, 86, 3);
    ctx.fillRect(x + 20, y + 25, 130, 3);
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i % 2 ? "#d27a61" : "#d6a85a";
      roundRect(ctx, x + 12 + i * 33, y + station.size.y + 14 + (i % 2) * 18, 24, 17, 4);
      ctx.fill();
    }
  } else if (station.kind === "coffee" || station.kind === "social") {
    ctx.fillStyle = station.kind === "coffee" ? "#563c2a" : "#6b5134";
    ctx.strokeStyle = "#bb8a61";
    roundRect(ctx, x, y, station.size.x, station.size.y, 8);
    ctx.fill();
    ctx.stroke();
    for (let i = 0; i < 3; i += 1) {
      ctx.fillStyle = i === 2 ? "#241915" : "#cf9461";
      roundRect(ctx, x + 22 + i * 34, y + 13, 20, 12, 3);
      ctx.fill();
    }
    ctx.strokeStyle = "#f2c37f";
    ctx.beginPath();
    ctx.arc(x + station.size.x - 38 + Math.sin(time / 620) * 2, y - 8, 8, Math.PI, Math.PI * 2);
    ctx.stroke();
  } else if (station.kind === "lounge") {
    ctx.fillStyle = "#603b55";
    ctx.strokeStyle = "#cf83ad";
    roundRect(ctx, x, y, station.size.x, station.size.y, 16);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 219, 182, 0.12)";
    roundRect(ctx, x + 14, y + 10, station.size.x - 28, 16, 8);
    ctx.fill();
  } else if (station.kind === "archive") {
    ctx.fillStyle = "#142019";
    ctx.strokeStyle = "#82a873";
    for (let i = 0; i < Math.max(2, Math.floor(station.size.x / 44)); i += 1) {
      roundRect(ctx, x + i * 44, y, 33, station.size.y, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = i % 2 ? "#8fbf79" : "#6fa7a1";
      ctx.fillRect(x + 8 + i * 44, y + 16, 16, 3);
      ctx.fillRect(x + 8 + i * 44, y + 32, 12, 3);
      ctx.fillStyle = "#142019";
    }
  } else if (station.kind === "art") {
    ctx.fillStyle = "#50342a";
    ctx.strokeStyle = "#c98064";
    roundRect(ctx, x, y, station.size.x, station.size.y, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f2d59f";
    ctx.fillRect(x + 18, y + 14, 52, 5);
    ctx.fillRect(x + 18, y + 26, 86, 5);
    ctx.fillStyle = "#d59a6e";
    ctx.beginPath();
    ctx.arc(x + station.size.x - 38, y + station.size.y / 2, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawFurniture(ctx: CanvasRenderingContext2D, time: number, meetingActive: boolean): void {
  for (const station of stations) {
    drawStationObject(ctx, station, time, meetingActive);
  }
}

function drawStations(ctx: CanvasRenderingContext2D, characters: Character[], time: number): void {
  const occupantsByStation = characters.reduce(
    (acc, character) => {
      const stationId = getCharacterStationId(character);
      if (stationId && character.enabled && character.state === "working") {
        acc[stationId] = (acc[stationId] ?? 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  ctx.save();
  ctx.textAlign = "left";

  for (const station of stations) {
    const occupied = Boolean(occupantsByStation[station.id]);
    const x = station.position.x - station.size.x / 2;
    const y = station.position.y - station.size.y / 2;
    const pulse = 0.5 + Math.sin(time / 260 + station.id.length) * 0.5;

    ctx.globalAlpha = occupied ? 1 : 0.72;
    ctx.strokeStyle = occupied ? "rgba(240, 196, 119, 0.85)" : "rgba(248, 230, 201, 0.18)";
    ctx.lineWidth = occupied ? 2.5 : 1.5;
    ctx.setLineDash(occupied ? [] : [5, 6]);
    roundRect(ctx, x - 5, y - 5, station.size.x + 10, station.size.y + 10, 9);
    ctx.stroke();
    ctx.setLineDash([]);

    if (occupied) {
      drawSoftLight(
        ctx,
        station.interactionSpot.x,
        station.interactionSpot.y,
        58,
        `rgba(240, 196, 119, ${0.12 + pulse * 0.08})`,
      );
      ctx.fillStyle = "rgba(240, 196, 119, 0.56)";
      ctx.beginPath();
      ctx.arc(station.interactionSpot.x, station.interactionSpot.y + 14, 4 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = "rgba(248, 230, 201, 0.24)";
      ctx.beginPath();
      ctx.arc(station.interactionSpot.x, station.interactionSpot.y + 14, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    const labelWidth = Math.max(74, Math.min(132, station.name.length * 7 + 38));
    const labelX = x + 5;
    const labelY = y + station.size.y + 9;
    ctx.fillStyle = occupied ? "rgba(16, 15, 14, 0.92)" : "rgba(8, 10, 13, 0.7)";
    roundRect(ctx, labelX, labelY, labelWidth, 22, 7);
    ctx.fill();
    ctx.strokeStyle = occupied ? "rgba(240, 196, 119, 0.42)" : "rgba(248, 230, 201, 0.1)";
    ctx.stroke();

    ctx.fillStyle = occupied ? "#f0c477" : "#aeb8ad";
    ctx.font = "800 8px Inter, system-ui, sans-serif";
    ctx.fillText(stationIcon[station.kind], labelX + 8, labelY + 14);
    ctx.fillStyle = "#f8edda";
    ctx.font = "700 10px Inter, system-ui, sans-serif";
    ctx.fillText(station.name, labelX + 32, labelY + 14);
  }

  ctx.restore();
}

function getRoleBadge(role: string): string {
  const clean = role.toLowerCase();
  if (clean.includes("project")) return "PM";
  if (clean.includes("program")) return "</>";
  if (clean.includes("critic") || clean.includes("qa")) return "QA";
  if (clean.includes("artist") || clean.includes("ux") || clean.includes("designer")) return "UX";
  if (clean.includes("memory")) return "M";
  if (clean.includes("sysadmin")) return "OPS";
  if (clean.includes("research")) return "?";
  return "AI";
}

function getActivityIcon(character: Character): string {
  const stationId = getCharacterStationId(character);
  const station = stationId ? stationById[stationId] : undefined;
  if (!station) return "JOB";
  return stationIcon[station.kind] ?? "JOB";
}

function drawTinyAgent(ctx: CanvasRenderingContext2D, character: Character, draw: DrawContext): void {
  const disabled = !character.enabled;
  const selected = draw.selectedIds.has(character.id);
  const isSpeaker = draw.currentSpeakerId === character.id;
  const isActive = draw.activeCharacterId === character.id;
  const { x, y } = character.position;
  const walking = character.state === "walking" || character.state === "gathering" || character.state === "returning";
  const phase = draw.time / 280 + character.id.length;
  const bounce = disabled ? 0 : walking ? Math.sin(phase) * 4 : Math.sin(draw.time / 900 + character.name.length) * 1.3;
  const bobY = y + bounce;
  const pulse = isSpeaker ? 1 + Math.sin(draw.time / 170) * 0.08 : 1;
  const targetDx = character.targetPosition.x - x;
  const targetDy = character.targetPosition.y - y;
  const facingX = Math.abs(targetDx) > 4 ? Math.sign(targetDx) : isSpeaker || isActive ? -0.35 : 0;
  const facingY = Math.abs(targetDy) > 4 ? Math.sign(targetDy) * 0.6 : 0;

  ctx.save();
  ctx.globalAlpha = disabled ? 0.45 : draw.meetingActive && !selected ? 0.48 : 1;

  ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
  ctx.beginPath();
  ctx.ellipse(x, y + 23, walking ? 25 : 21, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  if (selected || isSpeaker || isActive) {
    const halo = isSpeaker ? "rgba(255, 210, 124, 0.48)" : isActive ? "rgba(154, 216, 195, 0.36)" : "rgba(240, 196, 119, 0.18)";
    ctx.strokeStyle = halo;
    ctx.lineWidth = isSpeaker ? 5 : 3;
    ctx.beginPath();
    ctx.arc(x, bobY + 2, isSpeaker ? 35 * pulse : 29, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (character.state === "error") {
    ctx.strokeStyle = "rgba(255, 112, 93, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, bobY + 2, 30, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = shadeColor(character.avatarColor, -34);
  roundRect(ctx, x - 16, bobY + 9, 32, 25, 10);
  ctx.fill();

  ctx.strokeStyle = shadeColor(character.avatarColor, -62);
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  const footSwing = walking ? Math.sin(phase) * 4 : 0;
  ctx.moveTo(x - 7, bobY + 29);
  ctx.lineTo(x - 10 - footSwing, bobY + 39);
  ctx.moveTo(x + 7, bobY + 29);
  ctx.lineTo(x + 10 + footSwing, bobY + 39);
  ctx.stroke();

  ctx.fillStyle = character.avatarColor;
  ctx.strokeStyle = "rgba(255, 242, 222, 0.62)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, bobY - 3, 19, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const hair = shadeColor(character.avatarColor, -58);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(x, bobY - 15, 15, 8, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(13, 14, 16, 0.82)";
  ctx.beginPath();
  ctx.arc(x - 7 + facingX * 2.3, bobY - 4 + facingY, 2.7, 0, Math.PI * 2);
  ctx.arc(x + 7 + facingX * 2.3, bobY - 4 + facingY, 2.7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(13, 14, 16, 0.74)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (isSpeaker) {
    ctx.arc(x, bobY + 4, 5, 0.12, Math.PI - 0.12);
  } else {
    ctx.moveTo(x - 5, bobY + 6);
    ctx.lineTo(x + 5, bobY + 6);
  }
  ctx.stroke();

  ctx.fillStyle = "rgba(12, 15, 19, 0.9)";
  roundRect(ctx, x + 10, bobY - 23, getRoleBadge(character.role).length > 2 ? 28 : 24, 17, 7);
  ctx.fill();
  ctx.fillStyle = "#f8e8cf";
  ctx.font = "700 9px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(getRoleBadge(character.role), x + (getRoleBadge(character.role).length > 2 ? 24 : 22), bobY - 11);

  if (character.state === "thinking") {
    ctx.fillStyle = "#f3d78e";
    for (let i = 0; i < 3; i += 1) {
      const dotY = bobY - 39 + Math.sin(draw.time / 180 + i) * 2;
      ctx.beginPath();
      ctx.arc(x - 11 + i * 11, dotY, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (character.state === "working") {
    ctx.fillStyle = "rgba(11, 13, 16, 0.9)";
    roundRect(ctx, x - 20, bobY - 50, 40, 19, 7);
    ctx.fill();
    ctx.strokeStyle = "rgba(240, 196, 119, 0.35)";
    ctx.stroke();
    ctx.fillStyle = "#f0c477";
    ctx.font = "800 9px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(getActivityIcon(character), x, bobY - 37);
  }

  ctx.fillStyle = "rgba(8, 10, 13, 0.88)";
  roundRect(ctx, x - 47, y + 33, 94, 37, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.stroke();
  ctx.fillStyle = "#fff0dc";
  ctx.font = "700 12px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(character.name, x, y + 48);
  ctx.fillStyle = character.state === "error" ? "#ff9a8b" : selected ? "#f0c477" : "#aeb8ad";
  ctx.font = "10px Inter, system-ui, sans-serif";
  const stateText = character.state === "working" && character.activity ? character.activity : stateLabel[character.state];
  ctx.fillText(disabled ? "disabled" : stateText.slice(0, 14), x, y + 61);
  ctx.restore();
}

function drawMovementCues(ctx: CanvasRenderingContext2D, characters: Character[], draw: DrawContext): void {
  ctx.save();
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 9]);
  ctx.lineDashOffset = -draw.time / 80;

  for (const character of characters) {
    const selected = draw.selectedIds.has(character.id);
    const movingToMeeting = selected && (character.state === "gathering" || character.state === "walking");
    if (!movingToMeeting || !character.enabled) continue;

    const dist = Math.hypot(character.targetPosition.x - character.position.x, character.targetPosition.y - character.position.y);
    if (dist < 36) continue;

    ctx.strokeStyle = "rgba(244, 198, 119, 0.26)";
    ctx.beginPath();
    ctx.moveTo(character.position.x, character.position.y + 24);
    ctx.lineTo(character.targetPosition.x, character.targetPosition.y + 18);
    ctx.stroke();

    ctx.fillStyle = "rgba(244, 198, 119, 0.45)";
    ctx.beginPath();
    ctx.arc(character.targetPosition.x, character.targetPosition.y + 18, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawFocusSpotlight(ctx: CanvasRenderingContext2D, characters: Character[], draw: DrawContext): void {
  const focusId = draw.currentSpeakerId ?? draw.activeCharacterId;
  if (!focusId) return;

  const character = characters.find((agent) => agent.id === focusId);
  if (!character) return;

  ctx.save();
  drawSoftLight(ctx, character.position.x, character.position.y + 2, 115, "rgba(255, 211, 128, 0.24)");
  ctx.strokeStyle = draw.currentSpeakerId ? "rgba(255, 215, 142, 0.34)" : "rgba(141, 217, 196, 0.28)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(character.position.x, character.position.y + 2, 46 + Math.sin(draw.time / 200) * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawMeetingOverlay(ctx: CanvasRenderingContext2D, draw: DrawContext): void {
  if (!draw.meetingActive) return;

  ctx.save();
  ctx.fillStyle = "rgba(5, 7, 10, 0.18)";
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  const meeting = roomById.meeting;
  const board = roomById.whiteboard;
  ctx.strokeStyle = "rgba(239, 196, 119, 0.38)";
  ctx.lineWidth = 3;
  for (const room of [meeting, board]) {
    roundRect(ctx, room.rect.x - 5, room.rect.y - 5, room.rect.w + 10, room.rect.h + 10, 20);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWorld(ctx: CanvasRenderingContext2D, characters: Character[], draw: DrawContext): void {
  ctx.clearRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  drawFloor(ctx);

  for (const room of rooms) {
    drawRoom(ctx, room.id, draw.meetingActive);
  }

  drawFurniture(ctx, draw.time, draw.meetingActive);
  drawStations(ctx, characters, draw.time);
  drawMeetingOverlay(ctx, draw);
  drawMovementCues(ctx, characters, draw);
  drawFocusSpotlight(ctx, characters, draw);

  const sortedCharacters = [...characters].sort((a, b) => a.position.y - b.position.y);
  for (const character of sortedCharacters) {
    drawTinyAgent(ctx, character, draw);
  }
}

export default function OfficeCanvas({
  characters,
  bubbles,
  currentSpeakerId,
  activeCharacterId,
  selectedCharacterIds = [],
  meetingActive = false,
}: OfficeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0, width: 1, height: 1 });
  const drawStateRef = useRef({ characters, currentSpeakerId, activeCharacterId, selectedCharacterIds, meetingActive });
  const [transform, setTransform] = useState<ViewTransform>(frameRef.current);

  useEffect(() => {
    drawStateRef.current = { characters, currentSpeakerId, activeCharacterId, selectedCharacterIds, meetingActive };
  }, [characters, currentSpeakerId, activeCharacterId, selectedCharacterIds, meetingActive]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      const scale = Math.min(rect.width / WORLD_WIDTH, rect.height / WORLD_HEIGHT);
      const offsetX = (rect.width - WORLD_WIDTH * scale) / 2;
      const offsetY = (rect.height - WORLD_HEIGHT * scale) / 2;
      frameRef.current = { scale, offsetX, offsetY, width: rect.width, height: rect.height };
      setTransform(frameRef.current);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    const render = (time: number) => {
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.save();
      ctx.translate(frameRef.current.offsetX, frameRef.current.offsetY);
      ctx.scale(frameRef.current.scale, frameRef.current.scale);
      const latest = drawStateRef.current;
      drawWorld(ctx, latest.characters, {
        time,
        selectedIds: new Set(latest.selectedCharacterIds),
        currentSpeakerId: latest.currentSpeakerId,
        activeCharacterId: latest.activeCharacterId,
        meetingActive: latest.meetingActive,
      });
      ctx.restore();
      frame = window.requestAnimationFrame(render);
    };

    frame = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const charactersById = useMemo(() => {
    return characters.reduce(
      (acc, character) => {
        acc[character.id] = character;
        return acc;
      },
      {} as Record<string, Character>,
    );
  }, [characters]);

  const clampBubbleX = (x: number, lane: number): number => {
    const laneOffset = ((lane % 3) - 1) * 42;
    const padded = x + laneOffset;
    return Math.min(Math.max(padded, 132), Math.max(132, transform.width - 132));
  };

  return (
    <div className="office-stage" aria-label="2D office simulation">
      <canvas ref={canvasRef} className="office-canvas" />
      <div className="bubble-layer" aria-live="polite">
        {bubbles.map((bubble, index) => {
          const character = charactersById[bubble.characterId];
          if (!character) return null;
          const x = transform.offsetX + character.position.x * transform.scale;
          const y = transform.offsetY + character.position.y * transform.scale;
          const laneTopOffset = (index % 2) * 18;
          return (
            <div
              key={bubble.id}
              className={`speech-bubble speech-bubble--${bubble.kind}`}
              style={{
                left: `${clampBubbleX(x, index)}px`,
                top: `${Math.max(28, y - 96 - laneTopOffset)}px`,
                borderColor: bubble.kind === "speech" ? character.avatarColor : undefined,
                ["--bubble-accent" as string]: character.avatarColor,
              }}
            >
              <span className="speech-bubble__speaker">{character.name}</span>
              {bubble.text}
            </div>
          );
        })}
      </div>
    </div>
  );
}
