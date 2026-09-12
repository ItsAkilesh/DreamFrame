// page.tsx
// Purpose: Internal-only page that renders exactly one model (given via
//          ?url=&format=) through the same shared thumbnail queue used
//          everywhere else, then exposes the result as an <img data-ready>
//          whose src IS the captured PNG data URL. Nothing else reads this
//          page in the running app — it exists purely so
//          scripts/generate-thumbnails.mjs can drive a real Chromium
//          (Puppeteer) against it at build time and read the src straight
//          out of the DOM, rather than reimplementing the three.js/drei
//          loading and framing logic a second time for a build script.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

"use client";

import { Suspense, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

import { requestThumbnail } from "@/lib/thumbnail-queue";

// Same client-only rule as everywhere else three.js is involved
// (plan.md §6.6).
const ThumbnailGeneratorHost = dynamic(
  () => import("@/components/thumbnail-generator-host").then((m) => m.ThumbnailGeneratorHost),
  { ssr: false }
);

// Only ever points at our own committed/dropped-in library assets — not a
// general-purpose "render any URL" tool.
const ALLOWED_URL_PREFIXES = ["/assets/library/"];

function isAllowedAssetUrl(url: string): boolean {
  return ALLOWED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function RenderOneAsset() {
  const searchParams = useSearchParams();
  const url = searchParams.get("url");
  const format = searchParams.get("format");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url || !format) {
      setError("Missing url/format query params");
      return;
    }
    if (!isAllowedAssetUrl(url)) {
      setError("url must be under /assets/library/");
      return;
    }

    requestThumbnail(url, format)
      .then(setDataUrl)
      .catch((err) => setError(err instanceof Error ? err.message : "Thumbnail generation failed"));
  }, [url, format]);

  return (
    <>
      <ThumbnailGeneratorHost />
      {error && <p data-error="true">{error}</p>}
      {dataUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- the src IS the payload the build script reads; next/image would re-fetch/transform it pointlessly.
        <img data-ready="true" src={dataUrl} alt="" />
      )}
    </>
  );
}

export default function ThumbnailRenderPage() {
  return (
    <Suspense fallback={null}>
      <RenderOneAsset />
    </Suspense>
  );
}
