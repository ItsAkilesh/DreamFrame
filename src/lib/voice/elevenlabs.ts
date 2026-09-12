// elevenlabs.ts
// Purpose: Server-only ElevenLabs text-to-speech client. The API key never
//          reaches the browser — src/app/api/tts/route.ts is the only
//          caller, proxying synthesis requests the same way src/lib/openai.ts
//          proxies OpenAI. Plain fetch, no SDK: this is one REST call, and
//          adding a dependency for it would just be a CVE surface for
//          nothing a native fetch can't already do.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Same reasoning as src/lib/openai.ts's getOpenAIApiKey(): prefer .env.local
// over the ambient process env so a stale OS-level env var can't silently
// shadow the real local key.
function getElevenLabsApiKey(): string {
  const envLocalPath = join(process.cwd(), ".env.local");
  if (existsSync(envLocalPath)) {
    const match = readFileSync(envLocalPath, "utf8").match(
      /^ELEVENLABS_API_KEY=["']?(.+?)["']?$/m
    );
    if (match?.[1]) {
      return match[1];
    }
  }

  if (process.env.ELEVENLABS_API_KEY) {
    return process.env.ELEVENLABS_API_KEY;
  }

  throw new Error("ELEVENLABS_API_KEY is not set in the environment");
}

// eleven_turbo_v2_5: ElevenLabs' low-latency model — a live simulation turn
// needs its audio back quickly, not the highest-fidelity render.
export const ELEVENLABS_MODEL_ID = "eleven_turbo_v2_5";

const SYNTHESIS_TIMEOUT_MS = 10_000; // plan.md §8's TTS budget

export class TtsError extends Error {}

// Throws TtsError on any failure (bad key, rate limit, timeout, unknown
// voice id) — callers are expected to catch this and degrade to a silent
// caption rather than let a voice outage take down playback.
export async function synthesizeSpeech(text: string, voiceId: string): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": getElevenLabsApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({ text, model_id: ELEVENLABS_MODEL_ID }),
      signal: AbortSignal.timeout(SYNTHESIS_TIMEOUT_MS),
    });
  } catch (error) {
    throw new TtsError(error instanceof Error && error.name === "TimeoutError" ? "ElevenLabs request timed out" : "ElevenLabs request failed");
  }

  if (!response.ok) {
    // Body may carry ElevenLabs' own error detail; never forward it verbatim
    // to the client (OWASP A05 — don't leak provider internals), just log it.
    console.error("ElevenLabs TTS failed:", response.status, await response.text().catch(() => ""));
    throw new TtsError(`ElevenLabs TTS failed with status ${response.status}`);
  }

  return response.arrayBuffer();
}
