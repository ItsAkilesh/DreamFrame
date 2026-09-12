// asset-library-browser.tsx
// Purpose: Grid view over the shared asset library (src/lib/asset-library.ts),
//          reused both as the read-only global "Asset Library" browser and,
//          in picker mode (onSelect supplied), as a per-character or
//          per-scene model picker. The Upload button (src/app/api/asset-
//          library/upload) is the browser-driven way to add a file; dropping
//          one into public/assets/library/<category>/ directly works too.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Clapperboard, Loader2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CHARACTER_MODEL_ACCEPT } from "@/lib/character-model-formats";
import { cn } from "@/lib/utils";
import type { LibraryAsset } from "@/lib/types";

type LibraryCategory = "character" | "scene";

interface AssetLibraryBrowserProps {
  onSelect?: (asset: LibraryAsset) => void;
  selectedAssetId?: string | null;
  isSelecting?: boolean;
  // Restricts the browser to one category and hides the tab switcher — for a
  // picker scoped to a specific slot (a character's model, a scene's set).
  // Omit for the global, browse-everything "Asset Library" dialog.
  lockCategory?: LibraryCategory;
}

// Mounting a live 3D preview for every card at once — potentially dozens,
// each a multi-megabyte FBX — would blow past the browser's WebGL context
// limit and stall the tab. Only mount a card's thumbnail once it's actually
// scrolled near the viewport, and leave it mounted from then on (re-loading
// on every scroll back and forth would be its own waste).

interface LibraryAssetCardProps {
  asset: LibraryAsset;
  category: LibraryCategory;
  isSelected: boolean;
  isSelectable: boolean;
  onSelect?: (asset: LibraryAsset) => void;
}

function LibraryAssetCard({ asset, category, isSelected, isSelectable, onSelect }: LibraryAssetCardProps) {
  const CardIcon = category === "character" ? Box : Clapperboard;
  // The server-cached thumbnail wins once it exists; until then, a preview
  // this browser just rendered is shown immediately while it's saved for
  // next time in the background.
  const previewUrl = asset.previewUrl;

  // Goes through the single shared generator (thumbnail-queue.ts) rather
  // than mounting a live <Canvas> per card — see its header for why that
  // distinction is the whole point.

  return (
    <button
      type="button"
      disabled={!onSelect || !isSelectable}
      onClick={() => onSelect?.(asset)}
      className={cn(
        "flex flex-col items-center gap-2 rounded-md border p-2 text-center transition-colors",
        onSelect && "hover:bg-accent hover:text-accent-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        isSelected ? "border-primary ring-1 ring-primary" : "border-border"
      )}
    >
      <div className="bg-muted/40 flex aspect-square w-full items-center justify-center overflow-hidden rounded">
        {previewUrl ? (
          // Plain <img>, not next/image: one branch here is a freshly
          // rendered data: URL, which next/image can't usefully optimize.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <CardIcon className="text-muted-foreground size-8" />
        )}
      </div>
      <span className="truncate text-xs font-medium" title={asset.name}>
        {asset.name}
      </span>
      <Badge variant="secondary" className="text-[10px] uppercase">
        {asset.format}
      </Badge>
    </button>
  );
}

export function AssetLibraryBrowser({
  onSelect,
  selectedAssetId,
  isSelecting = false,
  lockCategory,
}: AssetLibraryBrowserProps) {
  const [category, setCategory] = useState<LibraryCategory>(lockCategory ?? "character");
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetch(`/api/asset-library?category=${category}`)
      .then((response) => {
        if (!response.ok) throw new Error("Failed to load asset library");
        return response.json();
      })
      .then((body) => {
        if (!cancelled) setAssets(body.assets ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load asset library");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [category, reloadToken]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("category", category);
      const response = await fetch("/api/asset-library/upload", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Upload failed");
      }
      setReloadToken((value) => value + 1);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={CHARACTER_MODEL_ACCEPT}
        className="hidden"
        disabled={isUploading}
        onChange={(event) => void handleUpload(event)}
      />
      <div className="flex items-center gap-1.5">
        {!lockCategory && (
          <>
            <Button
              size="sm"
              variant={category === "character" ? "default" : "outline"}
              onClick={() => setCategory("character")}
            >
              Characters
            </Button>
            <Button
              size="sm"
              variant={category === "scene" ? "default" : "outline"}
              onClick={() => setCategory("scene")}
            >
              Scenes
            </Button>
          </>
        )}
        <Button
          size="sm"
          variant="outline"
          className="ml-auto gap-1.5"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          Upload
        </Button>
      </div>

      {uploadError && <p className="text-destructive text-xs">{uploadError}</p>}

      {isLoading ? (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
          <Loader2 className="size-4 animate-spin" />
          Loading library…
        </div>
      ) : error ? (
        <p className="text-destructive py-10 text-center text-sm">{error}</p>
      ) : assets.length === 0 ? (
        <p className="text-muted-foreground py-10 text-center text-sm">
          {category === "character"
            ? "No character models in the library yet — upload one, or drop Mixamo FBX/GLB exports into public/assets/library/characters/."
            : "No scene models in the library yet — upload one, or drop FBX/GLB exports into public/assets/library/scenes/."}
        </p>
      ) : (
        <ScrollArea className="h-[65vh]">
          <div className="grid grid-cols-3 gap-2 pr-3 sm:grid-cols-4 md:grid-cols-5">
            {assets.map((asset) => (
              <LibraryAssetCard
                key={asset.id}
                asset={asset}
                category={category}
                isSelected={asset.id === selectedAssetId}
                isSelectable={!isSelecting}
                onSelect={onSelect}
              />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
