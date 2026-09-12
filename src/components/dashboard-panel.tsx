// dashboard-panel.tsx
// Purpose: Right-hand panel surfacing the simulation dashboard metrics for the
//          selected scene (tension curve + score cards). Renders an empty
//          state until a scene has been simulated at least once.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { AlertTriangle } from "lucide-react";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { DashboardMetrics, Scene } from "@/lib/types";

interface DashboardPanelProps {
  scene: Scene;
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

export function DashboardPanel({ scene }: DashboardPanelProps) {
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
    </div>
  );
}
