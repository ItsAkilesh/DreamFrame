// editor-shell.tsx
// Purpose: Top-level editor layout — sidebar navigation, scene workspace, and
//          the simulation dashboard panel, wired together by selected-scene state.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPanel } from "@/components/dashboard-panel";
import { ScriptUploadDialog } from "@/components/script-upload-dialog";
import { SceneWorkspace } from "@/components/scene-workspace";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ScriptData } from "@/lib/types";

interface EditorShellProps {
  script: ScriptData | null;
}

export function EditorShell({ script }: EditorShellProps) {
  const firstSceneId = script?.scenes[0]?.id ?? null;
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    firstSceneId
  );

  const activeSceneId = selectedSceneId ?? firstSceneId;
  const selectedScene =
    script?.scenes.find((scene) => scene.id === activeSceneId) ?? null;
  const act = script?.acts.find((a) => a.id === selectedScene?.actId);

  return (
    <SidebarProvider>
      <AppSidebar
        script={script}
        selectedSceneId={activeSceneId}
        onSelectScene={setSelectedSceneId}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {script && selectedScene ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
              <span>{script.title}</span>
              <span>/</span>
              <span>{act?.title}</span>
              <span>/</span>
              <span className="text-foreground font-medium">
                {selectedScene.title}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-sm">DreamFrame</span>
          )}
        </header>

        {!script || !selectedScene ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <div>
              <p className="font-medium">No script uploaded yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Upload a script and an AI agent will structure it into Acts,
                Scenes, and Characters.
              </p>
            </div>
            <ScriptUploadDialog />
          </div>
        ) : (
          <div className="flex flex-1 overflow-hidden">
            <SceneWorkspace
              scriptId={script.id}
              scene={selectedScene}
              characters={script.characters}
            />
            <aside className="bg-sidebar w-80 shrink-0 overflow-y-auto border-l">
              <DashboardPanel scene={selectedScene} />
            </aside>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
