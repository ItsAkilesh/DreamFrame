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
  return <EditorShell script={script} />;
}
