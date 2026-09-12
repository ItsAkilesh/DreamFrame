// geom.ts
// Purpose: Shared pure-math helpers for the analyzer checks (plan.md §9.1).
//          No React. `three` is used here only for its Vector3/Box3/Ray math
//          (a throwaway PerspectiveCamera for projection) — never for
//          rendering, so this still behaves identically under vitest, inside
//          a route handler, and in the browser.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import * as THREE from "three";

import { resolvePose } from "@/render/blocking";
import { vFov, type Camera, type PrevisSpec } from "@/schema/previsSpec";

export type Vec3 = [number, number, number];

export const HEAD_Y = { standing: 1.68, seated: 1.22 } as const;

/** Signed side of the A->B axis that point P falls on, in the XZ plane. */
export function sideOfAxis(a: Vec3, b: Vec3, p: Vec3): number {
  const ax = b[0] - a[0];
  const az = b[2] - a[2];
  const px = p[0] - a[0];
  const pz = p[2] - a[2];
  return ax * pz - az * px;
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Facing unit vector from rotationY (0 = facing +Z). */
export function facing(rotationY: number): Vec3 {
  return [Math.sin(rotationY), 0, Math.cos(rotationY)];
}

/**
 * Head world position of a character during a given beat — resolved via the
 * same blocking driver the renderer uses (position settled at the end of
 * that beat), so a note always matches what's actually on screen.
 */
export function headPos(spec: PrevisSpec, characterId: string, beatId: string): Vec3 {
  const beat = spec.beats.find((b) => b.id === beatId);
  if (!beat) throw new Error(`headPos: no such beat "${beatId}"`);
  const character = spec.cast.find((c) => c.id === characterId);
  if (!character) throw new Error(`headPos: no such character "${characterId}"`);

  const settleTime = beat.startTime + beat.duration - 0.001;
  const pose = resolvePose(spec, characterId, settleTime);
  return [pose.position[0], HEAD_Y[character.posture], pose.position[2]];
}

/** Resolved facing (rotationY) of a character during a given beat. */
export function headingAt(spec: PrevisSpec, characterId: string, beatId: string): number {
  const beat = spec.beats.find((b) => b.id === beatId);
  if (!beat) throw new Error(`headingAt: no such beat "${beatId}"`);
  const settleTime = beat.startTime + beat.duration - 0.001;
  return resolvePose(spec, characterId, settleTime).rotationY;
}

/** Project a world point to normalized device coords for a given camera. Aspect fixed at 16:9. */
export function toNDC(cam: Camera, world: Vec3): { x: number; y: number; z: number } {
  const camera = new THREE.PerspectiveCamera(
    (vFov(cam.lens_mm) * 180) / Math.PI,
    16 / 9,
    0.1,
    1000
  );
  camera.position.set(...cam.position);
  camera.lookAt(...cam.lookAt);
  camera.updateMatrixWorld();

  const projected = new THREE.Vector3(...world).project(camera);
  return { x: projected.x, y: projected.y, z: projected.z };
}

export function nameOf(spec: PrevisSpec, characterId: string): string {
  return spec.cast.find((c) => c.id === characterId)?.name ?? characterId;
}

/** Reflect point P across the A->B axis, in the XZ plane (y unchanged). */
export function mirrorAcrossAxis(a: Vec3, b: Vec3, p: Vec3): Vec3 {
  const ax = b[0] - a[0];
  const az = b[2] - a[2];
  const lenSq = ax * ax + az * az;
  if (lenSq === 0) return p;

  const px = p[0] - a[0];
  const pz = p[2] - a[2];
  const t = (px * ax + pz * az) / lenSq;
  const projX = a[0] + t * ax;
  const projZ = a[2] + t * az;

  return [2 * projX - p[0], p[1], 2 * projZ - p[2]];
}

/**
 * The "other" character a shot is implicitly playing against: the beat's
 * line speaker if it's not the subject, otherwise the nearest other
 * character by position.
 */
export function otherCharacterFor(
  spec: PrevisSpec,
  beat: PrevisSpec["beats"][number],
  subjectId: string
): string | null {
  if (beat.line && beat.line.characterId !== subjectId) {
    return beat.line.characterId;
  }

  const subject = spec.cast.find((c) => c.id === subjectId);
  if (!subject) return null;

  let closest: string | null = null;
  let minDist = Infinity;
  for (const c of spec.cast) {
    if (c.id === subjectId) continue;
    const d = distance(c.position, subject.position);
    if (d < minDist) {
      minDist = d;
      closest = c.id;
    }
  }
  return closest;
}

export function sortedBeats(spec: PrevisSpec) {
  return [...spec.beats].sort((a, b) => a.startTime - b.startTime);
}
