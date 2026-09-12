// animationMap.ts
// Purpose: Deterministic emotion -> animation-clip selection for the previs
//          stage (plan.md §6.5). A lookup table, not a model call: the same
//          line always produces the same body language, it costs nothing per
//          beat, and it still works with the LLM switched off — the same
//          argument the analyzer rests on.
//
//          Clip *names* come from the asset library's labels
//          (scripts/label-animations.mjs), which are terse present-tense
//          phrases like "Angry Gesture" or "Crossing Arms". This maps a
//          line's free-text `emotion` onto those labels by pattern, so it
//          degrades gracefully as the library grows or is relabeled.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import type { PrevisSpec } from "@/schema/previsSpec";

export interface LabeledAnimation {
  id: string;
  name: string;
}

/**
 * Ordered rules: the first whose `emotion` pattern matches the line's emotion
 * wins, then the first library clip whose label matches `clip` is used. Order
 * matters — specific states come before the generic talking fallback.
 */
const RULES: { emotion: RegExp; clip: RegExp }[] = [
  { emotion: /ang(er|ry)|furious|rage|hostile|confront|accus|irritat|annoy/i, clip: /angry|argu|yell|shout|aggress|point/i },
  { emotion: /sad|sorrow|grief|griev|hurt|defeat|resign|exhaust|weary/i, clip: /sad|cry|sob|mourn|defeat|slump/i },
  { emotion: /afraid|scared|fear|fright|panic|nervous|anxio|worried|dread/i, clip: /scared|afraid|nervous|fidget|cower|shiver/i },
  { emotion: /surpris|shock|startl|astonish/i, clip: /surpris|shock|startl|gasp/i },
  { emotion: /guarded|defensive|wary|closed|withhold|evasive/i, clip: /cross(ing)? arms|defensive|guard|shrug/i },
  { emotion: /happy|warm|relief|relieved|pleased|amused/i, clip: /happy|laugh|cheer|clap|excit/i },
  { emotion: /think|consider|ponder|uncertain|unsure/i, clip: /think|ponder|scratch|idle/i },
  { emotion: /plead|beg|placat|apolog/i, clip: /plead|beg|apolog|shrug/i },
  // Anything else that is spoken: a neutral talking cycle reads better than a
  // standing idle, because a still mouth-less figure delivering a line reads
  // as nobody speaking at all.
  { emotion: /.*/, clip: /talk|speak|conversation|explain|discuss/i },
];

/** The clip label to play for a spoken line, or null when nothing matches. */
export function pickAnimationFor(
  emotion: string,
  library: LabeledAnimation[]
): LabeledAnimation | null {
  if (library.length === 0) return null;
  for (const rule of RULES) {
    if (!rule.emotion.test(emotion)) continue;
    const hit = library.find((asset) => rule.clip.test(asset.name));
    if (hit) return hit;
  }
  return null;
}

/** The beat covering `time`, or the last one that started before it. */
export function activeBeat(spec: PrevisSpec, time: number): PrevisSpec["beats"][number] | null {
  let current: PrevisSpec["beats"][number] | null = null;
  for (const beat of spec.beats) {
    if (beat.startTime > time) break;
    current = beat;
  }
  return current;
}

/**
 * Which library clip a given character should be playing at `time`: their
 * line's emotion clip while they speak, otherwise null so the caller can fall
 * back to the shared idle.
 */
export function animationForCharacterAt(
  spec: PrevisSpec,
  characterId: string,
  time: number,
  library: LabeledAnimation[]
): LabeledAnimation | null {
  const beat = activeBeat(spec, time);
  const line = beat?.line;
  if (!line || line.characterId !== characterId) return null;
  return pickAnimationFor(line.emotion ?? "", library);
}
