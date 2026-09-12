// page.tsx
// Purpose: Default editor view — renders the EditorShell against mock script data
//          until script upload and the simulation engine are wired to real APIs.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { EditorShell } from "@/components/editor-shell";
import { mockScript } from "@/lib/mock-data";

export default function Home() {
  return <EditorShell script={mockScript} />;
}
