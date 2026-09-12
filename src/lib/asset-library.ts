// asset-library.ts
// Purpose: Server-side catalog of shared 3D assets (Mixamo character exports
//          for now, scenes later) — derived by scanning public/assets/library/
//          rather than a seeded DB collection, so dropping a file into that
//          folder is the entire "adding it to the library" step.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { randomBytes } from "node:crypto";
import { mkdir, readdir, open, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  CHARACTER_MODEL_FORMATS,
  type CharacterModelFormat,
  characterModelFormatFromFileName,
} from "@/lib/character-model-formats";

export const ASSET_LIBRARY_CATEGORIES = ["character", "scene", "animation"] as const;
export type AssetLibraryCategory = (typeof ASSET_LIBRARY_CATEGORIES)[number];

export interface LibraryAsset {
  id: string;
  name: string;
  format: CharacterModelFormat;
  url: string;
  // A cached, pre-rendered thumbnail (see the sibling thumbnail route) — null
  // until some viewer's browser has generated and saved one.
  previewUrl: string | null;
}

const LIBRARY_ROOT = join(process.cwd(), "public", "assets", "library");
const THUMBNAIL_ROOT = join(process.cwd(), "public", "assets", "library-thumbnails");
const CATEGORY_DIRS: Record<AssetLibraryCategory, string> = {
  character: "characters",
  scene: "scenes",
  animation: "animations",
};

// Files arrive with opaque/hashed names (Mixamo exports, downloader tool
// output, etc.) that are meaningless to show — number them instead, in a
// stable order (sorted by filename) so the list doesn't reshuffle on every
// request.
const CATEGORY_LABELS: Record<AssetLibraryCategory, string> = {
  character: "Character",
  scene: "Scene",
  animation: "Mixamo animation",
};

// Strips the extension so the library file "Character6.fbx" and its cached
// thumbnail "Character6.png" agree on one stable key.
export function assetThumbnailBaseName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

export function libraryThumbnailPath(category: AssetLibraryCategory, assetId: string): string {
  return join(THUMBNAIL_ROOT, CATEGORY_DIRS[category], `${assetThumbnailBaseName(assetId)}.png`);
}

async function listCachedThumbnailBaseNames(category: AssetLibraryCategory): Promise<Set<string>> {
  try {
    const entries = await readdir(join(THUMBNAIL_ROOT, CATEGORY_DIRS[category]));
    return new Set(entries.map((fileName) => assetThumbnailBaseName(fileName)));
  } catch {
    return new Set();
  }
}

// The file's own name doubles as its stable id — the library has no DB row,
// so there's nothing else to key off, and directory entries are unique by
// definition.
export async function listLibraryAssets(category: AssetLibraryCategory): Promise<LibraryAsset[]> {
  const dir = join(LIBRARY_ROOT, CATEGORY_DIRS[category]);
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }

  const candidates = entries
    .map((fileName) => ({ fileName, format: characterModelFormatFromFileName(fileName) }))
    .filter((entry): entry is { fileName: string; format: CharacterModelFormat } => entry.format !== null)
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  // FBXLoader cannot read pre-7.x exports. Inspect only the header rather than
  // downloading tens of megabytes in the browser just to discover that fact.
  const readable = await Promise.all(candidates.map(async (entry) => {
    if (entry.format !== "fbx") return category !== "animation";
    const file = await open(join(dir, entry.fileName), "r");
    try {
      const header = Buffer.alloc(4096);
      const {bytesRead} = await file.read(header, 0, header.length, 0);
      if (header.toString("ascii", 0, 18) === "Kaydara FBX Binary") return header.readUInt32LE(23) >= 7000;
      const version = /FBXVersion:\s*(\d+)/.exec(header.toString("utf8", 0, bytesRead));
      return Boolean(version && Number(version[1]) >= 7000);
    } finally { await file.close(); }
  }));
  const files = candidates.filter((_, index) => readable[index]);

  const cachedThumbnails = await listCachedThumbnailBaseNames(category);
  // Original names can be supplied alongside hashed exports. Named exports
  // keep their filenames; never invent semantic motion names for anonymous FBXs.
  let animationNames: Record<string, string> = {};
  if (category === "animation") {
    try { animationNames = JSON.parse(await readFile(join(dir, "names.json"), "utf8")); } catch { /* optional metadata */ }
  }

  return files.map(({ fileName, format }, index) => {
    const baseName = assetThumbnailBaseName(fileName);
    return {
      id: fileName,
      name: category === "animation"
        ? (typeof animationNames[fileName] === "string" ? animationNames[fileName]
          : /^[a-f0-9]{32}$/i.test(baseName) ? `Unnamed motion · ${baseName.slice(0, 8)}` : baseName)
        : `${CATEGORY_LABELS[category]} ${index + 1}`,
      format,
      url: `/assets/library/${CATEGORY_DIRS[category]}/${fileName}`,
      previewUrl: cachedThumbnails.has(baseName)
        ? `/assets/library-thumbnails/${CATEGORY_DIRS[category]}/${baseName}.png`
        : null,
    };
  });
}

// Saves an uploaded file straight into the shared library folder — this is
// the whole "add it to the library" step for a user-driven upload, same as
// manually dropping a file into public/assets/library/ is. The stored name
// is a fresh random one (never the original filename): entries are numbered
// for display (see listLibraryAssets), not named from disk, and a fresh name
// avoids colliding with whatever else is already in the folder.
export async function saveLibraryUpload(
  category: AssetLibraryCategory,
  originalFileName: string,
  buffer: Buffer
): Promise<LibraryAsset> {
  const format = characterModelFormatFromFileName(originalFileName);
  if (!format) {
    throw new Error(`Unsupported file type — use one of: ${CHARACTER_MODEL_FORMATS.join(", ")}`);
  }

  const dir = join(LIBRARY_ROOT, CATEGORY_DIRS[category]);
  await mkdir(dir, { recursive: true });
  const storedFileName = `${Date.now()}-${randomBytes(4).toString("hex")}.${format}`;
  await writeFile(join(dir, storedFileName), buffer);

  return {
    id: storedFileName,
    name: originalFileName.replace(/\.[^.]+$/, ""),
    format,
    url: `/assets/library/${CATEGORY_DIRS[category]}/${storedFileName}`,
    previewUrl: null,
  };
}

// Re-derives a single entry from disk by id (its filename) — used when a
// character "picks" a library asset, so the server never trusts a
// client-supplied url/format directly.
export async function findLibraryAsset(
  category: AssetLibraryCategory,
  id: string
): Promise<LibraryAsset | null> {
  if (!(CHARACTER_MODEL_FORMATS as readonly string[]).some((format) => id.endsWith(`.${format}`))) {
    return null;
  }
  // Reject anything but a bare filename — no path traversal via id.
  if (id.includes("/") || id.includes("\\") || id.includes("..")) {
    return null;
  }
  const assets = await listLibraryAssets(category);
  return assets.find((asset) => asset.id === id) ?? null;
}
