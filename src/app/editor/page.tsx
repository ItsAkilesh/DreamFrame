// page.tsx
// Purpose: Editor View entry point — resolves ?scriptId & ?sceneId to a
//          scene, builds a placeholder PrevisSpec via fromScene (see its
//          header for why this isn't real blocking), and renders the stage.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import Link from "next/link";

import { EditorView } from "@/components/editor-view";
import { getScriptById } from "@/lib/get-current-script";
import { fromScene } from "@/schema/fromScene";

export const dynamic = "force-dynamic";

interface EditorPageProps {
  searchParams: Promise<{ scriptId?: string; sceneId?: string }>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">{message}</p>
      <Link href="/" className="text-primary text-sm underline underline-offset-4">
        Back to Dashboard
      </Link>
    </div>
  );
}

export default async function EditorPage({ searchParams }: EditorPageProps) {
  const { scriptId, sceneId } = await searchParams;

  if (!scriptId || !sceneId) {
    return <ErrorState message="No scene selected. Open a scene from the Dashboard first." />;
  }

  const script = await getScriptById(scriptId);
  if (!script) {
    return <ErrorState message="That script no longer exists." />;
  }

  const scene = script.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    return <ErrorState message="That scene no longer exists." />;
  }

  try {
    const spec = fromScene(scene, script.characters);
    return <EditorView spec={spec} />;
  } catch (error) {
    console.error("fromScene failed:", error);
    return <ErrorState message="This scene has no characters assigned yet, so there's nothing to block." />;
  }
}
