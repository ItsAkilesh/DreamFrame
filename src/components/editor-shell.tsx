// editor-shell.tsx
// Purpose: Top-level editor layout — sidebar navigation, scene workspace, and
//          the simulation dashboard panel, wired together by selected-scene state.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardPanel } from "@/components/dashboard-panel";
import { SceneWorkspace } from "@/components/scene-workspace";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import type { ScriptData } from "@/lib/types";

interface EditorShellProps {
  script: ScriptData;
}

export function EditorShell({ script }: EditorShellProps) {
  const [selectedSceneId, setSelectedSceneId] = useState(script.scenes[0].id);
  const selectedScene =
    script.scenes.find((scene) => scene.id === selectedSceneId) ??
    script.scenes[0];
  const act = script.acts.find((a) => a.id === selectedScene.actId);

  return (
    <SidebarProvider>
      <AppSidebar
        script={script}
        selectedSceneId={selectedScene.id}
        onSelectScene={setSelectedSceneId}
      />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
            <span>{script.title}</span>
            <span>/</span>
            <span>{act?.title}</span>
            <span>/</span>
            <span className="text-foreground font-medium">
              {selectedScene.title}
            </span>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <SceneWorkspace
            scene={selectedScene}
            characters={script.characters}
          />
          <aside className="bg-sidebar w-80 shrink-0 overflow-y-auto border-l">
            <DashboardPanel scene={selectedScene} />
          </aside>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
