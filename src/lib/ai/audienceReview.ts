// audienceReview.ts
// Purpose: Runs a simulated scene performance past several distinct audience
//          "judge" personas — each critiquing from their own lens — then a
//          moderator pass that reconciles their disagreement into one usable
//          review with concrete recommendations. Separate from
//          judgeSimulation.ts's single numeric-score pass: this is meant to
//          keep working (and be useful) even when the previs/blocking side
//          of the app isn't, since it only needs a simulated transcript.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { openai, SIMULATION_MODEL } from "@/lib/openai";
import type { AudienceCritique, AudiencePersona, AudienceReview, Character } from "@/lib/types";

// Always active, on every script, alongside whatever custom personas the
// script's author has added (Script.audiencePersonas) — these live in code
// rather than the database because they're not meant to be edited, only
// added to.
export const DEFAULT_AUDIENCE_PERSONAS: AudiencePersona[] = [
  {
    id: "general",
    name: "General Audience",
    description:
      "A mainstream viewer with no special film background. Reacts to clarity, entertainment value, and whether the emotion actually lands — not craft for its own sake.",
  },
  {
    id: "genre-critic",
    name: "Genre Critic",
    description:
      "A critic steeped in the conventions of whatever genre this scene is working in. Judges it against what fans of that genre expect and have seen done better or worse elsewhere.",
  },
  {
    id: "festival-critic",
    name: "Festival/Arthouse Critic",
    description:
      "Values subtlety, restraint, and thematic depth. Skeptical of anything on-the-nose, over-explained, or emotionally manipulative. Cares about what's left unsaid.",
  },
  {
    id: "streaming-viewer",
    name: "Casual Streaming Viewer",
    description:
      "Low patience, second screen in hand. Judges pacing and hook above all — would they keep watching in the next 15 seconds, or scroll away?",
  },
];

const CritiqueResponseSchema = z.object({
  critique: z.string(),
});

const ModeratorResponseSchema = z.object({
  summary: z.string(),
  recommendations: z.array(z.string()).max(6),
});

export interface AudienceReviewOptions {
  scene: { title: string; text: string; toneTarget: string };
  characters: Character[];
  transcript: { characterId: string; text: string }[];
  // Combined list of active personas for this run — defaults + the script's
  // custom ones. Callers decide the mix; this module has no opinion on it.
  personas: AudiencePersona[];
}

function transcriptText(
  transcript: { characterId: string; text: string }[],
  characters: Character[]
): string {
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? id;
  return transcript.map((turn) => `${nameOf(turn.characterId)}: ${turn.text}`).join("\n");
}

async function critiqueAsPersona(
  persona: AudiencePersona,
  scene: AudienceReviewOptions["scene"],
  transcriptBlock: string
): Promise<AudienceCritique> {
  const response = await openai.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      {
        role: "system",
        content: `You are ${persona.name}, a specific kind of audience member watching a simulated scene performance. Your lens: ${persona.description}\n\nReact honestly, in character as this audience member — not as a script consultant. Be specific about what worked and what didn't for someone with your taste, in 3-5 sentences. Do not pretend to a different perspective than the one described.`,
      },
      {
        role: "user",
        content: `SCENE: ${scene.title}\nINTENDED TONE: ${scene.toneTarget || "unspecified"}\nORIGINAL SCENE TEXT: ${scene.text}\n\nSIMULATED TRANSCRIPT:\n${transcriptBlock}`,
      },
    ],
    text: { format: zodTextFormat(CritiqueResponseSchema, "audience_critique") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error(`Audience persona "${persona.name}" returned no structured output`);
  }

  return { personaId: persona.id, personaName: persona.name, critique: parsed.critique };
}

async function moderateCritiques(
  critiques: AudienceCritique[],
  scene: AudienceReviewOptions["scene"],
  transcriptBlock: string
): Promise<{ summary: string; recommendations: string[] }> {
  const critiquesBlock = critiques
    .map((c) => `${c.personaName}:\n${c.critique}`)
    .join("\n\n");

  const response = await openai.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      {
        role: "system",
        content:
          "You are a moderator reconciling several audience critiques of the same simulated scene into one useful review for the writer. Don't just summarize each critique in turn — weigh them against each other, note where they genuinely disagree and why (different audiences want different things), and land on a synthesized read of the scene. Then give concrete, actionable recommendations for revising the scene itself (dialogue, pacing, character behavior) — not vague praise or generic advice.",
      },
      {
        role: "user",
        content: `SCENE: ${scene.title}\nINTENDED TONE: ${scene.toneTarget || "unspecified"}\nORIGINAL SCENE TEXT: ${scene.text}\n\nSIMULATED TRANSCRIPT:\n${transcriptBlock}\n\nAUDIENCE CRITIQUES:\n${critiquesBlock}`,
      },
    ],
    text: { format: zodTextFormat(ModeratorResponseSchema, "moderated_review") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("Audience review moderator returned no structured output");
  }
  return parsed;
}

export async function runAudiencePanel(options: AudienceReviewOptions): Promise<AudienceReview> {
  const { scene, characters, transcript, personas } = options;
  const block = transcriptText(transcript, characters);

  // Independent critiques — nothing here depends on another persona's take,
  // so they run concurrently rather than one LLM round trip at a time.
  const critiques = await Promise.all(
    personas.map((persona) => critiqueAsPersona(persona, scene, block))
  );

  const { summary, recommendations } = await moderateCritiques(critiques, scene, block);

  return { critiques, summary, recommendations };
}
