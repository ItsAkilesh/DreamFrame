// openai.ts
// Purpose: Shared OpenAI client instance.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";

// Node/dotenv-style env loading never overrides a variable that's already
// present in the process environment. On a machine with a stale/invalid
// OPENAI_API_KEY left over at the OS level (Windows User env var, a leftover
// export in a long-lived shell, etc.), that silently shadows the real value
// in .env.local with no error — every request then fails auth using a key
// nobody intended to use. Read .env.local's value directly and prefer it
// over the ambient process env for local dev; in production (no .env.local
// file) this just falls back to the platform-provided process.env value.
function getOpenAIApiKey(): string {
  const envLocalPath = join(process.cwd(), ".env.local");
  if (existsSync(envLocalPath)) {
    const match = readFileSync(envLocalPath, "utf8").match(
      /^OPENAI_API_KEY=["']?(.+?)["']?$/m
    );
    if (match?.[1]) {
      return match[1];
    }
  }

  if (process.env.OPENAI_API_KEY) {
    return process.env.OPENAI_API_KEY;
  }

  throw new Error("OPENAI_API_KEY is not set in the environment");
}

export const openai = new OpenAI({ apiKey: getOpenAIApiKey() });

// Small, cheap model used for script structuring.
export const SCRIPT_PARSER_MODEL = "gpt-5.6-luna";

// Used for per-turn character dialogue generation. Same model for now —
// swap here if conversation quality needs a stronger model; call sites
// don't need to change.
export const SIMULATION_MODEL = "gpt-5.6-luna";
