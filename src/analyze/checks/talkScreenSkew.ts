// talkScreenSkew.ts
// Purpose: TALK_SCREEN_SKEW — flags a character whose share of dialogue and
//          share of shots diverge notably (plan.md §9.2 #8). Info only.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { nameOf } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const SKEW_THRESHOLD = 0.25;

export function checkTalkScreenSkew(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];
  if (spec.beats.length === 0) return notes;

  const totalWords = spec.beats.reduce(
    (sum, b) => sum + (b.line?.text.trim().split(/\s+/).filter(Boolean).length ?? 0),
    0
  );
  if (totalWords === 0) return notes;

  for (const character of spec.cast) {
    const words = spec.beats.reduce(
      (sum, b) =>
        b.line?.characterId === character.id
          ? sum + b.line.text.trim().split(/\s+/).filter(Boolean).length
          : sum,
      0
    );
    const talkShare = words / totalWords;
    const screenShare =
      spec.beats.filter((b) => b.shot.subjectId === character.id).length / spec.beats.length;

    if (Math.abs(talkShare - screenShare) > SKEW_THRESHOLD) {
      notes.push({
        id: `talk_screen_skew_${character.id}`,
        code: "TALK_SCREEN_SKEW",
        severity: "info",
        beatIds: [],
        characterIds: [character.id],
        message: `${nameOf(spec, character.id)} carries ${Math.round(talkShare * 100)}% of the dialogue but only ${Math.round(screenShare * 100)}% of the shots.`,
      });
    }
  }

  return notes;
}
