// fromScene.ts
// Purpose: Placeholder adapter from the dashboard's Scene/Character data
//          (a prose summary, no per-line dialogue) into a PrevisSpec, for
//          the Editor View. This is NOT `blockScene` (plan.md §7.1, M2) —
//          there is no AI blocking call here, no dialogue breakdown, and no
//          real staging. It reuses the plan's own documented fallback
//          pattern (§13, §16 fallback.ts): characters arranged in a circle
//          facing the centre, a default 4-camera rig, one description-only
//          beat. Real per-line blocking is a separate, later milestone.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { MODEL_IDS } from "@/assets/manifest";
import { PrevisSpecZ, type PrevisSpec } from "@/schema/previsSpec";
import type { Character as DashboardCharacter, Scene } from "@/lib/types";

const CIRCLE_RADIUS = 1.8;
const PLACEHOLDER_COLORS = ["#e07a5f", "#3d5a80", "#8a5a9e", "#588157", "#bc6c25"];

function estimateDuration(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1.2, (words / 150) * 60);
}

export function fromScene(scene: Scene, allCharacters: DashboardCharacter[]): PrevisSpec {
  const characters = scene.characterIds
    .map((id) => allCharacters.find((c) => c.id === id))
    .filter((c): c is DashboardCharacter => Boolean(c))
    .slice(0, 5);

  if (characters.length === 0) {
    throw new Error("fromScene: scene has no characters to place");
  }

  const n = characters.length;
  const cast = characters.map((character, i) => {
    const angle = (i / n) * Math.PI * 2;
    const x = Math.sin(angle) * CIRCLE_RADIUS;
    const z = Math.cos(angle) * CIRCLE_RADIUS;
    // Face the centre: rotationY 0 = facing +Z, so face the opposite of the
    // outward radial direction.
    const rotationY = Math.atan2(-x, -z);

    return {
      id: character.id,
      name: character.name.toUpperCase(),
      modelId: MODEL_IDS[i % MODEL_IDS.length],
      position: [x, 0, z] as [number, number, number],
      rotationY,
      posture: "standing" as const,
      direction: character.motivation,
      voiceId: "",
      color: PLACEHOLDER_COLORS[i % PLACEHOLDER_COLORS.length],
    };
  });

  const wideCamera = {
    id: "cam_wide",
    label: "Wide",
    position: [0, 1.8, CIRCLE_RADIUS + 3.5] as [number, number, number],
    lookAt: [0, 1.4, 0] as [number, number, number],
    lens_mm: 28,
  };

  const raw = {
    version: "0.1" as const,
    scene: {
      id: scene.id,
      slugline: scene.title,
      room: "kitchen" as const,
      timeOfDay: "day" as const,
      mood: scene.toneTarget || "neutral",
      toneTarget: scene.toneTarget,
    },
    set: {
      dimensions: { w: 6, d: 5, h: 3 },
      props: [],
      lights: [],
    },
    cast,
    cameras: [wideCamera],
    beats: [
      {
        id: "b_001",
        startTime: 0,
        duration: estimateDuration(scene.text),
        line: null,
        blocking: [],
        shot: { cameraId: wideCamera.id, subjectId: cast[0].id, move: "static" as const },
      },
    ],
  };

  return PrevisSpecZ.parse(raw);
}
