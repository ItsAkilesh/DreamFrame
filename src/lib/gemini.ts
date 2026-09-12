// gemini.ts
// Purpose: Shared Gemini client (Google AI Studio) used by script parsing,
//          simulation, recommendations, and the other LLM passes.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { GoogleGenerativeAI } from "@google/generative-ai";

import { openai } from "@/lib/openai";

function readDotEnvValue(name: string): string | undefined {
  const envLocalPath = join(process.cwd(), ".env.local");
  if (!existsSync(envLocalPath)) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = readFileSync(envLocalPath, "utf8").match(
    new RegExp(`^${escaped}=["']?(.+?)["']?$`, "m")
  );
  return match?.[1];
}

export function getGeminiApiKey(): string {
  const key =
    readDotEnvValue("GEMINI_API_KEY") ??
    process.env.GEMINI_API_KEY ??
    readDotEnvValue("OPENAI_API_KEY") ??
    process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set in the environment");
  }
  return key;
}

export const SCRIPT_PARSER_MODEL =
  readDotEnvValue("GEMINI_SCRIPT_MODEL") ??
  process.env.GEMINI_SCRIPT_MODEL ??
  "gemini-2.5-flash";

export const SIMULATION_MODEL =
  readDotEnvValue("GEMINI_SIMULATION_MODEL") ??
  process.env.GEMINI_SIMULATION_MODEL ??
  "gemini-2.5-pro";

export const geminiAi = new GoogleGenerativeAI(getGeminiApiKey());

const STRUCTURED_RUNTIME_MODEL = "gpt-5.6-terra";

export const gemini = {
  responses: {
    parse: (args: Parameters<typeof openai.responses.parse>[0]) =>
      openai.responses.parse({
        ...args,
        model: STRUCTURED_RUNTIME_MODEL,
      }),
  },
};
