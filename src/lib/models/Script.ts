// Script.ts
// Purpose: Mongoose schema for a script and its auto-structured Acts, Scenes,
//          and Characters (embedded — this app only ever loads a script's
//          full structure together, so subdocuments avoid needless joins).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Schema, model, models, type InferSchemaType } from "mongoose";

const CharacterSchema = new Schema(
  {
    name: { type: String, required: true },
    motivation: { type: String, required: true },
    traits: { type: [String], default: [] },
    baselineEmotion: { type: String, required: true },
    color: { type: String, required: true },
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

const SceneSchema = new Schema(
  {
    actId: { type: Schema.Types.ObjectId, required: true },
    order: { type: Number, required: true },
    title: { type: String, required: true },
    text: { type: String, required: true },
    toneTarget: { type: String, required: true },
    characterIds: { type: [Schema.Types.ObjectId], default: [] },
    metrics: { type: DashboardMetricsSchema, default: null },
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

const ScriptSchema = new Schema(
  {
    title: { type: String, required: true },
    rawText: { type: String, required: true },
    acts: { type: [ActSchema], default: [] },
    scenes: { type: [SceneSchema], default: [] },
    characters: { type: [CharacterSchema], default: [] },
  },
  { timestamps: true }
);

export type ScriptDocument = InferSchemaType<typeof ScriptSchema>;

export const ScriptModel = models.Script ?? model("Script", ScriptSchema);
