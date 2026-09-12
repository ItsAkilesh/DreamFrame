// scene-model-upload.tsx
// Purpose: Upload, replace, or remove a scene's 3D environment model
//          (room/set FBX/GLB/glTF), or assign one from the shared asset
//          library. Mirrors character-model-upload.tsx's structure; see that
//          file's header for why the thumbnail is a cached static image with
//          a live view opened on demand, not a permanently-mounted canvas.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Box, Expand, Home, Library, Loader2, Trash2, Upload } from "lucide-react";

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
import type { CharacterModelAsset, LibraryAsset, Scene } from "@/lib/types";

const SceneModelPreview = dynamic(
  () => import("@/components/scene-model-preview").then((m) => m.SceneModelPreview),
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
  sceneId: string;
  sceneTitle: string;
  modelAsset: CharacterModelAsset;
}

function ModelThumbnail({ scriptId, sceneId, sceneTitle, modelAsset }: ModelThumbnailProps) {
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
        const response = await fetch(`/api/scripts/${scriptId}/scenes/${sceneId}/model/thumbnail`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        if (response.ok) router.refresh();
      })
      .catch((err) => console.error("Failed to generate scene model thumbnail:", err));
  }, [modelAsset.previewUrl, modelAsset.url, modelAsset.format, canPreview, scriptId, sceneId, router]);

  return (
    <div className="relative h-full w-full">
      {displayUrl ? (
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
          aria-label={`View ${sceneTitle}'s set in 3D`}
          onClick={() => setIsLiveViewOpen(true)}
          className="absolute right-1.5 bottom-1.5 rounded-full bg-black/60 p-1.5 text-white/90 hover:bg-black/80 hover:text-white"
        >
          <Expand className="size-3.5" />
        </button>
      )}

      <Dialog open={isLiveViewOpen} onOpenChange={setIsLiveViewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{sceneTitle}</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 aspect-square w-full overflow-hidden rounded-md">
            {isLiveViewOpen && <SceneModelPreview url={modelAsset.url} format={modelAsset.format} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface SceneModelUploadProps {
  scriptId: string;
  scene: Scene;
}

export function SceneModelUpload({ scriptId, scene }: SceneModelUploadProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const modelUrl = `/api/scripts/${scriptId}/scenes/${scene.id}/model`;
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

  const modelAsset = scene.modelAsset;

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

      <div className="bg-muted/40 aspect-video w-full overflow-hidden rounded-md">
        {modelAsset ? (
          <ModelThumbnail
            scriptId={scriptId}
            sceneId={scene.id}
            sceneTitle={scene.title}
            modelAsset={modelAsset}
          />
        ) : (
          <ViewerMessage>
            <Home className="size-10 opacity-40" />
            No set model yet
          </ViewerMessage>
        )}
      </div>

      {modelAsset ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Box className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-xs" title={modelAsset.fileName}>
              {modelAsset.fileName}
            </span>
            <Badge variant="secondary" className="shrink-0 text-[10px] uppercase">
              {modelAsset.format}
            </Badge>
          </div>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="min-w-0 flex-1"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="truncate">Replace</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-w-0 flex-1"
              disabled={isBusy}
              onClick={() => setIsLibraryOpen(true)}
            >
              <span className="truncate">Library</span>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Remove set model"
              className="shrink-0"
              disabled={isBusy}
              onClick={() => void handleRemove()}
            >
              <Trash2 />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 gap-1.5"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            {isBusy ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Upload className="size-4 shrink-0" />}
            <span className="truncate">Upload</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="min-w-0 flex-1 gap-1.5"
            disabled={isBusy}
            onClick={() => setIsLibraryOpen(true)}
          >
            <Library className="size-4 shrink-0" />
            <span className="truncate">Library</span>
          </Button>
        </div>
      )}

      {error && <p className="text-destructive text-xs">{error}</p>}

      <Dialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a set model for {scene.title}</DialogTitle>
            <DialogDescription>
              Picking an asset here replaces any model currently assigned to this scene.
            </DialogDescription>
          </DialogHeader>
          <AssetLibraryBrowser
            lockCategory="scene"
            selectedAssetId={modelAsset?.fileName}
            isSelecting={isBusy}
            onSelect={(asset) => void handlePickFromLibrary(asset)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
