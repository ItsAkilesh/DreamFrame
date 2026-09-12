// page.tsx
// Purpose: Default editor view — loads the current script from MongoDB and
//          renders the EditorShell (or its empty/upload state if none exists).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { EditorShell } from "@/components/editor-shell";
import { getCurrentScript } from "@/lib/get-current-script";

export const dynamic = "force-dynamic";

export default async function Home() {
  const script = await getCurrentScript();
  // Remount on script change (including null -> a script, or script -> a
  // different script) so EditorShell's internal selected-scene state can't
  // go stale and point at a scene from a previously loaded script.
  return <EditorShell key={script?.id ?? "none"} script={script} />;
}
