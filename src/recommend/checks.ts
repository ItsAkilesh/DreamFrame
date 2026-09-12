// checks.ts
// Purpose: Deterministic script-improvement checks. Every recommendation here
//          is computed straight from the scene, its cast, its latest simulated
//          transcript, and the judge's scores — same reasoning as the previs
//          analyzer (src/analyze) and the scene-composition stats: a note
//          backed by the actual data is worth more than a plausible-sounding
//          opinion, and it costs nothing to produce. The LLM pass
//          (src/lib/ai/recommendScript.ts) may only rephrase these; it can
//          never create, delete, or reclassify one.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { computeSceneComposition, countTensionPeaks } from "@/lib/scene-composition";
import type {
  Character,
  DashboardMetrics,
  Recommendation,
  SimulationTurn,
} from "@/lib/types";

// One character holding this much of the scene's words means the others are
// reacting, not playing.
const DOMINANT_WORD_SHARE = 65;
// Three lines in a row from the same mouth is where a exchange starts reading
// as a speech (the dashboard already flags this on the composition card).
const MONOLOGUE_TURNS = 3;
// A scene summary thinner than this can't carry a beat, and the simulation
// agents have nothing to play against.
const THIN_SCENE_WORDS = 25;
// Past four speaking parts, a single scene can't give everyone a want.
const CROWDED_CAST = 4;
// A tension curve that never moves this far has no shape to it.
const FLAT_TENSION_RANGE = 20;
// Judge-score thresholds. Deliberately lenient — the judge is told most real
// scenes land in the 40-75 band, so only genuine outliers should fire.
const WEAK_ARC_SCORE = 50;
const LOW_ENGAGEMENT_SCORE = 50;
const INCONSISTENT_CHARACTER_SCORE = 55;
const HIGH_TONE_DRIFT = 40;
const HIGH_FRAGILITY = 50;
// A motivation this short ("wants more") gives an agent nothing to act on.
const THIN_MOTIVATION_WORDS = 3;

export interface RecommendationInput {
  scene: {
    id: string;
    title: string;
    text: string;
    toneTarget: string;
    characterIds: string[];
  };
  // The full cast of the script; the scene's own members are resolved from
  // scene.characterIds so a stale id can't crash a check.
  characters: Character[];
  // The latest simulated run's transcript, or [] when the scene has never
  // been simulated.
  transcript: SimulationTurn[];
  metrics: DashboardMetrics | null;
}

export type RecommendationCheck = (input: RecommendationInput) => Recommendation[];

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

function sceneCast(input: RecommendationInput): Character[] {
  return input.characters.filter((character) =>
    input.scene.characterIds.includes(character.id)
  );
}

// `source` and `code` are the same for every deterministic finding, so each
// check only states what differs.
function detected(
  fields: Omit<Recommendation, "source" | "quote"> & { quote?: string | null }
): Recommendation {
  return { quote: null, ...fields, source: "detected" };
}

export const checkMissingToneTarget: RecommendationCheck = (input) => {
  if (input.scene.toneTarget.trim().length > 0) return [];
  return [
    detected({
      id: `${input.scene.id}_missing_tone_target`,
      code: "MISSING_TONE_TARGET",
      priority: "medium",
      category: "tone",
      title: "No tone target on this scene",
      detail:
        "This scene has no intended tone, so nothing can tell you whether the dialogue landed where you wanted it — the tone-drift score has no baseline to measure against.",
      fix: 'Set a short tone target on the scene (e.g. "tense, restrained" or "warm but evasive").',
      characterIds: [],
    }),
  ];
};

export const checkThinScene: RecommendationCheck = (input) => {
  const words = wordCount(input.scene.text);
  if (words >= THIN_SCENE_WORDS) return [];
  return [
    detected({
      id: `${input.scene.id}_thin_scene`,
      code: "THIN_SCENE",
      priority: "high",
      category: "structure",
      title: `Scene text is only ${words} word${words === 1 ? "" : "s"}`,
      detail:
        "There isn't enough on the page to carry a dramatic beat, and the simulation agents have almost nothing to play against — they'll invent the scene rather than perform yours.",
      fix: "Expand the summary to say what changes in this scene: what each character wants going in, what they do about it, and what's different by the end.",
      characterIds: [],
    }),
  ];
};

export const checkCastSize: RecommendationCheck = (input) => {
  const cast = sceneCast(input);

  if (cast.length === 0) {
    return [
      detected({
        id: `${input.scene.id}_empty_cast`,
        code: "EMPTY_CAST",
        priority: "high",
        category: "structure",
        title: "No characters assigned to this scene",
        detail:
          "With no cast, the scene can't be simulated, scored, or blocked in 3D — every downstream feature is inert on it.",
        fix: "Assign the characters who appear in this scene from the Characters in scene list.",
        characterIds: [],
      }),
    ];
  }

  if (cast.length < CROWDED_CAST) return [];

  return [
    detected({
      id: `${input.scene.id}_crowded_cast`,
      code: "CROWDED_CAST",
      priority: "medium",
      category: "structure",
      title: `${cast.length} speaking parts in one scene`,
      detail: `${cast
        .map((character) => character.name)
        .join(", ")} all share this scene. At that size someone is usually there to witness rather than to want something, and the audience loses track of whose scene it is.`,
      fix: "Decide whose scene this is, then either cut a character, give them a reason to leave partway through, or split the beat into two scenes.",
      characterIds: cast.map((character) => character.id),
    }),
  ];
};

export const checkThinMotivation: RecommendationCheck = (input) =>
  sceneCast(input)
    .filter((character) => wordCount(character.motivation) < THIN_MOTIVATION_WORDS)
    .map((character) =>
      detected({
        id: `${input.scene.id}_thin_motivation_${character.id}`,
        code: "THIN_MOTIVATION",
        priority: "medium",
        category: "character",
        title: `${character.name} has no stated motivation`,
        detail: `${character.name} is in this scene without a want the simulation can act on, so their agent falls back on generic reactions and the consistency score has nothing to hold them to.`,
        fix: `Give ${character.name} a concrete objective for this scene — what they're trying to get, and from whom.`,
        characterIds: [character.id],
      })
    );

export const checkNotSimulated: RecommendationCheck = (input) => {
  if (input.transcript.length > 0) return [];
  return [
    detected({
      id: `${input.scene.id}_not_simulated`,
      code: "NOT_SIMULATED",
      priority: "low",
      category: "structure",
      title: "Scene has never been simulated",
      detail:
        "Dialogue balance, pacing, and tone notes are all derived from a simulated take, so this list is limited to what's visible on the page.",
      fix: "Run a Branch Impact Simulation on this scene to unlock the transcript- and score-based recommendations.",
      characterIds: [],
    }),
  ];
};

export const checkDialogueImbalance: RecommendationCheck = (input) => {
  if (input.transcript.length === 0) return [];
  const { dialogueBalance } = computeSceneComposition(input.transcript, input.characters);
  const lead = dialogueBalance[0];
  if (!lead || dialogueBalance.length < 2 || lead.percentage < DOMINANT_WORD_SHARE) {
    return [];
  }

  const others = dialogueBalance.slice(1);
  return [
    detected({
      id: `${input.scene.id}_dialogue_imbalance_${lead.characterId}`,
      code: "DIALOGUE_IMBALANCE",
      priority: lead.percentage >= 80 ? "high" : "medium",
      category: "dialogue",
      title: `${lead.name} speaks ${lead.percentage}% of the scene`,
      detail: `${lead.name} carries ${lead.percentage}% of the words; ${others
        .map((share) => `${share.name} ${share.percentage}%`)
        .join(", ")}. The scene reads as one character explaining and the rest agreeing.`,
      fix: `Move some of ${lead.name}'s information into the other characters' mouths — let them ask, contradict, or withhold instead of receiving.`,
      characterIds: dialogueBalance.map((share) => share.characterId),
    }),
  ];
};

export const checkSilentCastMember: RecommendationCheck = (input) => {
  if (input.transcript.length === 0) return [];
  const spoke = new Set(input.transcript.map((turn) => turn.characterId));

  return sceneCast(input)
    .filter((character) => !spoke.has(character.id))
    .map((character) =>
      detected({
        id: `${input.scene.id}_silent_cast_${character.id}`,
        code: "SILENT_CAST_MEMBER",
        priority: "medium",
        category: "character",
        title: `${character.name} never speaks`,
        detail: `${character.name} is cast in this scene but said nothing in the last take — the scene doesn't currently need them.`,
        fix: `Either give ${character.name} a stake that forces them to speak, cut them from the scene, or keep the silence deliberate and give them an action beat instead.`,
        characterIds: [character.id],
      })
    );
};

export const checkMonologueRun: RecommendationCheck = (input) => {
  if (input.transcript.length === 0) return [];
  const { longestMonologue } = computeSceneComposition(input.transcript, input.characters);
  if (!longestMonologue || longestMonologue.turns < MONOLOGUE_TURNS) return [];

  return [
    detected({
      id: `${input.scene.id}_monologue_run_${longestMonologue.characterId}`,
      code: "MONOLOGUE_RUN",
      priority: "medium",
      category: "pacing",
      title: `${longestMonologue.name} holds ${longestMonologue.turns} lines in a row`,
      detail: `${longestMonologue.turns} consecutive lines from ${longestMonologue.name} with no interruption. The exchange stops being a scene and becomes a speech, and the tension flattens while it runs.`,
      fix: `Break the run — have another character cut in, or cut the middle line and let the gap do the work.`,
      characterIds: [longestMonologue.characterId],
    }),
  ];
};

export const checkFlatTension: RecommendationCheck = (input) => {
  const metrics = input.metrics;
  if (!metrics || metrics.tensionCurve.length === 0) return [];

  const range = Math.max(...metrics.tensionCurve) - Math.min(...metrics.tensionCurve);
  const peaks = countTensionPeaks(metrics.tensionCurve);
  if (range >= FLAT_TENSION_RANGE && peaks > 0) return [];

  const reason =
    range < FLAT_TENSION_RANGE
      ? `the curve only moves ${Math.round(range)} points across the whole scene`
      : "the curve climbs but never breaks";

  return [
    detected({
      id: `${input.scene.id}_flat_tension`,
      code: "FLAT_TENSION",
      priority: "high",
      category: "pacing",
      title: "The scene has no dramatic shape",
      detail: `Scored across ${metrics.tensionCurve.length} beats, ${reason} — nothing escalates and nothing releases, so the audience has no reason to lean in.`,
      fix: "Give the scene a turn: something one character says or discovers partway through that makes the rest of the scene harder for them.",
      characterIds: [],
    }),
  ];
};

export const checkToneDrift: RecommendationCheck = (input) => {
  const metrics = input.metrics;
  if (!metrics || metrics.toneDrift < HIGH_TONE_DRIFT) return [];

  const target = input.scene.toneTarget.trim();
  return [
    detected({
      id: `${input.scene.id}_tone_drift`,
      code: "TONE_DRIFT",
      priority: "high",
      category: "tone",
      title: `Tone drifted ${metrics.toneDrift}% from target`,
      detail: target
        ? `The scene is aiming for "${target}", but the take played noticeably off it.`
        : "The take played well off the scene's intended tone.",
      fix: "Work through the lines that break the tone and rewrite them, or change the tone target if the drifted version is the better scene.",
      characterIds: [],
    }),
  ];
};

export const checkFragileDialogue: RecommendationCheck = (input) => {
  const metrics = input.metrics;
  if (!metrics || metrics.fragilityRisk < HIGH_FRAGILITY) return [];

  return [
    detected({
      id: `${input.scene.id}_fragile_dialogue`,
      code: "FRAGILE_DIALOGUE",
      priority: "medium",
      category: "dialogue",
      title: `Fragility risk is ${metrics.fragilityRisk}%`,
      detail:
        "The scene works in this take but is judged likely to fall apart on a re-run — it's leaning on one particular reading rather than on what the characters want.",
      fix: "Anchor the beat in the characters' objectives rather than specific clever lines, then re-simulate and compare the two takes.",
      characterIds: [],
    }),
  ];
};

export const checkWeakArc: RecommendationCheck = (input) => {
  const metrics = input.metrics;
  if (!metrics || metrics.arcCoherence >= WEAK_ARC_SCORE) return [];

  return [
    detected({
      id: `${input.scene.id}_weak_arc`,
      code: "WEAK_ARC",
      priority: "high",
      category: "structure",
      title: `Arc coherence is ${metrics.arcCoherence}%`,
      detail:
        "The take reads closer to conversation than to a built-and-resolved beat: it isn't clear what the scene set up or what it changed.",
      fix: "Name the one thing this scene is for, cut what doesn't serve it, and make sure the end state differs from the start.",
      characterIds: [],
    }),
  ];
};

export const checkLowEngagement: RecommendationCheck = (input) => {
  const metrics = input.metrics;
  if (!metrics || metrics.engagement >= LOW_ENGAGEMENT_SCORE) return [];

  return [
    detected({
      id: `${input.scene.id}_low_engagement`,
      code: "LOW_ENGAGEMENT",
      priority: "medium",
      category: "dialogue",
      title: `Engagement is ${metrics.engagement}%`,
      detail:
        "An audience is judged likely to drift partway through this scene — the dialogue is doing more informing than withholding.",
      fix: "Cut the scene's opening and closing pleasantries, and let the characters pursue what they want instead of stating it.",
      characterIds: [],
    }),
  ];
};

export const checkCharacterConsistency: RecommendationCheck = (input) => {
  const metrics = input.metrics;
  if (!metrics || metrics.characterConsistency >= INCONSISTENT_CHARACTER_SCORE) return [];

  const cast = sceneCast(input);
  return [
    detected({
      id: `${input.scene.id}_character_consistency`,
      code: "CHARACTER_CONSISTENCY",
      priority: "medium",
      category: "character",
      title: `Character consistency is ${metrics.characterConsistency}%`,
      detail:
        "At least one character played against their stated motivation, traits, or baseline emotion during the take — they're serving the scene's needs instead of their own.",
      fix: "Check each character's motivation on the roster against what they actually do here; fix whichever is wrong — the profile or the scene.",
      characterIds: cast.map((character) => character.id),
    }),
  ];
};

export const ALL_CHECKS: RecommendationCheck[] = [
  checkThinScene,
  checkCastSize,
  checkMissingToneTarget,
  checkThinMotivation,
  checkWeakArc,
  checkFlatTension,
  checkToneDrift,
  checkDialogueImbalance,
  checkSilentCastMember,
  checkMonologueRun,
  checkFragileDialogue,
  checkLowEngagement,
  checkCharacterConsistency,
  checkNotSimulated,
];
