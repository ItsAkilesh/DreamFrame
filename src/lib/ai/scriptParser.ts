// scriptParser.ts
// Purpose: Structures a raw uploaded script into Acts, Scenes, and Characters
//          via a single structured-output LLM call.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { gemini, SCRIPT_PARSER_MODEL } from "@/lib/gemini";

const MAX_ACTS = 6;
const MAX_SCENES = 24;
const MAX_CHARACTERS = 12;

const ParsedCharacterSchema = z.object({
  name: z.string(),
  motivation: z.string(),
  traits: z.array(z.string()).max(5),
  baselineEmotion: z.string(),
});

const ParsedSceneSchema = z.object({
  actOrder: z.number().int().min(1),
  order: z.number().int().min(1),
  title: z.string(),
  text: z.string(),
  toneTarget: z.string(),
  characterNames: z.array(z.string()),
});

const ParsedActSchema = z.object({
  title: z.string(),
  order: z.number().int().min(1),
});

const ParsedScriptSchema = z.object({
  title: z.string(),
  acts: z.array(ParsedActSchema).min(1).max(MAX_ACTS),
  scenes: z.array(ParsedSceneSchema).min(1).max(MAX_SCENES),
  characters: z.array(ParsedCharacterSchema).min(1).max(MAX_CHARACTERS),
});

export type ParsedScript = z.infer<typeof ParsedScriptSchema>;

const SYSTEM_PROMPT = `You are a script-structuring assistant for a filmmaking tool. Given a raw script or story text, break it into Acts, Scenes, and Characters.

Rules:
- Group scenes into ${MAX_ACTS} or fewer Acts, in story order.
- Extract up to ${MAX_SCENES} Scenes total, each a distinct beat or location/time change. Write a concise 1-3 sentence summary of what happens as "text", not a verbatim transcript.
- Extract up to ${MAX_CHARACTERS} named Characters who actually appear. Infer "motivation" and "baselineEmotion" from how they behave/speak, not from stating the obvious.
- "toneTarget" is a short phrase describing the intended emotional tone of the scene (e.g. "tense, restrained").
- "characterNames" on each scene must match names in the characters list exactly.
- If the input is short or unstructured, do your best to infer a reasonable Act/Scene breakdown rather than refusing.`;

export async function parseScriptWithAI(rawText: string): Promise<ParsedScript> {
  const response = await gemini.responses.parse({
    model: SCRIPT_PARSER_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawText },
    ],
    text: {
      format: zodTextFormat(ParsedScriptSchema, "parsed_script"),
    },
  });

  const parsed = response.output_parsed;
  if (!parsed) {
    throw new Error("Script parser returned no structured output");
  }

  return parsed;
}
