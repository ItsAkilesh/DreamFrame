// route.ts
// Purpose: Create a custom audience persona on a script — on top of the
//          always-active defaults in DEFAULT_AUDIENCE_PERSONAS, which live in
//          code and are never stored here.
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

const CreatePersonaSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return jsonError("Invalid script id", 400);
  }

  const body = await request.json().catch(() => null);
  const parsed = CreatePersonaSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid persona", 400);
  }

  await connectToDatabase();
  const script = await ScriptModel.findById(id);
  if (!script) {
    return jsonError("Script not found", 404);
  }

  script.audiencePersonas.push(parsed.data);
  await script.save();

  const created = script.audiencePersonas[script.audiencePersonas.length - 1];
  return NextResponse.json(
    {
      status: "ok",
      persona: { id: created._id.toString(), name: created.name, description: created.description },
    },
    { status: 201 }
  );
}
