// get-current-script.ts
// Purpose: Server-side fetch of scripts, serialized from Mongoose's lean
//          document (ObjectIds) into plain ScriptData (string ids) the UI
//          components expect.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";
import type { Act, Character, DashboardMetrics, Scene, ScriptData } from "@/lib/types";

interface LeanId {
  _id: { toString(): string };
}

type LeanScript = {
  _id: { toString(): string };
  title: string;
  acts: (LeanId & { title: string; order: number })[];
  characters: (LeanId & {
    name: string;
    motivation: string;
    traits: string[];
    baselineEmotion: string;
    color: string;
  })[];
  scenes: (LeanId & {
    actId: { toString(): string };
    order: number;
    title: string;
    text: string;
    toneTarget: string;
    characterIds: { toString(): string }[];
    metrics: DashboardMetrics | null;
  })[];
};

function serialize(doc: LeanScript): ScriptData {
  const acts: Act[] = doc.acts.map((act) => ({
    id: act._id.toString(),
    title: act.title,
    order: act.order,
  }));

  const characters: Character[] = doc.characters.map((character) => ({
    id: character._id.toString(),
    name: character.name,
    motivation: character.motivation,
    traits: character.traits,
    baselineEmotion: character.baselineEmotion,
    color: character.color,
  }));

  const scenes: Scene[] = doc.scenes.map((scene) => ({
    id: scene._id.toString(),
    actId: scene.actId.toString(),
    order: scene.order,
    title: scene.title,
    text: scene.text,
    toneTarget: scene.toneTarget,
    characterIds: scene.characterIds.map((id) => id.toString()),
    metrics: scene.metrics,
  }));

  return { id: doc._id.toString(), title: doc.title, acts, characters, scenes };
}

export async function getCurrentScript(): Promise<ScriptData | null> {
  await connectToDatabase();
  const doc = (await ScriptModel.findOne().sort({ createdAt: -1 }).lean()) as LeanScript | null;
  return doc ? serialize(doc) : null;
}

export async function getScriptById(id: string): Promise<ScriptData | null> {
  await connectToDatabase();
  const doc = (await ScriptModel.findById(id).lean()) as LeanScript | null;
  return doc ? serialize(doc) : null;
}
