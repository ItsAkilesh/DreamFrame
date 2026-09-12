// tts-client.ts
// Purpose: Browser-side helper for fetching a simulation turn's spoken-audio
//          from /api/tts, with an in-memory cache so scrubbing back over
//          already-played turns (or replaying the same saved run) never
//          re-requests audio already fetched this session — on top of the
//          route's own long-lived HTTP cache header.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

const audioUrlCache = new Map<string, Promise<string>>();

function cacheKey(text: string, voiceId: string): string {
  return `${voiceId}::${text}`;
}

// Resolves to a blob: URL playable directly as an <audio> element's src.
// Never throws synchronously — always a rejected promise, so callers can
// .catch() straight into a silent-playback fallback without a try/catch.
export function fetchTurnAudioUrl(text: string, voiceId: string): Promise<string> {
  const key = cacheKey(text, voiceId);
  const cached = audioUrlCache.get(key);
  if (cached) return cached;

  const promise = fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`TTS request failed with status ${response.status}`);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  });

  // A failed fetch must not poison the cache — a later retry (e.g. the
  // network recovering) should get a fresh attempt, not the same rejection.
  promise.catch(() => audioUrlCache.delete(key));

  audioUrlCache.set(key, promise);
  return promise;
}
