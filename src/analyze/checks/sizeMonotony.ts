// sizeMonotony.ts
// Purpose: SIZE_MONOTONY — no escalation, flags a run of >=3 consecutive
//          beats with an identical recomputed shot size (plan.md §9.2 #2).
//          Never trusts shot.shotSize; also emits an `info` note when the
//          LLM's stated size disagrees with the computed one by 2+ steps.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { distance, headPos, nameOf, sortedBeats } from "@/analyze/geom";
import { vFov, type Note, type PrevisSpec } from "@/schema/previsSpec";

const SIZE_ORDER = ["ECU", "CU", "MCU", "MS", "MWS", "WS"] as const;
type SizeLabel = (typeof SIZE_ORDER)[number];

function computeSize(framedHeightM: number): SizeLabel {
  if (framedHeightM < 0.35) return "ECU";
  if (framedHeightM < 0.6) return "CU";
  if (framedHeightM < 1.0) return "MCU";
  if (framedHeightM < 1.6) return "MS";
  if (framedHeightM < 2.4) return "MWS";
  return "WS";
}

function framedHeightFor(spec: PrevisSpec, beat: PrevisSpec["beats"][number]): number | null {
  const cam = spec.cameras.find((c) => c.id === beat.shot.cameraId);
  if (!cam) return null;
  const head = headPos(spec, beat.shot.subjectId, beat.id);
  const d = distance(cam.position, head);
  return 2 * d * Math.tan(vFov(cam.lens_mm) / 2);
}

export function checkSizeMonotony(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];
  const beats = sortedBeats(spec);

  const sizes = beats.map((beat) => {
    const fh = framedHeightFor(spec, beat);
    return fh === null ? null : computeSize(fh);
  });

  // Runs of >= 3 consecutive identical computed sizes.
  let runStart = 0;
  for (let i = 1; i <= beats.length; i++) {
    const sameAsRun = i < beats.length && sizes[i] !== null && sizes[i] === sizes[runStart];
    if (!sameAsRun) {
      const runLength = i - runStart;
      if (runLength >= 3 && sizes[runStart] !== null) {
        const runBeats = beats.slice(runStart, i);
        const middle = runBeats[Math.floor(runBeats.length / 2)];
        notes.push({
          id: `size_monotony_${runBeats[0].id}_${runBeats[runBeats.length - 1].id}`,
          code: "SIZE_MONOTONY",
          severity: "warning",
          beatIds: runBeats.map((b) => b.id),
          characterIds: [...new Set(runBeats.map((b) => b.shot.subjectId))],
          message: `Beats ${runBeats[0].id}–${runBeats[runBeats.length - 1].id} are all ${sizes[runStart]}. The scene flattens — the audience gets no sense that anything is escalating.`,
          suggestedFix: {
            cameraId: middle.shot.cameraId,
            lens_mm: (spec.cameras.find((c) => c.id === middle.shot.cameraId)?.lens_mm ?? 50) + 15,
          },
        });
      }
      runStart = i;
    }
  }

  // Info: LLM's stated shotSize disagrees with computed by >= 2 steps.
  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i];
    const stated = beat.shot.shotSize;
    const computed = sizes[i];
    if (!stated || !computed) continue;
    const diff = Math.abs(SIZE_ORDER.indexOf(stated) - SIZE_ORDER.indexOf(computed));
    if (diff >= 2) {
      notes.push({
        id: `size_monotony_stated_mismatch_${beat.id}`,
        code: "SIZE_MONOTONY",
        severity: "info",
        beatIds: [beat.id],
        characterIds: [beat.shot.subjectId],
        message: `Beat ${beat.id} states shotSize ${stated} but the camera/lens geometry computes to ${computed} on ${nameOf(spec, beat.shot.subjectId)}.`,
      });
    }
  }

  return notes;
}
