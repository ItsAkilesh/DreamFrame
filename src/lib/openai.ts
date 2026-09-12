// openai.ts
// Purpose: Shared OpenAI client instance.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY is not set in the environment");
}

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Small, cheap model used for script structuring. Swap here if the
// simulation engine later needs a stronger model for dialogue generation.
export const SCRIPT_PARSER_MODEL = "gpt-5.6-luna";
