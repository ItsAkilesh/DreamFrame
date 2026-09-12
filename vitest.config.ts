// vitest.config.ts
// Purpose: Vitest config — mirrors the "@/*" -> "./src/*" alias from
//          tsconfig.json so test files can import the same way app code does.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
