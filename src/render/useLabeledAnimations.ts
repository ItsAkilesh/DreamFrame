// useLabeledAnimations.ts
// Purpose: Loads the asset library's labeled animation clips once per mount,
//          for animationMap.ts to choose from. Separate from
//          useIdleAnimationAsset.ts, which answers the narrower "which clip is
//          idle" question and is used by surfaces that need nothing else.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { useEffect, useState } from "react";

import type { LabeledAnimation } from "@/render/animationMap";

export function useLabeledAnimations(): LabeledAnimation[] {
  const [assets, setAssets] = useState<LabeledAnimation[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/asset-library?category=animation")
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (cancelled || !body?.assets) return;
        // Unlabeled clips are named "Unnamed motion · <hash>" (see
        // asset-library.ts) — nothing to match an emotion against.
        setAssets(
          (body.assets as LabeledAnimation[]).filter((a) => !a.name.startsWith("Unnamed motion"))
        );
      })
      .catch(() => {
        // No library available — every character falls back to idle.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return assets;
}
