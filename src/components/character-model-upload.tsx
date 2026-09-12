// character-model-upload.tsx
// Purpose: Upload, replace, or remove a character's custom 3D model file
//          (FBX/GLB/glTF/Blender). Used on each card in the character roster.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Box, Expand, Library, Loader2, PersonStanding, Trash2, Upload } from "lucide-react";

import { AssetLibraryBrowser } from "@/components/asset-library-browser";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CHARACTER_MODEL_ACCEPT,
  isPreviewableCharacterModelFormat,
} from "@/lib/character-model-formats";
import { requestThumbnail } from "@/lib/thumbnail-queue";
import type { Character, CharacterModelAsset, LibraryAsset } from "@/lib/types";

// three.js touches WebGL/window at effect time — keep it out of the server
// render entirely, same rule the previs Stage follows (plan.md §6.6).
const CharacterModelPreview = dynamic(
  () => import("@/components/character-model-preview").then((m) => m.CharacterModelPreview),
  { ssr: false, loading: () => <ViewerMessage>Loading preview…</ViewerMessage> }
);

function ViewerMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-1.5 px-2 text-center text-xs">
      {children}
    </div>
  );
}

interface ModelThumbnailProps {
  scriptId: string;
  characterId: string;
  characterName: string;
  modelAsset: CharacterModelAsset;
}

// The default view: a static image, generated once (through the single
// shared queue in thumbnail-queue.ts — see its header for why that matters)
// and cached server-side from then on. Live rotate/zoom/pause only mounts
// inside the dialog below, and only while it's actually open — never one
// permanently-live WebGL canvas per card sitting on the roster page.
function ModelThumbnail({ scriptId, characterId, characterName, modelAsset }: ModelThumbnailProps) {
  const router = useRouter();
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [isLiveViewOpen, setIsLiveViewOpen] = useState(false);
  const hasRequestedRef = useRef(false);
  const canPreview = isPreviewableCharacterModelFormat(modelAsset.format);
  const displayUrl = modelAsset.previewUrl ?? generatedUrl;

  useEffect(() => {
    if (modelAsset.previewUrl || !canPreview || hasRequestedRef.current) return;
    hasRequestedRef.current = true;

    requestThumbnail(modelAsset.url, modelAsset.format)
      .then(async (dataUrl) => {
        setGeneratedUrl(dataUrl);
        const response = await fetch(
          `/api/scripts/${scriptId}/characters/${characterId}/model/thumbnail`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUrl }),
          }
        );
        if (response.ok) router.refresh();
      })
      .catch((err) => console.error("Failed to generate character model thumbnail:", err));
  }, [modelAsset.previewUrl, modelAsset.url, modelAsset.format, canPreview, scriptId, characterId, router]);

  return (
    <div className="relative h-full w-full">
      {displayUrl ? (
        // Plain <img>, not next/image: one source here is a freshly rendered
        // data: URL, which next/image can't usefully optimize.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={displayUrl} alt="" className="h-full w-full object-cover" />
      ) : canPreview ? (
        <ViewerMessage>
          <Loader2 className="size-6 animate-spin opacity-60" />
          Generating preview…
        </ViewerMessage>
      ) : (
        <ViewerMessage>
          <Box className="size-10 opacity-40" />
          {"Preview unavailable for ." + modelAsset.format}
        </ViewerMessage>
      )}

      {canPreview && (
        <button
          type="button"
          aria-label={`View ${characterName} in 3D`}
          onClick={() => setIsLiveViewOpen(true)}
          className="absolute right-1.5 bottom-1.5 rounded-full bg-black/60 p-1.5 text-white/90 hover:bg-black/80 hover:text-white"
        >
          <Expand className="size-3.5" />
        </button>
      )}

      <Dialog open={isLiveViewOpen} onOpenChange={setIsLiveViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{characterName}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 aspect-square w-full overflow-hidden rounded-md">
            {isLiveViewOpen && (
              <CharacterModelPreview url={modelAsset.url} format={modelAsset.format} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface CharacterModelUploadProps {
  scriptId: string;
  character: Character;
}

export function CharacterModelUpload({ scriptId, character }: CharacterModelUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const modelUrl = `/api/scripts/${scriptId}/characters/${character.id}/model`;
  const pickUrl = `${modelUrl}/pick`;

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(modelUrl, { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Upload failed");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePickFromLibrary(asset: LibraryAsset) {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(pickUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: asset.id }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to assign model");
      }
      setIsLibraryOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign model");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove() {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(modelUrl, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to remove model");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove model");
    } finally {
      setIsBusy(false);
    }
  }

  const modelAsset = character.modelAsset;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept={CHARACTER_MODEL_ACCEPT}
        className="hidden"
        disabled={isBusy}
        onChange={(event) => void handleFileSelected(event)}
      />

      <div className="bg-muted/40 aspect-square w-full overflow-hidden rounded-md">
        {modelAsset ? (
          <ModelThumbnail
            scriptId={scriptId}
            characterId={character.id}
            characterName={character.name}
            modelAsset={modelAsset}
          />
        ) : (
          <ViewerMessage>
            <PersonStanding className="size-10 opacity-40" />
            No model yet
          </ViewerMessage>
        )}
      </div>

      {modelAsset ? (
        <div className="flex items-center gap-2">
          <Box className="text-muted-foreground size-4 shrink-0" />
          <span className="truncate text-xs" title={modelAsset.fileName}>
            {modelAsset.fileName}
          </span>
          <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
            {modelAsset.format}
          </Badge>
          <div className="ml-auto flex shrink-0 gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              Replace
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={isBusy}
              onClick={() => setIsLibraryOpen(true)}
            >
              Library
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove model"
              disabled={isBusy}
              onClick={() => void handleRemove()}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {isBusy ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload model
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            disabled={isBusy}
            onClick={() => setIsLibraryOpen(true)}
          >
            <Library />
            Choose from library
          </Button>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a model for {character.name}</DialogTitle>
            <DialogDescription>
              Picking an asset here replaces any model currently assigned to this character.
            </DialogDescription>
          </DialogHeader>
          <AssetLibraryBrowser
            selectedAssetId={modelAsset?.fileName}
            isSelecting={isBusy}
            onSelect={(asset) => void handlePickFromLibrary(asset)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
