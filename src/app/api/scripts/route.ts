// route.ts
// Purpose: Create a script by AI-structuring uploaded raw text, and fetch the
//          most recently created script (this app operates on a single
//          current script — no multi-project management yet).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Types } from "mongoose";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { parseScriptWithAI } from "@/lib/ai/scriptParser";
import { extractPdfText } from "@/lib/extract-pdf-text";
import { connectToDatabase } from "@/lib/mongodb";
import { ScriptModel } from "@/lib/models/Script";

const CHART_COLORS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];
const MAX_PDF_BYTES = 20 * 1024 * 1024; // 20MB

const CreateScriptRequestSchema = z.object({
  rawText: z.string().min(1, "Script text is required"),
});

async function resolveRawText(request: NextRequest): Promise<
  { ok: true; rawText: string } | { ok: false; message: string; status: number }
> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return { ok: false, message: "No file provided", status: 400 };
    }
    if (file.type !== "application/pdf") {
      return { ok: false, message: "Only PDF files are supported", status: 400 };
    }
    if (file.size > MAX_PDF_BYTES) {
      return { ok: false, message: "PDF is too large (max 20MB)", status: 400 };
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = await extractPdfText(bytes);
      if (!text.trim()) {
        return { ok: false, message: "Could not extract any text from that PDF", status: 400 };
      }
      return { ok: true, rawText: text };
    } catch (error) {
      console.error("PDF extraction failed:", error);
      return { ok: false, message: "Could not read that PDF", status: 400 };
    }
  }

  const body = await request.json().catch(() => null);
  const parsedRequest = CreateScriptRequestSchema.safeParse(body);
  if (!parsedRequest.success) {
    return {
      ok: false,
      message: parsedRequest.error.issues[0]?.message ?? "Invalid request",
      status: 400,
    };
  }

  return { ok: true, rawText: parsedRequest.data.rawText };
}

export async function POST(request: NextRequest) {
  const resolved = await resolveRawText(request);
  if (!resolved.ok) {
    return NextResponse.json(
      { status: "error", message: resolved.message },
      { status: resolved.status }
    );
  }
  const rawText = resolved.rawText;

  let structured;
  try {
    structured = await parseScriptWithAI(rawText);
  } catch (error) {
    console.error("Script parsing failed:", error);
    return NextResponse.json(
      { status: "error", message: "Failed to structure script" },
      { status: 502 }
    );
  }

  const actIdByOrder = new Map<number, Types.ObjectId>();
  const acts = structured.acts.map((act) => {
    const _id = new Types.ObjectId();
    actIdByOrder.set(act.order, _id);
    return { _id, title: act.title, order: act.order };
  });

  const characterIdByName = new Map<string, Types.ObjectId>();
  const characters = structured.characters.map((character, index) => {
    const _id = new Types.ObjectId();
    characterIdByName.set(character.name, _id);
    return {
      _id,
      name: character.name,
      motivation: character.motivation,
      traits: character.traits,
      baselineEmotion: character.baselineEmotion,
      color: `var(${CHART_COLORS[index % CHART_COLORS.length]})`,
    };
  });

  const scenes = structured.scenes.map((scene) => {
    const actId = actIdByOrder.get(scene.actOrder) ?? acts[0]?._id;
    const characterIds = scene.characterNames
      .map((name) => characterIdByName.get(name))
      .filter((id): id is Types.ObjectId => Boolean(id));

    return {
      actId,
      order: scene.order,
      title: scene.title,
      text: scene.text,
      toneTarget: scene.toneTarget,
      characterIds,
      metrics: null,
    };
  });

  await connectToDatabase();
  const script = await ScriptModel.create({
    title: structured.title,
    rawText,
    acts,
    scenes,
    characters,
  });

  return NextResponse.json({ status: "ok", scriptId: script._id.toString() }, { status: 201 });
}

export async function GET() {
  await connectToDatabase();
  const script = await ScriptModel.findOne().sort({ createdAt: -1 }).lean();

  if (!script) {
    return NextResponse.json({ status: "ok", script: null });
  }

  return NextResponse.json({ status: "ok", script });
}
