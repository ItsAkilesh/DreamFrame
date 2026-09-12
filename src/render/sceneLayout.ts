// sceneLayout.ts
// Purpose: Scene-space calibration and movement constraints. Library rooms
//          may use arbitrary units, but a known production set can provide a
//          small, explicit walkable layout so actors stay on its floor and do
//          not walk through its fixed furniture.

import type { RoomFootprint } from "@/render/roomFit";

export interface StageBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface StageObstacle extends StageBounds {
  id: string;
}

export interface SceneLayout {
  footprint: RoomFootprint;
  bounds: StageBounds;
  obstacles: StageObstacle[];
  spawnPoints?: [number, number][];
}

export interface SceneCalibration {
  rawScale: number;
  rawFloorY: number;
  layout: SceneLayout;
}

export const ACTOR_CLEARANCE = 0.32;

const PRODUCTION_CAFE_FILE = "1789216497646-bc86c427.glb";
const PRODUCTION_BILLIARDS_FILE = "1789230326715-15ac820d.glb";

// This set is authored in metres. The rectangles deliberately include a
// little breathing room around the counter and the three table/chair islands.
// They are blocking volumes, not a physics mesh, which keeps authoring fast
// and deterministic while matching this set closely.
const PRODUCTION_CAFE: SceneCalibration = {
  rawScale: 1,
  rawFloorY: 0,
  layout: {
    footprint: { width: 8.3, depth: 6.5 },
    bounds: { minX: -3.72, maxX: 3.72, minZ: -2.62, maxZ: 2.62 },
    obstacles: [
      { id: "counter", minX: -1.92, maxX: 3.32, minZ: -1.98, maxZ: -0.48 },
      { id: "left-table", minX: -3.3, maxX: -1.42, minZ: 0.12, maxZ: 2.62 },
      { id: "centre-table", minX: -0.82, maxX: 1.02, minZ: 0.14, maxZ: 2.62 },
      { id: "right-table", minX: 1.72, maxX: 3.42, minZ: 0.02, maxZ: 2.62 },
    ],
  },
};

// The Sketchfab billiards export is roughly 22.46 × 28.36 source units and
// has no semantic mesh names. These values are measured from the actual GLB:
// preserve the existing 8 m normalization, ground its real floor, reserve the
// pool table footprint, and use six marks around (never on) the table.
const PRODUCTION_BILLIARDS: SceneCalibration = {
  rawScale: 8 / 28.362785339355472,
  rawFloorY: 0.3580493927001916,
  layout: {
    footprint: { width: 6.336, depth: 8 },
    bounds: { minX: -2.78, maxX: 2.78, minZ: -3.48, maxZ: 3.48 },
    obstacles: [
      { id: "pool-table", minX: -1.72, maxX: 1.72, minZ: -2.0, maxZ: 1.62 },
    ],
    spawnPoints: [
      [-2.22, -2.62],
      [2.22, -2.62],
      [-2.3, 2.08],
      [2.3, 2.08],
      [0, 2.82],
      [0, -2.76],
    ],
  },
};

export function sceneCalibrationFor(url: string): SceneCalibration | null {
  const fileName = decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
  if (fileName === PRODUCTION_CAFE_FILE) return PRODUCTION_CAFE;
  if (fileName === PRODUCTION_BILLIARDS_FILE) return PRODUCTION_BILLIARDS;
  return null;
}

function inside(value: number, min: number, max: number): boolean {
  return value > min && value < max;
}

/** Keep an actor's circular footprint inside the room and outside furniture. */
export function constrainToLayout(
  layout: SceneLayout,
  x: number,
  z: number,
  clearance = ACTOR_CLEARANCE
): [number, number] {
  const roomMinX = layout.bounds.minX + clearance;
  const roomMaxX = layout.bounds.maxX - clearance;
  const roomMinZ = layout.bounds.minZ + clearance;
  const roomMaxZ = layout.bounds.maxZ - clearance;
  let nextX = Math.min(roomMaxX, Math.max(roomMinX, x));
  let nextZ = Math.min(roomMaxZ, Math.max(roomMinZ, z));

  // Re-check after every projection because leaving one furniture rectangle
  // can enter its neighbour. The small fixed cap guarantees termination.
  for (let pass = 0; pass <= layout.obstacles.length; pass += 1) {
    let moved = false;
    for (const obstacle of layout.obstacles) {
      const minX = obstacle.minX - clearance;
      const maxX = obstacle.maxX + clearance;
      const minZ = obstacle.minZ - clearance;
      const maxZ = obstacle.maxZ + clearance;
      if (!inside(nextX, minX, maxX) || !inside(nextZ, minZ, maxZ)) continue;

      // Do not choose an exit hidden beyond a wall (several furniture zones
      // intentionally meet the wall). Prefer the nearest reachable side.
      const exits = [
        { axis: "x" as const, value: minX, distance: Math.abs(nextX - minX), valid: minX >= roomMinX },
        { axis: "x" as const, value: maxX, distance: Math.abs(maxX - nextX), valid: maxX <= roomMaxX },
        { axis: "z" as const, value: minZ, distance: Math.abs(nextZ - minZ), valid: minZ >= roomMinZ },
        { axis: "z" as const, value: maxZ, distance: Math.abs(maxZ - nextZ), valid: maxZ <= roomMaxZ },
      ].filter((exit) => exit.valid).sort((a, b) => a.distance - b.distance);
      const nearest = exits[0];
      if (!nearest) continue;
      if (nearest.axis === "x") nextX = nearest.value;
      else nextZ = nearest.value;
      moved = true;
      break;
    }
    if (!moved) break;
  }

  return [nextX, nextZ];
}

export function rectangularLayout(footprint: RoomFootprint): SceneLayout {
  const wallInset = 0.2;
  return {
    footprint,
    bounds: {
      minX: -footprint.width / 2 + wallInset,
      maxX: footprint.width / 2 - wallInset,
      minZ: -footprint.depth / 2 + wallInset,
      maxZ: footprint.depth / 2 - wallInset,
    },
    obstacles: [],
  };
}
