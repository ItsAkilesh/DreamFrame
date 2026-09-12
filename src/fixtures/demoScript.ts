// demoScript.ts
// Purpose: A hand-authored ScriptData used when MongoDB is unreachable, so the
//          dashboard shows a real Act/Scene/Character tree instead of an empty
//          state. plan.md §13 requires the app to open with the database down,
//          and §15 requires a fallback that needs no network on stage. Nothing
//          here is persisted — edits will not save while this is showing.
// Author: lovegupta2001@gmail.com
// Date: 2026-09-12

import type { ScriptData } from "@/lib/types";

const CHARACTERS = [
  {
    id: "demo-ch-alex",
    name: "ALEX",
    motivation: "Get the numbers signed off before anyone reads them closely.",
    traits: ["controlled", "evasive", "quick"],
    baselineEmotion: "guarded",
    color: "#e07a5f",
    modelAsset: null,
  },
  {
    id: "demo-ch-jordan",
    name: "JORDAN",
    motivation: "Find out what Alex changed, and why.",
    traits: ["direct", "patient", "unimpressed"],
    baselineEmotion: "wary",
    color: "#3d5a80",
    modelAsset: null,
  },
  {
    id: "demo-ch-sam",
    name: "SAM",
    motivation: "Keep the room from catching fire.",
    traits: ["placating", "talkative", "anxious"],
    baselineEmotion: "nervous",
    color: "#8a5a9e",
    modelAsset: null,
  },
];

const ACTS = [
  { id: "demo-act-1", title: "Act I — The Discrepancy", order: 1 },
  { id: "demo-act-2", title: "Act II — The Admission", order: 2 },
];

export const DEMO_SCRIPT: ScriptData = {
  id: "demo-script",
  title: "Demo — Quarterly (offline)",
  acts: ACTS,
  characters: CHARACTERS,
  simulationRuns: [],
  audiencePersonas: [],
  scenes: [
    {
      id: "demo-scene-office",
      actId: "demo-act-1",
      order: 1,
      title: "INT. OPEN-PLAN OFFICE - DAY",
      text: "Jordan confronts Alex about revised figures while Sam tries to defuse it. Alex deflects; Jordan does not let go.",
      toneTarget: "tense, restrained",
      characterIds: ["demo-ch-alex", "demo-ch-jordan", "demo-ch-sam"],
      metrics: null,
      keyframes: [],
      modelAsset: null,
    },
    {
      id: "demo-scene-kitchen",
      actId: "demo-act-2",
      order: 2,
      title: "INT. APARTMENT KITCHEN - NIGHT",
      text: "Alex finally says what was changed. Jordan has already worked it out and waits to hear it said aloud.",
      toneTarget: "quiet, exhausted",
      characterIds: ["demo-ch-alex", "demo-ch-jordan"],
      metrics: null,
      keyframes: [],
      modelAsset: null,
    },
  ],
};

/** The bundled PrevisSpec fixture each demo scene opens in the 3D scene editor. */
export const DEMO_SCENE_FIXTURE: Record<string, "office" | "kitchen"> = {
  "demo-scene-office": "office",
  "demo-scene-kitchen": "kitchen",
};
