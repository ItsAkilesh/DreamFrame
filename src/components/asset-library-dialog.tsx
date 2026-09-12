// asset-library-dialog.tsx
// Purpose: Header button opening the read-only, global asset library browser
//          (see asset-library-browser.tsx). Per-character model picking lives
//          on the character's own card instead — see character-model-upload.tsx.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Library } from "lucide-react";

import { AssetLibraryBrowser } from "@/components/asset-library-browser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AssetLibraryDialog() {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2" />
        }
      >
        <Library className="size-4" />
        Asset Library
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Asset Library</DialogTitle>
          <DialogDescription>
            Mixamo character models and scenes shared across every script.
          </DialogDescription>
        </DialogHeader>
        <AssetLibraryBrowser />
      </DialogContent>
    </Dialog>
  );
}
