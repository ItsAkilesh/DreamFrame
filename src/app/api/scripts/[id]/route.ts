// route.ts
// Purpose: PATCH a single Act, Scene, or Character on an existing script — the
//          write side of manual script editing (structuring is AI-only and
//          not always right; this lets a user correct it by hand).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { HydratedDocument, Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { ScriptDocument, ScriptModel } from "@/lib/models/Script";
import { actPatchFields, characterPatchFields, scenePatchFields } from "@/lib/scripts/patch";
import { ScriptPatchRequestSchema, type ScriptPatchRequest } from "@/lib/scripts/patch-schema";

type ScriptDoc = HydratedDocument<ScriptDocument>;

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return jsonError("Invalid script id", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = ScriptPatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid patch", 400);
  }
  const patch = parsed.data;

  await connectToDatabase();
  const script = await ScriptModel.findById(id);
  if (!script) {
    return jsonError("Script not found", 404);
  }

  const applied = applyPatch(script, patch);
  if (!applied) {
    return jsonError(`${patch.type} not found on this script`, 404);
  }

  await script.save();
  return NextResponse.json({ status: "ok" });
}

function applyPatch(script: ScriptDoc, patch: ScriptPatchRequest): boolean {
  if (patch.type === "scene") {
    const scene = script.scenes.id(patch.id);
    if (!scene) return false;
    Object.assign(scene, scenePatchFields(patch));
    return true;
  }

  if (patch.type === "act") {
    const act = script.acts.id(patch.id);
    if (!act) return false;
    Object.assign(act, actPatchFields(patch));
    return true;
  }

  const character = script.characters.id(patch.id);
  if (!character) return false;
  Object.assign(character, characterPatchFields(patch));
  return true;
}
