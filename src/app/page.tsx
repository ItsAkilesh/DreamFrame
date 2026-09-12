// page.tsx
// Purpose: Default editor view — loads a script from MongoDB (the one named
//          by ?scriptId, or the most recent if omitted) and renders the
//          EditorShell, along with the full script list for the sidebar's
//          switcher.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { EditorShell } from "@/components/editor-shell";
import { getAllScripts, getCurrentScript, getScriptById } from "@/lib/get-current-script";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams: Promise<{ scriptId?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const { scriptId } = await searchParams;

  const [script, allScripts] = await Promise.all([
    scriptId ? getScriptById(scriptId) : getCurrentScript(),
    getAllScripts(),
  ]);

  // Remount on script change (including null -> a script, or script -> a
  // different script) so EditorShell's internal selected-scene state can't
  // go stale and point at a scene from a previously loaded script.
  return <EditorShell key={script?.id ?? "none"} script={script} allScripts={allScripts} />;
}
