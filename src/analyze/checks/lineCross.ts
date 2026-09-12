// lineCross.ts
// Purpose: LINE_CROSS — the 180-degree rule (plan.md §9.2 #1). The single
//          most recognisable mistake in film grammar.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { mirrorAcrossAxis, nameOf, otherCharacterFor, sideOfAxis, sortedBeats } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const AXIS_EPSILON = 0.15;

export function checkLineCross(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];
  const beats = sortedBeats(spec);

  for (let i = 0; i < beats.length - 1; i++) {
    const beatI = beats[i];
    const beatJ = beats[i + 1];

    const subjectI = beatI.shot.subjectId;
    const subjectJ = beatJ.shot.subjectId;

    // The common case, and the one that actually defines a shot/reverse
    // pair: consecutive beats on two different subjects. Only fall back to
    // the line-speaker/nearest-character heuristic when the subject doesn't
    // change (no natural "reverse" partner to read off the beats directly).
    const otherI = subjectI !== subjectJ ? subjectJ : otherCharacterFor(spec, beatI, subjectI);
    const otherJ = subjectI !== subjectJ ? subjectI : otherCharacterFor(spec, beatJ, subjectJ);
    if (!otherI || !otherJ) continue;

    const pairI = new Set([subjectI, otherI]);
    const pairJ = new Set([subjectJ, otherJ]);
    const samePair = pairI.size === 2 && pairJ.size === 2 && [...pairI].every((id) => pairJ.has(id));
    if (!samePair) continue;

    const posA = spec.cast.find((c) => c.id === subjectI)?.position;
    const posB = spec.cast.find((c) => c.id === otherI)?.position;
    const camI = spec.cameras.find((c) => c.id === beatI.shot.cameraId);
    const camJ = spec.cameras.find((c) => c.id === beatJ.shot.cameraId);
    if (!posA || !posB || !camI || !camJ) continue;

    const s1 = sideOfAxis(posA, posB, camI.position);
    const s2 = sideOfAxis(posA, posB, camJ.position);

    if (Math.sign(s1) !== Math.sign(s2) && Math.abs(s1) > AXIS_EPSILON && Math.abs(s2) > AXIS_EPSILON) {
      notes.push({
        id: `line_cross_${beatI.id}_${beatJ.id}`,
        code: "LINE_CROSS",
        severity: "error",
        beatIds: [beatI.id, beatJ.id],
        characterIds: [subjectI, otherI],
        message: `Shots ${beatI.id}→${beatJ.id} cross the line of action between ${nameOf(spec, subjectI)} and ${nameOf(spec, otherI)}. On the cut, ${nameOf(spec, subjectI)} appears to jump to the other side of frame.`,
        suggestedFix: {
          cameraId: camJ.id,
          position: mirrorAcrossAxis(posA, posB, camJ.position),
          lookAt: camJ.lookAt,
          lens_mm: camJ.lens_mm,
        },
      });
    }
  }

  return notes;
}
