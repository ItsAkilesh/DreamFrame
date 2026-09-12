// route.ts
// Purpose: Lists the voices actually available on the user's ElevenLabs
//          account, for the character roster's voice picker
//          (src/components/voice-picker.tsx) — the API key stays server-side,
//          same as src/app/api/tts/route.ts.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextResponse } from "next/server";

import { listVoices, TtsError } from "@/lib/voice/elevenlabs";

export async function GET() {
  try {
    const voices = await listVoices();
    return NextResponse.json({ voices });
  } catch (error) {
    console.error("Failed to list ElevenLabs voices:", error);
    return NextResponse.json(
      { status: "error", message: error instanceof TtsError ? error.message : "Failed to list voices" },
      { status: 502 }
    );
  }
}
