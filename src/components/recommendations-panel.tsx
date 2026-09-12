// recommendations-panel.tsx
// Purpose: "Make this scene better" panel — the actionable half of the
//          dashboard. The deterministic checks (src/recommend) run in the
//          browser on every render, so the panel always has something honest
//          to say with no API call and no database; the button sends the same
//          findings through the script-doctor pass, which rewrites them in a
//          script editor's language and adds a few craft notes of its own.
//          Detected and AI-authored items are badged differently on purpose.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Info,
  Lightbulb,
  OctagonAlert,
  Sparkles,
  Wand2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { latestRunForScene, runRecommendationChecks } from "@/recommend";
import type {
  Character,
  Recommendation,
  RecommendationPriority,
  Scene,
  SimulationRun,
} from "@/lib/types";

interface RecommendationsPanelProps {
  scriptId: string;
  scene: Scene;
  characters: Character[];
  simulationRuns: SimulationRun[];
}

const PRIORITY_ICON: Record<RecommendationPriority, typeof Info> = {
  high: OctagonAlert,
  medium: AlertTriangle,
  low: Info,
};

const PRIORITY_VARIANT: Record<RecommendationPriority, "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

function RecommendationCard({
  recommendation,
  characters,
}: {
  recommendation: Recommendation;
  characters: Character[];
}) {
  const Icon = PRIORITY_ICON[recommendation.priority];
  const involved = characters.filter((character) =>
    recommendation.characterIds.includes(character.id)
  );

  return (
    <Card className="gap-0 py-3">
      <CardContent className="flex flex-col gap-2 px-3">
        <div className="flex items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0" />
          <p className="text-sm leading-snug font-medium">{recommendation.title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <Badge
            variant={PRIORITY_VARIANT[recommendation.priority]}
            className="text-[10px] uppercase"
          >
            {recommendation.priority}
          </Badge>
          <Badge variant="outline" className="text-[10px] uppercase">
            {recommendation.category}
          </Badge>
          {recommendation.source === "ai" && (
            <Badge variant="ghost" className="gap-1 text-[10px] uppercase">
              <Sparkles className="size-3" />
              AI note
            </Badge>
          )}
        </div>

        {recommendation.detail && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {recommendation.detail}
          </p>
        )}

        {recommendation.quote && (
          <blockquote className="text-muted-foreground border-l-2 pl-2 text-xs italic">
            &ldquo;{recommendation.quote}&rdquo;
          </blockquote>
        )}

        {recommendation.fix && (
          <p className="flex items-start gap-1.5 text-xs leading-relaxed">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0" />
            <span>{recommendation.fix}</span>
          </p>
        )}

        {involved.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {involved.map((character) => (
              <span
                key={character.id}
                className="text-muted-foreground flex items-center gap-1 text-[10px]"
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: character.color }}
                />
                {character.name}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecommendationsPanel({
  scriptId,
  scene,
  characters,
  simulationRuns,
}: RecommendationsPanelProps) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const latestRun = useMemo(
    () => latestRunForScene(simulationRuns, scene.id),
    [simulationRuns, scene.id]
  );

  // Deterministic and free — recomputed from the scene as the user edits it,
  // so the panel is never stale and never empty-handed.
  const detected = useMemo(
    () =>
      runRecommendationChecks({
        scene: {
          id: scene.id,
          title: scene.title,
          text: scene.text,
          toneTarget: scene.toneTarget,
          characterIds: scene.characterIds,
        },
        characters,
        transcript: latestRun?.transcript ?? [],
        metrics: scene.metrics,
      }),
    [scene, characters, latestRun]
  );

  const saved = scene.recommendations;
  // The saved set goes stale the moment a newer take exists — the notes were
  // written about a transcript that is no longer the one on screen.
  const isSavedStale =
    saved !== null && latestRun !== null && saved.basedOnRunId !== latestRun.id;
  const showSaved = saved !== null && !isSavedStale;
  const items = showSaved ? saved.items : detected.items;
  const hidden = showSaved ? 0 : detected.totalCount - detected.items.length;

  async function generate() {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/scripts/${scriptId}/scenes/${scene.id}/recommendations`,
        { method: "POST" }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message ?? "Failed to generate recommendations");
      }
      // The panel reads scene.recommendations from server-rendered data, the
      // same way the dashboard reads metrics.
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to generate recommendations");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex flex-col gap-2">
        <Button size="sm" className="gap-2" onClick={generate} disabled={isGenerating}>
          <Wand2 className="size-4" />
          {isGenerating
            ? "Reading the scene…"
            : saved
              ? "Refresh recommendations"
              : "Get AI recommendations"}
        </Button>
        <p className="text-muted-foreground text-xs">
          {showSaved ? (
            <>
              Reviewed {new Date(saved.generatedAt).toLocaleString()}
              {saved.basedOnRunId ? " against the latest take." : "."}
            </>
          ) : isSavedStale ? (
            <>
              A newer simulation has run since these notes were written — showing
              the live checks instead.
            </>
          ) : (
            <>
              {detected.totalCount} issue{detected.totalCount === 1 ? "" : "s"} detected
              from the scene and its latest take. AI review adds craft notes and
              rewrites these as director&rsquo;s notes.
            </>
          )}
        </p>
      </div>

      {error && (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      )}

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Check className="text-muted-foreground size-5" />
          <p className="text-sm font-medium">Nothing flagged</p>
          <p className="text-muted-foreground text-xs">
            No structural problems detected on this scene. Run an AI review for
            craft notes the checks can&rsquo;t see.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((recommendation) => (
            <RecommendationCard
              key={recommendation.id}
              recommendation={recommendation}
              characters={characters}
            />
          ))}
          {hidden > 0 && (
            <p className="text-muted-foreground px-1 text-xs">
              and {hidden} lower-priority note{hidden === 1 ? "" : "s"} not shown
            </p>
          )}
        </div>
      )}
    </div>
  );
}
