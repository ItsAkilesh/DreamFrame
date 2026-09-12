// voices.ts
// Purpose: A small curated list of ElevenLabs "premade" voices, and a
//          deterministic (stateless) mapping from a character to one of
//          them. No Character.voiceId field exists or is needed — a given
//          character always hashes to the same voice everywhere, so nothing
//          has to be assigned, stored, or edited.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

// These ids are ElevenLabs' commonly-documented shared "Voice Library"
// premade voices. Availability can vary by account/plan and ids can be
// retired — if a voice in this list 404s against your ElevenLabs account,
// swap it here for one from your own Voice Library (copy its Voice ID).
export const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli" },
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

export function voiceIdForCharacter(characterId: string): string {
  const index = stableHash(characterId) % ELEVENLABS_VOICES.length;
  return ELEVENLABS_VOICES[index].id;
}
