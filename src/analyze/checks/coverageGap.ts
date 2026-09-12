// coverageGap.ts
// Purpose: COVERAGE_GAP — a character with real dialogue who is never a shot
//          subject, so there is nothing to cut to (plan.md §9.2 #7).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { nameOf } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const MIN_LINES_FOR_COVERAGE = 2;

export function checkCoverageGap(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];

  for (const character of spec.cast) {
    const lineCount = spec.beats.filter((b) => b.line?.characterId === character.id).length;
    if (lineCount < MIN_LINES_FOR_COVERAGE) continue;

    const isEverSubject = spec.beats.some((b) => b.shot.subjectId === character.id);
    if (isEverSubject) continue;

    notes.push({
      id: `coverage_gap_${character.id}`,
      code: "COVERAGE_GAP",
      severity: "error",
      beatIds: spec.beats.filter((b) => b.line?.characterId === character.id).map((b) => b.id),
      characterIds: [character.id],
      message: `${nameOf(spec, character.id)} speaks ${lineCount} lines and is never the subject of a shot. There's no coverage to cut to.`,
    });
  }

  return notes;
}
