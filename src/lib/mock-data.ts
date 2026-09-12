// mock-data.ts
// Purpose: Placeholder script/scene/character/metrics data for the editor shell
//          until script upload and the simulation engine are wired to real APIs.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import type { ScriptData } from "@/lib/types";

export const mockScript: ScriptData = {
  title: "Nightfall",
  acts: [
    { id: "act-1", title: "Act I — The Arrival", order: 1 },
    { id: "act-2", title: "Act II — The Reckoning", order: 2 },
  ],
  characters: [
    {
      id: "char-mara",
      name: "Mara",
      motivation: "Protect her brother's memory at any cost",
      traits: ["guarded", "sharp-tongued", "loyal"],
      baselineEmotion: "wary",
      color: "var(--chart-1)",
    },
    {
      id: "char-julian",
      name: "Julian",
      motivation: "Earn forgiveness he doesn't believe he deserves",
      traits: ["remorseful", "restless", "charming"],
      baselineEmotion: "anxious",
      color: "var(--chart-2)",
    },
    {
      id: "char-reyes",
      name: "Detective Reyes",
      motivation: "Close the case before it closes her career",
      traits: ["methodical", "tired", "quietly kind"],
      baselineEmotion: "neutral",
      color: "var(--chart-3)",
    },
  ],
  scenes: [
    {
      id: "scene-1",
      actId: "act-1",
      order: 1,
      title: "The Doorstep",
      text: "Mara opens the door to find Julian standing in the rain, three years late for the conversation they never had.",
      toneTarget: "tense, restrained",
      characterIds: ["char-mara", "char-julian"],
      metrics: {
        arcCoherence: 82,
        characterConsistency: 88,
        chemistryStrength: 74,
        fragilityRisk: 35,
        engagement: 79,
        toneDrift: 12,
        tensionCurve: [20, 35, 55, 48, 70],
      },
    },
    {
      id: "scene-2",
      actId: "act-1",
      order: 2,
      title: "Cold Coffee",
      text: "Reyes lays photographs across the kitchen table. Mara recognizes one of them immediately, and tries not to show it.",
      toneTarget: "quiet dread",
      characterIds: ["char-mara", "char-reyes"],
      metrics: {
        arcCoherence: 76,
        characterConsistency: 91,
        chemistryStrength: 61,
        fragilityRisk: 52,
        engagement: 71,
        toneDrift: 18,
        tensionCurve: [15, 25, 40, 60, 58],
      },
    },
    {
      id: "scene-3",
      actId: "act-2",
      order: 1,
      title: "What He Knew",
      text: "Julian finally says the thing he came to say. Mara has to decide whether three years is long enough to change what it means.",
      toneTarget: "raw, unresolved",
      characterIds: ["char-mara", "char-julian"],
      metrics: null,
    },
  ],
};
