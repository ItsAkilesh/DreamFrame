// page.tsx
// Purpose: Editor View entry point — resolves ?scriptId & ?sceneId to a
//          scene, builds a placeholder PrevisSpec via fromScene (see its
//          header for why this isn't real blocking), and renders the stage.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { EditorView } from "@/components/editor-view";
import { getScriptById } from "@/lib/get-current-script";
import { fromScene } from "@/schema/fromScene";
import { PrevisSpecZ } from "@/schema/previsSpec";
import kitchenFixture from "@/fixtures/kitchen_twohander.json";
import officeFixture from "@/fixtures/office_threehander.json";

// Hand-authored specs that need neither MongoDB nor an LLM. plan.md §13 wants
// the app to open with the database unreachable, and §15 wants a one-keystroke
// fallback scene on stage — this is both.
const FIXTURES: Record<string, unknown> = {
  kitchen: kitchenFixture,
  office: officeFixture,
};

export const dynamic = "force-dynamic";

interface EditorPageProps {
  searchParams: Promise<{ scriptId?: string; sceneId?: string; fixture?: string }>;
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-3 text-center">
      <p className="font-medium">{message}</p>
      <a href="/" className="text-primary text-sm underline underline-offset-4">
        Back to Dashboard
      </a>
    </div>
  );
}

export default async function EditorPage({ searchParams }: EditorPageProps) {
  const { scriptId, sceneId, fixture } = await searchParams;

  // ?fixture= short-circuits the database entirely.
  if (fixture) {
    const raw = FIXTURES[fixture];
    if (!raw) {
      return <ErrorState message={`No demo scene called "${fixture}". Try ?fixture=office.`} />;
    }
    const parsed = PrevisSpecZ.safeParse(raw);
    if (!parsed.success) {
      console.error("fixture failed to parse:", parsed.error.issues);
      return <ErrorState message="That demo scene no longer matches the schema." />;
    }
    return <EditorView spec={parsed.data} />;
  }

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
    const characterModels = Object.fromEntries(
      script.characters.map((c) => [c.id, c.modelAsset])
    );
    return <EditorView
        spec={spec}
        scriptId={scriptId}
        sceneId={sceneId}
        sceneModelAsset={scene.modelAsset}
        characterModels={characterModels}
      />;
  } catch (error) {
    console.error("fromScene failed:", error);
    return <ErrorState message="This scene has no characters assigned yet, so there's nothing to block." />;
  }
}
