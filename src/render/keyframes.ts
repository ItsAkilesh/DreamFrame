// keyframes.ts
// Purpose: Pure helpers for the Editor View's keyframe track — sampling a
//          character's pose between hand-placed keyframes, and the
//          add/move/delete edits the timeline performs on a spec. Kept free of
//          React and three so both the timeline UI and blocking.ts can use it,
//          and so the interpolation is unit-testable on its own.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import type { Keyframe, PrevisSpec } from "@/schema/previsSpec";

/** Playhead resolution, in seconds. Keyframe times snap to this grid. */
export const TIME_STEP = 0.05;

export interface Pose {
  position: [number, number, number];
  rotationY: number;
}

export const snapTime = (time: number): number =>
  Math.max(0, Math.round(time / TIME_STEP) * TIME_STEP);

/** Two keyframes closer than this are treated as the same instant. */
const SAME_INSTANT = TIME_STEP / 2;

/** A character's keyframes, ascending by time. */
export function keyframesFor(spec: PrevisSpec, characterId: string): Keyframe[] {
  return spec.keyframes
    .filter((k) => k.characterId === characterId)
    .sort((a, b) => a.time - b.time);
}

/** Shortest signed angular distance from `a` to `b`, so a turn past ±π
 *  interpolates the short way round instead of unwinding backwards. */
function angleDelta(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  return ((((b - a) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
}

/**
 * Pose at `time` for an ascending track. Holds the first keyframe before the
 * track starts and the last one after it ends (clamped, not extrapolated) and
 * lerps in between. Caller guarantees `track.length > 0`.
 */
export function sampleKeyframeTrack(track: Keyframe[], time: number): Pose {
  const first = track[0];
  if (time <= first.time) return { position: [...first.position], rotationY: first.rotationY };

  const last = track[track.length - 1];
  if (time >= last.time) return { position: [...last.position], rotationY: last.rotationY };

  let prev = first;
  let next = last;
  for (let i = 0; i < track.length - 1; i += 1) {
    if (time >= track[i].time && time <= track[i + 1].time) {
      prev = track[i];
      next = track[i + 1];
      break;
    }
  }

  const span = next.time - prev.time;
  const linearT = span <= 0 ? 0 : (time - prev.time) / span;
  // Ease into and out of marks so bodies do not start and stop with infinite
  // acceleration. Midpoint timing is preserved while quarter points become
  // a much more human 15.6% / 84.4% progression.
  const t = linearT * linearT * (3 - 2 * linearT);

  return {
    position: [
      prev.position[0] + (next.position[0] - prev.position[0]) * t,
      prev.position[1] + (next.position[1] - prev.position[1]) * t,
      prev.position[2] + (next.position[2] - prev.position[2]) * t,
    ],
    rotationY: prev.rotationY + angleDelta(prev.rotationY, next.rotationY) * t,
  };
}

let keyframeCounter = 0;
const nextKeyframeId = (): string => `kf_${Date.now().toString(36)}_${(keyframeCounter += 1)}`;

/**
 * Place a keyframe for `characterId` at `time`. A keyframe already sitting on
 * that instant is overwritten rather than stacked — a second diamond a
 * hundredth of a second away is invisible on the timeline and impossible to
 * grab.
 */
export function upsertKeyframe(spec: PrevisSpec, characterId: string, time: number, pose: Pose): PrevisSpec {
  const at = snapTime(time);
  const existing = spec.keyframes.find(
    (k) => k.characterId === characterId && Math.abs(k.time - at) < SAME_INSTANT
  );

  const keyframe: Keyframe = {
    id: existing?.id ?? nextKeyframeId(),
    characterId,
    time: at,
    position: [...pose.position],
    rotationY: pose.rotationY,
  };

  const keyframes = existing
    ? spec.keyframes.map((k) => (k.id === existing.id ? keyframe : k))
    : [...spec.keyframes, keyframe];

  return { ...spec, keyframes: keyframes.sort((a, b) => a.time - b.time) };
}

/** Drag a keyframe along its track. Landing on a sibling replaces it. */
export function moveKeyframe(spec: PrevisSpec, keyframeId: string, time: number): PrevisSpec {
  const target = spec.keyframes.find((k) => k.id === keyframeId);
  if (!target) return spec;

  const at = snapTime(time);
  const keyframes = spec.keyframes
    .filter(
      (k) =>
        k.id === keyframeId ||
        k.characterId !== target.characterId ||
        Math.abs(k.time - at) >= SAME_INSTANT
    )
    .map((k) => (k.id === keyframeId ? { ...k, time: at } : k))
    .sort((a, b) => a.time - b.time);

  return { ...spec, keyframes };
}

export function deleteKeyframe(spec: PrevisSpec, keyframeId: string): PrevisSpec {
  return { ...spec, keyframes: spec.keyframes.filter((k) => k.id !== keyframeId) };
}

/** `0:04.25` — the m:ss.cs readout Clipchamp-style editors use. */
export function formatTimecode(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.floor((clamped * 100) % 100);
  return `${minutes}:${secs.toString().padStart(2, "0")}.${centis.toString().padStart(2, "0")}`;
}
