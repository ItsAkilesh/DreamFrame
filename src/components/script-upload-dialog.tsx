// script-upload-dialog.tsx
// Purpose: Dialog for providing a raw script — pasted text or a PDF file —
//          and sending it to the AI script-structuring endpoint. On success,
//          refreshes the page so the server component re-fetches the script.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export function ScriptUploadDialog() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "pdf">("paste");
  const [rawText, setRawText] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    mode === "paste" ? rawText.trim().length > 0 : pdfFile !== null;

  async function handleSubmit() {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/scripts", {
        method: "POST",
        ...(mode === "pdf" && pdfFile
          ? { body: toFormData(pdfFile) }
          : {
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ rawText }),
            }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to structure script");
      }

      setOpen(false);
      setRawText("");
      setPdfFile(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="justify-start gap-2">
            <Upload className="size-4" />
            Upload Script
          </Button>
        }
      />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload a script</DialogTitle>
          <DialogDescription>
            Paste your script text or upload a PDF. An AI agent will structure
            it into Acts, Scenes, and Characters.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => setMode(value as "paste" | "pdf")}
        >
          <TabsList className="w-full">
            <TabsTrigger value="paste" className="flex-1">
              Paste text
            </TabsTrigger>
            <TabsTrigger value="pdf" className="flex-1">
              Upload PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paste">
            <Textarea
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={"INT. KITCHEN - NIGHT\n\nMARA stands at the sink..."}
              className="h-64 resize-none font-mono text-xs"
              disabled={isSubmitting}
            />
          </TabsContent>

          <TabsContent value="pdf">
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-md border border-dashed">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={isSubmitting}
                onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              />
              <FileText className="text-muted-foreground size-8" />
              {pdfFile ? (
                <p className="text-sm font-medium">{pdfFile.name}</p>
              ) : (
                <p className="text-muted-foreground text-sm">No PDF selected</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose PDF
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Structuring..." : "Parse Script"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toFormData(file: File): FormData {
  const formData = new FormData();
  formData.append("file", file);
  return formData;
}
