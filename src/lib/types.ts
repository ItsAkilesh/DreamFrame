// types.ts
// Purpose: Shared domain types for scripts, scenes, characters, and simulation metrics.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

export interface Character {
  id: string;
  name: string;
  motivation: string;
  traits: string[];
  baselineEmotion: string;
  color: string;
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

export interface ScriptData {
  id: string;
  title: string;
  acts: Act[];
  scenes: Scene[];
  characters: Character[];
}
