// useIdleAnimationAsset.ts
// Purpose: Looks up a shared "idle" animation library asset id, once per
//          mount — used for every character not currently speaking/acting so
//          they stand in a casual idle loop instead of sitting in raw bind
//          pose (a T-pose on these Mixamo rigs). Shared by Stage.tsx (the
//          static previs "Show Scene" view) and simulation-stage.tsx (live +
//          saved-run simulation playback) so both surfaces agree on which
//          clip counts as "idle" instead of maintaining two lookups.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { useEffect, useState } from "react";

export function useIdleAnimationAssetId(): string | null {
  const [assetId, setAssetId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/asset-library?category=animation")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.assets) return;
        const idle = (body.assets as { id: string; name: string }[]).find((a) =>
          /idle/i.test(a.name)
        );
        if (idle) setAssetId(idle.id);
      })
      .catch(() => {
        // No idle clip available — characters just fall back to bind pose.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assetId;
}
