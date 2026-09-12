// Script.ts
// Purpose: Mongoose schema for a script and its auto-structured Acts, Scenes,
//          and Characters (embedded — this app only ever loads a script's
//          full structure together, so subdocuments avoid needless joins).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Schema, model, models, type InferSchemaType } from "mongoose";

const CharacterModelAssetSchema = new Schema(
  {
    fileName: { type: String, required: true },
    format: { type: String, required: true },
    url: { type: String, required: true },
    uploadedAt: { type: Date, required: true },
    previewUrl: { type: String, default: null },
  },
  { _id: false }
);

const CharacterSchema = new Schema(
  {
    name: { type: String, required: true },
    motivation: { type: String, required: true },
    traits: { type: [String], default: [] },
    baselineEmotion: { type: String, required: true },
    color: { type: String, required: true },
    modelAsset: { type: CharacterModelAssetSchema, default: null },
  },
  { _id: true }
);

const DashboardMetricsSchema = new Schema(
  {
    arcCoherence: Number,
    characterConsistency: Number,
    chemistryStrength: Number,
    fragilityRisk: Number,
    engagement: Number,
    toneDrift: Number,
    tensionCurve: [Number],
  },
  { _id: false }
);

// A hand-placed pose for one character at one timestamp, authored in the
// Editor View's keyframe timeline. Stored on the scene so the track survives a
// reload; `id` is the client-generated key the timeline already uses, kept as-is
// so a save round-trip doesn't renumber the diamonds under the user's cursor.
const KeyframeSchema = new Schema(
  {
    id: { type: String, required: true },
    characterId: { type: String, required: true },
    time: { type: Number, required: true, min: 0 },
    position: { type: [Number], required: true },
    rotationY: { type: Number, default: 0 },
  },
  { _id: false }
);

const SceneSchema = new Schema(
  {
    actId: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    text: { type: String, required: true },
    toneTarget: { type: String, required: true },
    characterIds: { type: [Schema.Types.ObjectId], default: [] },
    metrics: { type: DashboardMetricsSchema, default: null },
    modelAsset: { type: CharacterModelAssetSchema, default: null },
    keyframes: { type: [KeyframeSchema], default: [] },
  },
  { _id: true }
);

const ActSchema = new Schema(
  {
    title: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: true }
);

const SimulationTurnSchema = new Schema(
  {
    characterId: { type: Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
    turnIndex: { type: Number, required: true },
    action: { type: String, default: "" },
    animationAssetId: { type: String, default: null },
  },
  { _id: false }
);

const SimulationRunSchema = new Schema(
  {
    sceneId: { type: Schema.Types.ObjectId, required: true },
    transcript: { type: [SimulationTurnSchema], default: [] },
  },
  { _id: true, timestamps: true }
);

const ScriptSchema = new Schema(
  {
    title: { type: String, required: true },
    rawText: { type: String, required: true },
    acts: { type: [ActSchema], default: [] },
    scenes: { type: [SceneSchema], default: [] },
    characters: { type: [CharacterSchema], default: [] },
    simulationRuns: { type: [SimulationRunSchema], default: [] },
  },
  { timestamps: true }
);

export type ScriptDocument = InferSchemaType<typeof ScriptSchema>;

export const ScriptModel = models.Script ?? model("Script", ScriptSchema);
