// route.ts
// Purpose: Edit or remove one custom audience persona on a script. The
//          hardcoded defaults (DEFAULT_AUDIENCE_PERSONAS) never reach this
//          route — they aren't stored, so there's nothing here to edit or
//          delete for them.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

const PatchPersonaSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().min(1).max(500).optional(),
});

async function loadPersona(scriptId: string, personaId: string) {
  if (!Types.ObjectId.isValid(scriptId) || !Types.ObjectId.isValid(personaId)) {
    return { error: jsonError("Invalid id", 400) } as const;
  }

  await connectToDatabase();
  const script = await ScriptModel.findById(scriptId);
  if (!script) {
    return { error: jsonError("Script not found", 404) } as const;
  }

  const persona = script.audiencePersonas.id(personaId);
  if (!persona) {
    return { error: jsonError("Persona not found", 404) } as const;
  }

  return { script, persona } as const;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; personaId: string }> }
) {
  const { id, personaId } = await params;
  const loaded = await loadPersona(id, personaId);
  if ("error" in loaded) return loaded.error;
  const { script, persona } = loaded;

  const body = await request.json().catch(() => null);
  const parsed = PatchPersonaSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid patch", 400);
  }

  Object.assign(persona, parsed.data);
  await script.save();

  return NextResponse.json({ status: "ok" });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; personaId: string }> }
) {
  const { id, personaId } = await params;
  const loaded = await loadPersona(id, personaId);
  if ("error" in loaded) return loaded.error;
  const { script, persona } = loaded;

  persona.deleteOne();
  await script.save();

  return NextResponse.json({ status: "ok" });
}
