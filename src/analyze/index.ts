// index.ts
// Purpose: Runs all analyzer checks against a spec, sorts by severity then
//          first beat, and caps the panel at 8 notes (plan.md §9.3). A wall
//          of 30 notes reads as noise and makes the tool look unreliable.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { checkCameraInGeometry } from "@/analyze/checks/cameraInGeometry";
import { checkCoverageGap } from "@/analyze/checks/coverageGap";
import { checkEyeline } from "@/analyze/checks/eyeline";
import { checkHeadroom } from "@/analyze/checks/headroom";
import { checkLineCross } from "@/analyze/checks/lineCross";
import { checkNoseRoom } from "@/analyze/checks/noseRoom";
import { checkOcclusion } from "@/analyze/checks/occlusion";
import { checkSizeMonotony } from "@/analyze/checks/sizeMonotony";
import { checkTalkScreenSkew } from "@/analyze/checks/talkScreenSkew";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

export const ALL_CHECKS = [
  checkLineCross,
  checkSizeMonotony,
  checkHeadroom,
  checkNoseRoom,
  checkOcclusion,
  checkEyeline,
  checkCoverageGap,
  checkTalkScreenSkew,
  checkCameraInGeometry,
];

const SEVERITY_ORDER: Record<Note["severity"], number> = { error: 0, warning: 1, info: 2 };
const PANEL_CAP = 8;

export function runAnalyzer(spec: PrevisSpec): { notes: Note[]; totalCount: number } {
  const notes = ALL_CHECKS.flatMap((check) => check(spec));

  notes.sort((a, b) => {
    const severityDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (severityDiff !== 0) return severityDiff;
    const beatA = a.beatIds[0] ?? "";
    const beatB = b.beatIds[0] ?? "";
    return beatA.localeCompare(beatB);
  });

  return { notes: notes.slice(0, PANEL_CAP), totalCount: notes.length };
}
