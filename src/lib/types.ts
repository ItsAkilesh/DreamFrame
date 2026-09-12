// types.ts
// Purpose: Shared domain types for scripts, scenes, characters, and simulation metrics.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

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

export interface Scene {
  id: string;
  actId: string;
  order: number;
  title: string;
  text: string;
  toneTarget: string;
  characterIds: string[];
  metrics: DashboardMetrics | null;
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
