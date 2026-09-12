// index.ts
// Purpose: Runs every deterministic script-improvement check against a scene,
//          sorts the findings by priority, and caps the list. Same panel
//          discipline as the previs analyzer (src/analyze): a wall of notes
//          reads as noise and makes the tool look unreliable, so the user
//          sees the few that matter and a count of the rest.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { ALL_CHECKS, type RecommendationInput } from "@/recommend/checks";
import type { Recommendation, RecommendationPriority, SimulationRun } from "@/lib/types";

export { ALL_CHECKS } from "@/recommend/checks";
export type { RecommendationCheck, RecommendationInput } from "@/recommend/checks";

const PRIORITY_ORDER: Record<RecommendationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const PANEL_CAP = 8;

export interface RecommendationResult {
  items: Recommendation[];
  totalCount: number;
}

export function runRecommendationChecks(input: RecommendationInput): RecommendationResult {
  const items = ALL_CHECKS.flatMap((check) => check(input));

  items.sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    // Stable, id-ordered within a priority band so re-running never reshuffles
    // the list under the user's cursor.
    return a.id.localeCompare(b.id);
  });

  return { items: items.slice(0, PANEL_CAP), totalCount: items.length };
}

// The transcript-derived checks read the most recent take, which is also what
// the dashboard's scene-composition card shows — so both always describe the
// same run.
export function latestRunForScene(
  runs: SimulationRun[],
  sceneId: string
): SimulationRun | null {
  return (
    runs
      .filter((run) => run.sceneId === sceneId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .at(-1) ?? null
  );
}
