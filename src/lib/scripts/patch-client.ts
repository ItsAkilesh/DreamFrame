// patch-client.ts
// Purpose: Client-side caller for PATCH /api/scripts/[id] — shared by every
//          inline-edit UI so each one doesn't repeat the fetch/error handling.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import type { ScriptPatchRequest } from "@/lib/scripts/patch-schema";

export async function patchScript(
  scriptId: string,
  patch: ScriptPatchRequest
): Promise<void> {
  const response = await fetch(`/api/scripts/${scriptId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message ?? "Failed to save the change");
  }
}
