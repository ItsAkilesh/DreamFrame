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
  // The asset library's "animation" category id (its filename) whose label
  // best matched `action`, resolved server-side at simulation time — see
  // src/lib/animation-match.ts. Null when nothing labeled matched well
  // enough (most of the library isn't labeled yet — see
  // scripts/label-animations.mjs).
  animationAssetId: string | null;
}

export interface SimulationRun {
  id: string;
  sceneId: string;
  transcript: SimulationTurn[];
  createdAt: string;
}

export interface ScriptData {
  id: string;
  title: string;
  acts: Act[];
  scenes: Scene[];
  characters: Character[];
  simulationRuns: SimulationRun[];
}
