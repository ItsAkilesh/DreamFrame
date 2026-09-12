// voices-client.ts
// Purpose: Browser-side fetch of the real voices on the user's ElevenLabs
//          account (GET /api/tts/voices), shared by every VoicePicker
//          instance on a page — the character roster renders one card per
//          character, and without this each card's picker would independently
//          re-request the same list.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

export interface VoiceOption {
  id: string;
  name: string;
  previewUrl: string | null;
}

let cached: Promise<VoiceOption[]> | null = null;

export function fetchVoiceList(): Promise<VoiceOption[]> {
  if (cached) return cached;

  const promise = fetch("/api/tts/voices")
    .then(async (response) => {
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to load voices");
      }
      const body = (await response.json()) as { voices: VoiceOption[] };
      return body.voices;
    });

  // A failed fetch shouldn't stick around as the cached result — the next
  // picker that opens (or a retry) should get a fresh attempt.
  promise.catch(() => { cached = null; });

  cached = promise;
  return promise;
}
