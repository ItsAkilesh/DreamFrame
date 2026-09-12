// dashboard-panel.tsx
// Purpose: Right-hand panel surfacing the simulation dashboard metrics for the
//          selected scene (tension curve + score cards). Renders an empty
//          state until a scene has been simulated at least once.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { AlertTriangle } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { AudienceReviewSection } from "@/components/audience-review-section";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { computeSceneComposition, countTensionPeaks } from "@/lib/scene-composition";
import type { Character, DashboardMetrics, Scene, SimulationRun } from "@/lib/types";

interface DashboardPanelProps {
  scene: Scene;
  simulationRuns: SimulationRun[];
  characters: Character[];
}

const tensionChartConfig = {
  tension: {
    label: "Tension",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

function MetricCard({
  label,
  value,
  suffix = "",
  flagAbove,
}: {
  label: string;
  value: number;
  suffix?: string;
  flagAbove?: number;
}) {
  const isFlagged = flagAbove !== undefined && value >= flagAbove;

  return (
    <Card className="gap-1 py-3">
      <CardContent className="flex flex-col gap-1 px-3">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span
          className={
            "flex items-center gap-1 text-xl font-semibold tabular-nums" +
            (isFlagged ? " text-destructive" : "")
          }
        >
          {isFlagged && <AlertTriangle className="size-4" />}
          {value}
          {suffix}
        </span>
      </CardContent>
    </Card>
  );
}

function TensionCurveCard({ metrics }: { metrics: DashboardMetrics }) {
  const data = metrics.tensionCurve.map((value, index) => ({
    beat: `Beat ${index + 1}`,
    tension: value,
  }));

  return (
    <Card className="py-3">
      <CardHeader className="px-3">
        <CardTitle className="text-sm font-medium">
          Emotional Tension Curve
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3">
        <ChartContainer config={tensionChartConfig} className="h-40 w-full">
          <LineChart data={data} margin={{ left: -20, right: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="beat"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value: string) => value.replace("Beat ", "")}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line
              dataKey="tension"
              type="monotone"
              stroke="var(--color-tension)"
              strokeWidth={2}
              dot={{ fill: "var(--color-tension)" }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-1 py-3">
      <CardContent className="flex flex-col gap-1 px-3">
        <span className="text-muted-foreground text-xs">{label}</span>
        <span className="text-xl font-semibold tabular-nums">{value}</span>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `~${minutes}m ${remainder}s`;
}

// Deterministic, computed straight from the transcript — not judged by an
// LLM. Same reasoning as the previs analyzer elsewhere in this app: a
// number derived from the actual data is worth more than another plausible
// score, and it costs nothing extra to produce.
function SceneCompositionSection({
  transcript,
  characters,
  tensionCurve,
}: {
  transcript: SimulationRun["transcript"];
  characters: Character[];
  tensionCurve: number[];
}) {
  const composition = computeSceneComposition(transcript, characters);
  const peaks = countTensionPeaks(tensionCurve);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground px-0.5 text-xs font-medium tracking-wide uppercase">
        Scene composition
      </p>
      <div className="grid grid-cols-3 gap-2">
        <InfoTile label="Est. runtime" value={formatDuration(composition.estimatedRuntimeSeconds)} />
        <InfoTile label="Tension peaks" value={String(peaks)} />
        <InfoTile
          label="Longest run"
          value={
            composition.longestMonologue
              ? `${composition.longestMonologue.turns} lines`
              : "—"
          }
        />
      </div>

      {composition.dialogueBalance.length > 0 && (
        <Card className="py-3">
          <CardHeader className="px-3">
            <CardTitle className="text-sm font-medium">Dialogue balance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 px-3">
            {composition.dialogueBalance.map((share) => (
              <div key={share.characterId} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: share.color }}
                    />
                    {share.name}
                  </span>
                  <span className="text-muted-foreground tabular-nums">{share.percentage}%</span>
                </div>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${share.percentage}%`, backgroundColor: share.color }}
                  />
                </div>
              </div>
            ))}
            {composition.longestMonologue && composition.longestMonologue.turns >= 3 && (
              <Badge variant="secondary" className="mt-1 w-fit gap-1 text-[10px]">
                <AlertTriangle className="size-3" />
                {composition.longestMonologue.name} carries {composition.longestMonologue.turns} lines in a row
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function DashboardPanel({ scene, simulationRuns, characters }: DashboardPanelProps) {
  const { metrics } = scene;

  if (!metrics) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm font-medium">No simulation yet</p>
        <p className="text-muted-foreground text-xs">
          Run a Branch Impact Simulation on this scene to see arc, chemistry,
          and risk metrics here.
        </p>
      </div>
    );
  }

  const latestRun = simulationRuns
    .filter((run) => run.sceneId === scene.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;

  return (
    <div className="flex flex-col gap-3 p-3">
      <TensionCurveCard metrics={metrics} />
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Arc Coherence" value={metrics.arcCoherence} suffix="%" />
        <MetricCard
          label="Character Consistency"
          value={metrics.characterConsistency}
          suffix="%"
        />
        <MetricCard
          label="Chemistry Strength"
          value={metrics.chemistryStrength}
          suffix="%"
        />
        <MetricCard label="Engagement" value={metrics.engagement} suffix="%" />
        <MetricCard label="Tone Drift" value={metrics.toneDrift} suffix="%" flagAbove={40} />
        <MetricCard
          label="Fragility Risk"
          value={metrics.fragilityRisk}
          suffix="%"
          flagAbove={50}
        />
      </div>

      {latestRun && (
        <SceneCompositionSection
          transcript={latestRun.transcript}
          characters={characters}
          tensionCurve={metrics.tensionCurve}
        />
      )}

      {latestRun && (
        <>
          <Separator />
          <AudienceReviewSection review={latestRun.audienceReview} />
        </>
      )}
    </div>
  );
}
