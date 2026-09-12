// get-current-script.ts
// Purpose: Server-side fetch of scripts, serialized from Mongoose's lean
//          document (ObjectIds) into plain ScriptData (string ids) the UI
//          components expect.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";
import type {
  Act,
  AudiencePersona,
  AudienceReview,
  Character,
  DashboardMetrics,
  Scene,
  SceneKeyframe,
  ScriptData,
  SimulationRun,
} from "@/lib/types";

interface LeanId {
  _id: { toString(): string };
}

interface LeanModelAsset {
  fileName: string;
  format: string;
  url: string;
  uploadedAt: Date;
  previewUrl: string | null;
}

function serializeModelAsset(asset: LeanModelAsset | null): Scene["modelAsset"] {
  return asset ? { ...asset, uploadedAt: asset.uploadedAt.toISOString() } : null;
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
    modelAsset: LeanModelAsset | null;
  })[];
  scenes: (LeanId & {
    actId: { toString(): string };
    order: number;
    title: string;
    text: string;
    toneTarget: string;
    characterIds: { toString(): string }[];
    metrics: DashboardMetrics | null;
    modelAsset: LeanModelAsset | null;
    keyframes?: SceneKeyframe[];
  })[];
  simulationRuns: (LeanId & {
    sceneId: { toString(): string };
    createdAt: Date;
    transcript: {
      characterId: { toString(): string };
      text: string;
      turnIndex: number;
      action: string;
      animationAssetId: string | null;
    }[];
    audienceReview?: AudienceReview | null;
  })[];
  audiencePersonas?: (LeanId & { name: string; description: string })[];
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
    modelAsset: serializeModelAsset(character.modelAsset),
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
    modelAsset: serializeModelAsset(scene.modelAsset),
    // Plain numbers already; the [] guard covers scenes stored before
    // keyframes existed.
    keyframes: (scene.keyframes ?? []).map((k) => ({
      id: k.id,
      characterId: k.characterId,
      time: k.time,
      position: [k.position[0], k.position[1], k.position[2]] as [number, number, number],
      rotationY: k.rotationY,
    })),
  }));

  const simulationRuns: SimulationRun[] = (doc.simulationRuns ?? []).map((run) => ({
    id: run._id.toString(),
    sceneId: run.sceneId.toString(),
    createdAt: run.createdAt.toISOString(),
    transcript: run.transcript.map((turn) => ({
      characterId: turn.characterId.toString(),
      text: turn.text,
      turnIndex: turn.turnIndex,
      action: turn.action,
      animationAssetId: turn.animationAssetId,
    })),
    audienceReview: run.audienceReview ?? null,
  }));

  const audiencePersonas: AudiencePersona[] = (doc.audiencePersonas ?? []).map((persona) => ({
    id: persona._id.toString(),
    name: persona.name,
    description: persona.description,
  }));

  return {
    id: doc._id.toString(),
    title: doc.title,
    acts,
    characters,
    scenes,
    simulationRuns,
    audiencePersonas,
  };
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

export interface ScriptSummary {
  id: string;
  title: string;
}

export async function getAllScripts(): Promise<ScriptSummary[]> {
  await connectToDatabase();
  const docs = (await ScriptModel.find()
    .select({ title: 1 })
    .sort({ createdAt: -1 })
    .lean()) as { _id: { toString(): string }; title: string }[];
  return docs.map((doc) => ({ id: doc._id.toString(), title: doc.title }));
}
