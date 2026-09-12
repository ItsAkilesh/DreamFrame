// page.tsx
// Purpose: /model — mounts the GLB inspector. R3F must never render on the
//          server (§6.6), so the canvas arrives through next/dynamic with ssr
//          disabled, which is only legal from a client module.
// Author: lovegupta2001@gmail.com
// Date: 2026-09-12

"use client";

import dynamic from "next/dynamic";

const ModelViewer = dynamic(() => import("@/render/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 24, fontFamily: "system-ui", color: "#8b8f99" }}>
      Loading inspector…
    </div>
  ),
});

export default function ModelPage() {
  return (
    <main style={{ width: "100vw", height: "100vh", background: "#15171c" }}>
      <ModelViewer />
    </main>
  );
}
