// route.ts
// Purpose: List the shared 3D asset library (Mixamo character exports for
//          now), scanned live from public/assets/library/ — see
//          src/lib/asset-library.ts.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { NextRequest, NextResponse } from "next/server";

import {
  ASSET_LIBRARY_CATEGORIES,
  listLibraryAssets,
  type AssetLibraryCategory,
} from "@/lib/asset-library";

function isAssetLibraryCategory(value: string): value is AssetLibraryCategory {
  return (ASSET_LIBRARY_CATEGORIES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const categoryParam = request.nextUrl.searchParams.get("category") ?? "character";
  if (!isAssetLibraryCategory(categoryParam)) {
    return NextResponse.json(
      { status: "error", message: `category must be one of: ${ASSET_LIBRARY_CATEGORIES.join(", ")}` },
      { status: 400 }
    );
  }

  const assets = await listLibraryAssets(categoryParam);
  return NextResponse.json({ status: "ok", assets });
}
