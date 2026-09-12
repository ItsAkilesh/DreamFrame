// route.ts
// Purpose: Thin server-side proxy for ElevenLabs text-to-speech — the only
//          place the ElevenLabs API key is used, so it never reaches the
//          browser. Called by src/lib/voice/tts-client.ts for each
//          simulation turn that needs to be spoken.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { synthesizeSpeech, TtsError } from "@/lib/voice/elevenlabs";

export const maxDuration = 30; // comfortably past synthesizeSpeech's own 10s budget

// Length-capped so a malformed/oversized request can't run up ElevenLabs
// cost — this route has no auth system to gate on (none exists anywhere in
// this app), so bounding the input is the one boundary check available.
const TtsRequestSchema = z.object({
  text: z.string().min(1).max(500),
  voiceId: z.string().min(1),
});

function jsonError(message: string, status: number) {
  return NextResponse.json({ status: "error", message }, { status });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = TtsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? "Invalid request", 400);
  }

  try {
    const audio = await synthesizeSpeech(parsed.data.text, parsed.data.voiceId);
    return new NextResponse(audio, {
      headers: {
        "Content-Type": "audio/mpeg",
        // text+voice is effectively content-addressed — safe for the browser
        // to cache indefinitely, which absorbs repeat playback (scrubbing,
        // re-watching a saved run) without a server-side cache store.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("TTS synthesis failed:", error);
    return jsonError(error instanceof TtsError ? error.message : "Speech synthesis failed", 502);
  }
}
