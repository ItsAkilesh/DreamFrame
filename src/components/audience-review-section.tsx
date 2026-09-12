// audience-review-section.tsx
// Purpose: Renders one SimulationRun's audience review — a critique card per
//          persona, then the moderator's synthesized summary and concrete
//          recommendations. Shared by DashboardPanel (the latest run) and
//          SimulationRunList (any past run), so both surfaces render a
//          review identically.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AudienceReview } from "@/lib/types";

export function AudienceReviewSection({ review }: { review: AudienceReview | null }) {
  if (!review) {
    return (
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-1.5 py-6 text-center text-xs">
        <Users className="size-4" />
        <span>No audience review for this run.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground px-0.5 text-xs font-medium tracking-wide uppercase">
        Audience review
      </p>

      <div className="flex flex-col gap-2">
        {review.critiques.map((critique) => (
          <Card key={critique.personaId} className="py-3">
            <CardHeader className="px-3">
              <CardTitle className="text-sm font-medium">{critique.personaName}</CardTitle>
            </CardHeader>
            <CardContent className="px-3">
              <p className="text-sm leading-relaxed">{critique.critique}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/30 py-3">
        <CardHeader className="px-3">
          <CardTitle className="text-sm font-medium">Moderator&apos;s synthesis</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 px-3">
          <p className="text-sm leading-relaxed">{review.summary}</p>
          {review.recommendations.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {review.recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
