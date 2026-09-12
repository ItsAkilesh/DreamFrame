// blocking.ts
// Purpose: Resolve a character's position/rotation at an arbitrary playhead
//          time by walking the beats in order and applying "walk"/"turn"
//          blocking cues as linear interpolations. This is a minimal
//          placeholder driver for the Editor View's Timeline — full
//          crossfaded-clip playback (M1) is a separate, later milestone.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import type { PrevisSpec } from "@/schema/previsSpec";

export interface ResolvedPose {
  position: [number, number, number];
  rotationY: number;
}

export function resolvePose(spec: PrevisSpec, characterId: string, time: number): ResolvedPose {
  const cast = spec.cast.find((c) => c.id === characterId);
  if (!cast) {
    throw new Error(`resolvePose: no such character "${characterId}"`);
  }

  let position: [number, number, number] = [...cast.position];
  let rotationY = cast.rotationY;

  const beats = [...spec.beats].sort((a, b) => a.startTime - b.startTime);

  for (const beat of beats) {
    if (beat.startTime > time) break;
    const cue = beat.blocking.find((b) => b.characterId === characterId);
    if (!cue) continue;

    const beatEnd = beat.startTime + beat.duration;
    const t = Math.min(1, Math.max(0, (time - beat.startTime) / beat.duration));

    if (cue.action === "walk" && cue.to) {
      const to = cue.to;
      position =
        time >= beatEnd
          ? to
          : [
              position[0] + (to[0] - position[0]) * t,
              position[1] + (to[1] - position[1]) * t,
              position[2] + (to[2] - position[2]) * t,
            ];
    }

    if (cue.action === "turn" && cue.facing !== null) {
      const to = cue.facing;
      rotationY = time >= beatEnd ? to : rotationY + (to - rotationY) * t;
    }
  }

  return { position, rotationY };
}

/** The beat active at a given playhead time, or the last beat if time is past the end. */
export function activeBeat(spec: PrevisSpec, time: number) {
  const beats = [...spec.beats].sort((a, b) => a.startTime - b.startTime);
  return beats.find((b) => time >= b.startTime && time < b.startTime + b.duration) ?? beats[beats.length - 1];
}

export function specDuration(spec: PrevisSpec): number {
  return spec.beats.reduce((max, b) => Math.max(max, b.startTime + b.duration), 0);
}
