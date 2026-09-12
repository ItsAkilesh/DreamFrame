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

import { buildExpressiveSpeechText, type EmotionalDeliveryContext } from "@/lib/voice/emotional-delivery";

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

// Eleven v3 is the expressive model: unlike Turbo v2.5, it understands the
// bracketed performance directions built above and has substantially more
// emotional range. Audio is prefetched while the preceding line plays, so
// performance quality is worth the modest latency increase here.
export const ELEVENLABS_MODEL_ID = "eleven_v3";

const SYNTHESIS_TIMEOUT_MS = 10_000; // plan.md §8's TTS budget

export class TtsError extends Error {}

// Throws TtsError on any failure (bad key, rate limit, timeout, unknown
// voice id) — callers are expected to catch this and degrade to a silent
// caption rather than let a voice outage take down playback.
export async function synthesizeSpeech(
  text: string,
  voiceId: string,
  context: EmotionalDeliveryContext = {}
): Promise<ArrayBuffer> {
  let response: Response;
  try {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": getElevenLabsApiKey(),
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: buildExpressiveSpeechText(text, context),
        model_id: ELEVENLABS_MODEL_ID,
        // Lower stability allows natural timing and emotional variation;
        // style exaggeration gives stage directions noticeable influence
        // without pushing every line into a caricature.
        voice_settings: {
          stability: 0.35,
          similarity_boost: 0.78,
          style: 0.55,
          use_speaker_boost: true,
        },
      }),
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

export interface ElevenLabsVoice {
  id: string;
  name: string;
  // ElevenLabs' own short sample clip for this voice, when it has one — a
  // public, directly-playable URL (no API key needed to fetch it). Voices
  // without one (e.g. some custom/cloned voices) fall back to an on-demand
  // synthesized preview in the picker UI.
  previewUrl: string | null;
}

interface ElevenLabsVoicesResponse {
  voices?: { voice_id: string; name: string; preview_url?: string | null }[];
}

const VOICES_LIST_TIMEOUT_MS = 10_000;
const VOICES_CACHE_TTL_MS = 5 * 60 * 1000; // voices change rarely; avoid refetching on every dialog open

let voicesCache: { voices: ElevenLabsVoice[]; fetchedAt: number } | null = null;

// The real voices available on the user's own ElevenLabs account — what
// src/components/voice-picker.tsx lists, so an assigned voice id is always
// one that actually works, unlike the hardcoded fallback list in
// src/lib/voice/voices.ts.
export async function listVoices(): Promise<ElevenLabsVoice[]> {
  if (voicesCache && Date.now() - voicesCache.fetchedAt < VOICES_CACHE_TTL_MS) {
    return voicesCache.voices;
  }

  let response: Response;
  try {
    response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": getElevenLabsApiKey() },
      signal: AbortSignal.timeout(VOICES_LIST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new TtsError(error instanceof Error && error.name === "TimeoutError" ? "ElevenLabs request timed out" : "ElevenLabs request failed");
  }

  if (!response.ok) {
    console.error("ElevenLabs list voices failed:", response.status, await response.text().catch(() => ""));
    throw new TtsError(`ElevenLabs list voices failed with status ${response.status}`);
  }

  const body = (await response.json()) as ElevenLabsVoicesResponse;
  const voices = (body.voices ?? []).map((voice) => ({
    id: voice.voice_id,
    name: voice.name,
    previewUrl: voice.preview_url ?? null,
  }));

  voicesCache = { voices, fetchedAt: Date.now() };
  return voices;
}
