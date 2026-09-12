// roomFit.ts
// Purpose: Shared sizing helpers so cast placement reacts to a scene's ACTUAL
//          measured environment model instead of a size assumed independently
//          of it. Used by both Stage.tsx (previs Editor View / "Show Scene")
//          and simulation-stage.tsx (live/saved simulation playback).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

export interface RoomFootprint {
  width: number; // X extent, metres
  depth: number; // Z extent, metres
}

// Used until the real room is measured (or when there's no scene model at
// all, just a placeholder ground/room primitive).
export const DEFAULT_FOOTPRINT: RoomFootprint = { width: 3.6, depth: 3.6 };

// Fraction of the room's own half-extent the cast stands at — comfortably
// inside the walls without needing to know where the furniture actually is
// (real collision/furniture-aware placement is a later pass).
const RADIUS_FRACTION = 0.7;
const MIN_RADIUS = 1.0;
const MAX_RADIUS = 3.5;

export function circleRadiusFor(footprint: RoomFootprint): number {
  const halfExtent = Math.min(footprint.width, footprint.depth) / 2;
  return Math.min(MAX_RADIUS, Math.max(MIN_RADIUS, halfExtent * RADIUS_FRACTION));
}
