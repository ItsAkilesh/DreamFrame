// types.ts
// Purpose: Shared domain types for scripts, scenes, characters, and simulation metrics.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

// Generic 3D-asset reference — used for both a character's model and (below)
// a scene's environment model. Named for its original use; nothing about the
// shape is character-specific.
export interface CharacterModelAsset {
  fileName: string;
  format: string;
  url: string;
  uploadedAt: string;
  // A cached, pre-rendered thumbnail — null until the shared thumbnail
  // generator has produced and saved one (see
  // src/app/api/scripts/[id]/characters/[characterId]/model/thumbnail).
  previewUrl: string | null;
}

// A shared asset library entry (see src/lib/asset-library.ts) — derived live
// from public/assets/library/, not stored in Mongo.
export interface LibraryAsset {
  id: string;
  name: string;
  format: string;
  url: string;
  // A cached, pre-rendered thumbnail — null until some viewer's browser has
  // generated and saved one (see src/app/api/asset-library/thumbnail).
  previewUrl: string | null;
}

export interface Character {
  id: string;
  name: string;
  motivation: string;
  traits: string[];
  baselineEmotion: string;
  color: string;
  // Actor's custom 3D model (FBX/GLB/glTF/Blender), uploaded separately from
  // the AI structuring pass — distinct from the previs renderer's own closed
  // Mixamo model set (src/assets/manifest.ts), which this does not feed.
  modelAsset: CharacterModelAsset | null;
  // Manually assigned ElevenLabs voice id (src/components/voice-picker.tsx).
  // Null until someone picks one — src/lib/voice/voices.ts's
  // resolveVoiceId() falls back to a deterministic per-character default so
  // simulation playback always has *a* voice, assigned or not.
  voiceId: string | null;
}

export interface DashboardMetrics {
  arcCoherence: number;
  characterConsistency: number;
  chemistryStrength: number;
  fragilityRisk: number;
  engagement: number;
  toneDrift: number;
  tensionCurve: number[];
}

// Mirrors KeyframeZ in @/schema/previsSpec — duplicated rather than imported so
// the dashboard's domain types stay free of the previs schema, same as every
// other type in this file.
export interface SceneKeyframe {
  id: string;
  characterId: string;
  time: number;
  position: [number, number, number];
  rotationY: number;
}

// A single actionable suggestion for improving a scene, produced by
// src/recommend. "detected" items come from deterministic checks over the
// scene, its cast, and its latest simulated transcript; "ai" items are craft
// notes a script-doctor LLM pass added on top (see
// src/lib/ai/recommendScript.ts). The distinction is surfaced in the UI — a
// number computed from the actual data carries more weight than a plausible
// opinion, so the two are never presented as the same thing.
export type RecommendationPriority = "high" | "medium" | "low";
export type RecommendationCategory =
  | "dialogue"
  | "pacing"
  | "character"
  | "tone"
  | "structure";
export type RecommendationSource = "detected" | "ai";

export interface Recommendation {
  // Stable for a given scene + check + subject, so re-running recommendations
  // doesn't reshuffle keys under the user's cursor.
  id: string;
  code: string;
  priority: RecommendationPriority;
  category: RecommendationCategory;
  source: RecommendationSource;
  title: string;
  // What's off, in plain language.
  detail: string;
  // The concrete change to make. Always present — a note without a fix is a
  // complaint, not a recommendation.
  fix: string;
  characterIds: string[];
  // The line or phrase the note is about, when there is one.
  quote: string | null;
}

export interface SceneRecommendations {
  generatedAt: string;
  // The simulation run whose transcript the transcript-derived items were
  // computed against; null when the scene had never been simulated.
  basedOnRunId: string | null;
  items: Recommendation[];
}

export interface Scene {
  id: string;
  actId: string;
  order: number;
  title: string;
  text: string;
  toneTarget: string;
  characterIds: string[];
  metrics: DashboardMetrics | null;
  // The scene's assigned 3D environment (room/set) model, uploaded or picked
  // from the asset library's "scene" category — renders in place of the
  // previs Stage's placeholder room when set.
  modelAsset: CharacterModelAsset | null;
  // Authored in the Editor View's timeline; [] for every scene never edited.
  keyframes: SceneKeyframe[];
  // The last saved AI-polished recommendation set; null until the user asks
  // for one. The deterministic checks behind it run live in the panel and
  // need nothing stored.
  recommendations: SceneRecommendations | null;
}

export interface Act {
  id: string;
  title: string;
  order: number;
}

export interface SimulationTurn {
  characterId: string;
  text: string;
  turnIndex: number;
  // A short present-tense physical action the agent chose for this line
  // (e.g. "crosses her arms"), independent of the dialogue itself.
  action: string;
  // Hidden acting direction for expressive TTS; optional for simulations
  // saved before emotional voice direction was introduced.
  voiceDirection?: string | null;
  // The asset library's "animation" category id (its filename) whose label
  // best matched `action`, resolved server-side at simulation time — see
  // src/lib/animation-match.ts. Null when nothing labeled matched well
  // enough (most of the library isn't labeled yet — see
  // scripts/label-animations.mjs).
  animationAssetId: string | null;
}

// A distinct critical lens a simulated performance is judged from — e.g. a
// mainstream viewer vs. a festival critic. The defaults (DEFAULT_AUDIENCE_
// PERSONAS, src/lib/ai/audienceReview.ts) are hardcoded and always active;
// AudiencePersona here only describes a script's own *custom* additions.
export interface AudiencePersona {
  id: string;
  name: string;
  description: string;
}

export interface AudienceCritique {
  personaId: string;
  personaName: string;
  critique: string;
}

// The result of running every active persona's critique through a moderator
// pass that reconciles disagreement into one usable review — see
// src/lib/ai/audienceReview.ts. Attached per SimulationRun (not the scene),
// so a scene's simulation history keeps each run's own review rather than
// one field that only ever reflects the latest.
export interface AudienceReview {
  critiques: AudienceCritique[];
  summary: string;
  recommendations: string[];
}

export interface SimulationRun {
  id: string;
  sceneId: string;
  transcript: SimulationTurn[];
  createdAt: string;
  // Null until the post-simulation audience panel finishes (or if it failed —
  // the transcript itself is never blocked on this succeeding).
  audienceReview: AudienceReview | null;
}

export interface ScriptData {
  id: string;
  title: string;
  acts: Act[];
  scenes: Scene[];
  characters: Character[];
  simulationRuns: SimulationRun[];
  // Custom audience personas this script's author has added, on top of the
  // always-active defaults.
  audiencePersonas: AudiencePersona[];
}
