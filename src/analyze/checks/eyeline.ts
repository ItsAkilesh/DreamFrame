// eyeline.ts
// Purpose: EYELINE — for a shot/reverse pair, flags mismatched eyelines that
//          won't read as the two characters looking at each other when cut
//          together (plan.md §9.2 #6).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { headPos, nameOf, sortedBeats } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const EYELINE_TOLERANCE_DEG = 25;

// A wide/establishing shot isn't a matched reverse in film grammar — eyeline
// matching applies to OTS/CU coverage, not a cut from a wide.
const ESTABLISHING_LENS_MAX_MM = 24;

function angleXZ(a: [number, number, number], b: [number, number, number]): number {
  const dot = a[0] * b[0] + a[2] * b[2];
  const magA = Math.hypot(a[0], a[2]);
  const magB = Math.hypot(b[0], b[2]);
  if (magA === 0 || magB === 0) return 0;
  const cos = Math.min(1, Math.max(-1, dot / (magA * magB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function vec(from: [number, number, number], to: [number, number, number]): [number, number, number] {
  return [to[0] - from[0], 0, to[2] - from[2]];
}

export function checkEyeline(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];
  const beats = sortedBeats(spec);

  for (let i = 0; i < beats.length - 1; i++) {
    const beatA = beats[i];
    const beatB = beats[i + 1];
    const subjectA = beatA.shot.subjectId;
    const subjectB = beatB.shot.subjectId;

    if (subjectA === subjectB) continue; // not a shot/reverse pair — no reverse to check

    // Only a genuine two-hander exchange counts as a reverse: if either
    // beat's line is spoken by someone outside this pair, it's a cutaway or
    // reaction shot, not a matched shot/reverse of these two subjects.
    if (beatA.line && beatA.line.characterId !== subjectA && beatA.line.characterId !== subjectB) continue;
    if (beatB.line && beatB.line.characterId !== subjectA && beatB.line.characterId !== subjectB) continue;

    const camA = spec.cameras.find((c) => c.id === beatA.shot.cameraId);
    const camB = spec.cameras.find((c) => c.id === beatB.shot.cameraId);
    if (!camA || !camB) continue;
    if (camA.lens_mm < ESTABLISHING_LENS_MAX_MM || camB.lens_mm < ESTABLISHING_LENS_MAX_MM) continue;

    const headA = headPos(spec, subjectA, beatA.id);
    const headB = headPos(spec, subjectB, beatB.id);

    const alphaA = angleXZ(vec(headA, headB), vec(headA, camA.position));
    const alphaB = angleXZ(vec(headB, headA), vec(headB, camB.position));

    if (Math.abs(alphaA - alphaB) > EYELINE_TOLERANCE_DEG) {
      notes.push({
        id: `eyeline_${beatA.id}_${beatB.id}`,
        code: "EYELINE",
        severity: "warning",
        beatIds: [beatA.id, beatB.id],
        characterIds: [subjectA, subjectB],
        message: `The reverse on ${nameOf(spec, subjectB)} doesn't match ${nameOf(spec, subjectA)}'s eyeline — cut together, they won't look like they're looking at each other.`,
      });
    }
  }

  return notes;
}
