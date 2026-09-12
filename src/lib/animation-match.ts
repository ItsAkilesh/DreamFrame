// animation-match.ts
// Purpose: Loads the asset library's labeled Mixamo animation clips — labels
//          come from scripts/label-animations.mjs, terse present-tense names
//          like "Crossing Arms" or "Walking Forward". Only labeled clips are
//          eligible: most of the ~2,400-file library isn't labeled yet, and
//          there's nothing to offer a picker for an unlabeled hash filename.
//
//          There used to also be a free-text-description -> best-guess-label
//          matcher here; it's gone. simulateConversation.ts now has each
//          agent pick a clip name directly from this list via a strict-schema
//          enum (structured outputs), so the model can only ever choose a
//          clip that genuinely exists — no matching, no false positives, no
//          need for one.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { listLibraryAssets, type LibraryAsset } from "@/lib/asset-library";

// listLibraryAssets falls back to "Unnamed motion · <hash prefix>" for any
// animation names.json hasn't labeled yet (see its own header) — nothing
// meaningful to offer a picker for those yet.
function isLabeled(asset: LibraryAsset): boolean {
  return !asset.name.startsWith("Unnamed motion");
}

// listLibraryAssets("animation") re-scans every file in the folder (~2,400+
// and growing) plus an FBX-header version check per file — cheap for one
// interactive browse, not something to re-pay per simulation turn. Callers
// generating a whole run (many turns) should load this once and reuse the
// result across every agent's decision.
export async function loadLabeledAnimations(): Promise<LibraryAsset[]> {
  return (await listLibraryAssets("animation")).filter(isLabeled);
}
