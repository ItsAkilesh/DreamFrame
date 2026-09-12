// headroom.ts
// Purpose: HEADROOM — flags cramped/dead-space framing above the subject's
//          head, or the subject being entirely out of frame (plan.md §9.2 #3).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { headPos, nameOf, toNDC } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

export function checkHeadroom(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];

  for (const beat of spec.beats) {
    const cam = spec.cameras.find((c) => c.id === beat.shot.cameraId);
    if (!cam) continue;

    const head = headPos(spec, beat.shot.subjectId, beat.id);
    const ndc = toNDC(cam, head);

    if (Math.abs(ndc.x) > 1 || Math.abs(ndc.y) > 1) {
      notes.push({
        id: `headroom_offscreen_${beat.id}`,
        code: "HEADROOM",
        severity: "error",
        beatIds: [beat.id],
        characterIds: [beat.shot.subjectId],
        message: `${nameOf(spec, beat.shot.subjectId)} is out of frame entirely on beat ${beat.id}.`,
      });
      continue;
    }

    const topMargin = (1 - ndc.y) / 2;
    if (topMargin < 0.04) {
      notes.push({
        id: `headroom_cramped_${beat.id}`,
        code: "HEADROOM",
        severity: "warning",
        beatIds: [beat.id],
        characterIds: [beat.shot.subjectId],
        message: `Beat ${beat.id} frames ${nameOf(spec, beat.shot.subjectId)} with cramped headroom.`,
      });
    } else if (topMargin > 0.12) {
      notes.push({
        id: `headroom_dead_space_${beat.id}`,
        code: "HEADROOM",
        severity: "warning",
        beatIds: [beat.id],
        characterIds: [beat.shot.subjectId],
        message: `Beat ${beat.id} leaves dead space above ${nameOf(spec, beat.shot.subjectId)}'s head.`,
      });
    }
  }

  return notes;
}
