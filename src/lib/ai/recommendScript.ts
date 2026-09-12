// recommendScript.ts
// Purpose: The script-doctor pass. Two jobs in one structured-output call:
//          (1) rewrite each deterministically detected finding's wording into
//          the concrete note a script editor would actually give — the same
//          two-stage shape as the previs analyzer's note rewriting (plan.md
//          §7.2), and (2) add a small number of craft recommendations of its
//          own, which the UI labels as AI opinion rather than detection.
//
//          The invariant that makes this defensible: the model can never
//          create, delete, or reclassify a detected finding. Rewrites are
//          matched back by id, unknown ids are dropped, and a missing or
//          failed rewrite ships the deterministic wording unchanged. Its own
//          notes arrive in a separate field, capped, and must quote the scene
//          or transcript they're about.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { gemini, SIMULATION_MODEL } from "@/lib/gemini";
import type {
  Character,
  DashboardMetrics,
  Recommendation,
  SimulationTurn,
} from "@/lib/types";

// Enough to be worth reading, few enough that the panel stays scannable.
const MAX_AI_NOTES = 3;

const RewrittenNoteSchema = z.object({
  id: z.string(),
  detail: z.string(),
  fix: z.string(),
});

const CraftNoteSchema = z.object({
  category: z.enum(["dialogue", "pacing", "character", "tone", "structure"]),
  priority: z.enum(["high", "medium", "low"]),
  title: z.string(),
  detail: z.string(),
  fix: z.string(),
  // The line or phrase the note is about; "" when it's about the scene as a
  // whole. Grounds the note in text that actually exists.
  quote: z.string(),
  // Resolved back to ids by name here — the model never sees an id, so it
  // can't invent one.
  characterNames: z.array(z.string()),
});

const ScriptDoctorResponseSchema = z.object({
  rewritten: z.array(RewrittenNoteSchema),
  additional: z.array(CraftNoteSchema).max(MAX_AI_NOTES),
});

const SYSTEM_PROMPT = `You are a script editor giving notes to the writer, in the plainest language that still says something specific.

You are given (a) issues already detected in a scene by deterministic analysis, and (b) the scene itself.

For "rewritten": return one entry per detected issue, keyed by the id you were given.
- Rewrite "detail" as what the audience will actually experience, in one or two sentences. No metrics-speak, no percentages unless the number is the point.
- Rewrite "fix" as one concrete change the writer can make today — name the character, the line, or the beat. Never "consider adding more tension".
- Do not add issues. Do not remove issues. Do not change what an issue is about, and never soften a detected problem into an optional idea.

For "additional": up to ${MAX_AI_NOTES} notes of your own about craft the analysis cannot detect — a line that states what should be implied, a want that never collides with another want, an exit the scene hasn't earned.
- Every one must quote the exact words from the scene text or transcript it's about in "quote" (use "" only for a note about the scene as a whole).
- Do not restate anything already covered by a detected issue.
- "characterNames" must use names exactly as given, and may be empty.
- Fewer, sharper notes beat filling the quota.`;

export interface RecommendScriptOptions {
  scene: { title: string; text: string; toneTarget: string };
  characters: Character[];
  transcript: SimulationTurn[];
  metrics: DashboardMetrics | null;
  // The deterministic findings, already sorted and capped by src/recommend.
  detected: Recommendation[];
}

function buildPrompt({
  scene,
  characters,
  transcript,
  metrics,
  detected,
}: RecommendScriptOptions): string {
  const nameOf = (id: string) => characters.find((c) => c.id === id)?.name ?? id;

  const castText = characters
    .map(
      (character) =>
        `- ${character.name}: wants ${character.motivation || "(unstated)"}; baseline ${
          character.baselineEmotion || "(unstated)"
        }${character.traits.length > 0 ? `; traits ${character.traits.join(", ")}` : ""}`
    )
    .join("\n");

  const transcriptText =
    transcript.length > 0
      ? transcript.map((turn) => `${nameOf(turn.characterId)}: ${turn.text}`).join("\n")
      : "(this scene has never been simulated)";

  const metricsText = metrics
    ? `arc coherence ${metrics.arcCoherence}, character consistency ${metrics.characterConsistency}, chemistry ${metrics.chemistryStrength}, engagement ${metrics.engagement}, tone drift ${metrics.toneDrift}, fragility risk ${metrics.fragilityRisk}`
    : "(not scored yet)";

  const detectedText = detected
    .map(
      (item) =>
        `id: ${item.id}\ncode: ${item.code}\ntitle: ${item.title}\ndetail: ${item.detail}\nfix: ${item.fix}`
    )
    .join("\n\n");

  return `SCENE: ${scene.title}
INTENDED TONE: ${scene.toneTarget || "unspecified"}
SCENE TEXT: ${scene.text}

CAST:
${castText}

LATEST SIMULATED TAKE:
${transcriptText}

JUDGE SCORES (0-100): ${metricsText}

DETECTED ISSUES TO REWRITE:
${detectedText || "(none)"}`;
}

export async function recommendScript(
  options: RecommendScriptOptions
): Promise<Recommendation[]> {
  const response = await gemini.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildPrompt(options) },
    ],
    text: { format: zodTextFormat(ScriptDoctorResponseSchema, "script_recommendations") },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("Script doctor returned no structured output");
  }

  return mergeRecommendations(options, parsed);
}

// Exported for testing: the merge is where the "the model can't invent or drop
// a finding" guarantee actually lives, so it's worth covering directly.
export function mergeRecommendations(
  options: RecommendScriptOptions,
  parsed: z.infer<typeof ScriptDoctorResponseSchema>
): Recommendation[] {
  const rewrites = new Map(parsed.rewritten.map((note) => [note.id, note]));

  // One entry per detected finding, always — a rewrite only ever replaces the
  // wording of a finding that already exists.
  const polished: Recommendation[] = options.detected.map((item) => {
    const rewrite = rewrites.get(item.id);
    if (!rewrite) return item;
    return {
      ...item,
      detail: rewrite.detail.trim() || item.detail,
      fix: rewrite.fix.trim() || item.fix,
    };
  });

  const idOf = (name: string) =>
    options.characters.find(
      (character) => character.name.toLowerCase() === name.trim().toLowerCase()
    )?.id ?? null;

  const craft: Recommendation[] = parsed.additional
    .slice(0, MAX_AI_NOTES)
    .filter((note) => note.title.trim().length > 0 && note.fix.trim().length > 0)
    .map((note, index) => ({
      id: `ai_note_${index}`,
      code: "AI_NOTE",
      priority: note.priority,
      category: note.category,
      source: "ai" as const,
      title: note.title.trim(),
      detail: note.detail.trim(),
      fix: note.fix.trim(),
      characterIds: note.characterNames
        .map(idOf)
        .filter((id): id is string => id !== null),
      quote: note.quote.trim() || null,
    }));

  return [...polished, ...craft];
}
