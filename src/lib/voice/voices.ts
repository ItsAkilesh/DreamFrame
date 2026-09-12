// voices.ts
// Purpose: Resolves which ElevenLabs voice a character speaks with. A
//          character can have an explicitly assigned Character.voiceId (set
//          via src/components/voice-picker.tsx, from the real voices on the
//          user's ElevenLabs account — see src/app/api/tts/voices/route.ts).
//          For a character nobody has assigned a voice to yet, this falls
//          back to a small curated list and a deterministic hash so
//          simulation playback always has *a* distinct-sounding voice
//          rather than needing every character configured first.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import type { Character } from "@/lib/types";

// These ids are ElevenLabs' commonly-documented shared "Voice Library"
// premade voices. Availability can vary by account/plan and ids can be
// retired — if a voice in this list 404s (or 402s — some older default
// voices are gated behind a paid tier on newer accounts) against your
// ElevenLabs account, swap it here for one from your own Voice Library
// (copy its Voice ID). Verified against a real account as of 2026-09-12;
// three of the originally-listed legacy ids (Rachel, Josh, Elli) returned
// 402 Payment Required on this account and were replaced.
export const ELEVENLABS_VOICES = [
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold" },
] as const;

// FNV-1a: cheap, dependency-free, and stable across processes/platforms —
// unlike Array.prototype.sort or object key iteration, this never depends on
// insertion order or engine internals, so the same character id always lands
// on the same voice on the server and in every browser.
function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// Only the fallback path — prefer resolveVoiceId(character) below, which
// checks the character's own assigned voiceId first.
export function voiceIdForCharacter(characterId: string): string {
  const index = stableHash(characterId) % ELEVENLABS_VOICES.length;
  return ELEVENLABS_VOICES[index].id;
}

export function resolveVoiceId(character: Pick<Character, "id" | "voiceId">): string {
  return character.voiceId ?? voiceIdForCharacter(character.id);
}
