// tts-client.ts
// Purpose: Browser-side helper for fetching a simulation turn's spoken-audio
//          from /api/tts, with an in-memory cache so scrubbing back over
//          already-played turns (or replaying the same saved run) never
//          re-requests audio already fetched this session — on top of the
//          route's own long-lived HTTP cache header.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

const audioUrlCache = new Map<string, Promise<string>>();

// The route's own synthesis budget is 10s (elevenlabs.ts); this gives it a
// little more before giving up client-side, so a slow-but-alive request
// still gets to finish rather than racing its own server-side timeout. Without
// this, a hung or badly-queued request (a busy dev server, a stalled
// connection) blocks the caller's .catch(fallback) from ever firing, and
// use-turn-playback has nothing else to advance the transcript with — it
// depends entirely on this promise settling one way or the other.
const CLIENT_TIMEOUT_MS = 15_000;

export interface TurnAudioContext {
  action?: string;
  voiceDirection?: string;
  sceneContext?: string;
}

function cacheKey(text: string, voiceId: string, context: TurnAudioContext): string {
  return `${voiceId}::${context.voiceDirection ?? ""}::${context.action ?? ""}::${context.sceneContext ?? ""}::${text}`;
}

// Resolves to a blob: URL playable directly as an <audio> element's src.
// Never throws synchronously — always a rejected promise, so callers can
// .catch() straight into a silent-playback fallback without a try/catch.
export function fetchTurnAudioUrl(
  text: string,
  voiceId: string,
  context: TurnAudioContext = {}
): Promise<string> {
  const key = cacheKey(text, voiceId, context);
  const cached = audioUrlCache.get(key);
  if (cached) return cached;

  const promise = fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voiceId, ...context }),
    signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
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
