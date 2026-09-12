// character-model-formats.ts
// Purpose: Allowed file formats for a character's uploaded custom 3D model.
//          Shared by the upload route (server-side validation) and the
//          roster UI (file picker's accept filter). Deliberately separate
//          from src/assets/manifest.ts — that file is the closed, previs
//          renderer-ready asset set; this is raw actor uploads that don't
//          feed the renderer yet.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

export const CHARACTER_MODEL_FORMATS = ["fbx", "glb", "gltf", "blend"] as const;

export type CharacterModelFormat = (typeof CHARACTER_MODEL_FORMATS)[number];

// Formats the browser can actually render a live thumbnail for (via drei's
// useGLTF/useFBX). ".blend" has no in-browser parser — Blender's own format —
// so an upload in that format only ever gets an icon, never a preview.
export const PREVIEWABLE_CHARACTER_MODEL_FORMATS = ["glb", "gltf", "fbx"] as const;

export function isPreviewableCharacterModelFormat(format: string): boolean {
  return (PREVIEWABLE_CHARACTER_MODEL_FORMATS as readonly string[]).includes(format);
}

export const CHARACTER_MODEL_ACCEPT = CHARACTER_MODEL_FORMATS.map((format) => `.${format}`).join(",");

export const MAX_CHARACTER_MODEL_BYTES = 150 * 1024 * 1024; // 150MB — Blender files with baked textures run large

export function characterModelFormatFromFileName(fileName: string): CharacterModelFormat | null {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return (CHARACTER_MODEL_FORMATS as readonly string[]).includes(extension ?? "")
    ? (extension as CharacterModelFormat)
    : null;
}
