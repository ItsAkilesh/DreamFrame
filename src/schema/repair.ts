// repair.ts
// Purpose: coerceSpec(raw) — the five repair steps from plan.md §3.11, run on
//          an LLM-emitted spec that failed strict Zod validation, before
//          falling back to the template spec. Repair, don't reject.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import {
  CLIP_IDS,
  MODEL_IDS,
  PROP_TYPES,
  ROOM_PRESETS,
  type ClipId,
  type ModelId,
  type PropType,
} from "@/assets/manifest";
import { PrevisSpecZ, type PrevisSpec } from "@/schema/previsSpec";

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Levenshtein edit distance, for snapping a near-miss string to its closest enum member. */
function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function snap<T extends string>(value: unknown, legal: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  if ((legal as readonly string[]).includes(value)) return value as T;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if ((legal as readonly string[]).includes(normalized)) return normalized as T;
  let best: T = legal[0];
  let bestDist = Infinity;
  for (const candidate of legal) {
    const d = levenshtein(normalized, candidate);
    if (d < bestDist) {
      bestDist = d;
      best = candidate;
    }
  }
  return best;
}

const clamp = (n: unknown, min: number, max: number, fallback: number): number => {
  const num = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, num));
};

/** Default 4-camera rig (§3.6 recommendation), aimed at the first two cast members. */
function defaultCameraRig(cast: Obj[]): Obj[] {
  const posOf = (c: Obj | undefined): [number, number, number] =>
    Array.isArray(c?.position) && c.position.length === 3
      ? (c.position as [number, number, number])
      : [0, 0, 0];
  const p0 = posOf(cast[0]);
  const p1 = posOf(cast[1] ?? cast[0]);
  const mid: [number, number, number] = [
    (p0[0] + p1[0]) / 2,
    1.5,
    (p0[2] + p1[2]) / 2,
  ];
  return [
    { id: "cam_a", label: "Wide", position: [mid[0], 1.6, mid[2] + 4.2], lookAt: [mid[0], 1.4, mid[2]], lens_mm: 28 },
    { id: "cam_b", label: "OTS A", position: [p0[0] - 1.5, 1.6, p0[2] + 1.6], lookAt: [p1[0], 1.5, p1[2]], lens_mm: 50 },
    { id: "cam_c", label: "OTS B", position: [p1[0] + 1.5, 1.6, p1[2] + 1.6], lookAt: [p0[0], 1.5, p0[2]], lens_mm: 50 },
    { id: "cam_d", label: "Clean CU", position: [mid[0], 1.6, mid[2] + 2.0], lookAt: [mid[0], 1.5, mid[2]], lens_mm: 85 },
  ];
}

export function coerceSpec(raw: unknown): { spec: PrevisSpec; warnings: string[] } {
  const warnings: string[] = [];
  if (!isObj(raw)) {
    throw new Error("coerceSpec: input is not an object");
  }

  const scene = isObj(raw.scene) ? { ...raw.scene } : {};
  if (scene.room !== undefined) {
    const snapped = snap(scene.room, ROOM_PRESETS);
    if (snapped && snapped !== scene.room) {
      warnings.push(`scene.room "${String(scene.room)}" snapped to "${snapped}"`);
    }
    scene.room = snapped ?? "kitchen";
  }

  const set = isObj(raw.set) ? { ...raw.set } : {};
  if (isObj(set.dimensions)) {
    set.dimensions = {
      w: clamp(set.dimensions.w, 3, 12, 6),
      d: clamp(set.dimensions.d, 3, 12, 5),
      h: clamp(set.dimensions.h, 2.4, 4, 3),
    };
  }

  const castIds = new Set<string>();
  const cast = (Array.isArray(raw.cast) ? raw.cast : [])
    .filter(isObj)
    .slice(0, 5)
    .map((c): Obj => {
      const modelId = snap<ModelId>(c.modelId, MODEL_IDS) ?? MODEL_IDS[0];
      if (typeof c.id === "string") castIds.add(c.id);
      return { ...c, modelId, rotationY: clamp(c.rotationY, -Math.PI * 4, Math.PI * 4, 0) };
    });

  const props = (Array.isArray(set.props) ? set.props : [])
    .filter(isObj)
    .filter((p) => {
      const snapped = snap<PropType>(p.type, PROP_TYPES);
      if (!snapped) {
        warnings.push(`dropped prop "${String(p.id)}" — unrecognized type "${String(p.type)}"`);
        return false;
      }
      p.type = snapped;
      p.scale = clamp(p.scale, 0.5, 2, 1);
      return true;
    })
    .slice(0, 14);
  set.props = props;

  let cameras = (Array.isArray(raw.cameras) ? raw.cameras : []).filter(isObj);
  const cameraIds = new Set<string>();
  cameras = cameras
    .map((cam): Obj => ({ ...cam, lens_mm: clamp(cam.lens_mm, 14, 135, 35) }))
    .filter((cam) => {
      if (typeof cam.id === "string") {
        cameraIds.add(cam.id);
        return true;
      }
      return false;
    });
  if (cameras.length === 0) {
    warnings.push("no valid cameras — injected default 4-camera rig");
    cameras = defaultCameraRig(cast);
    for (const cam of cameras) cameraIds.add(cam.id as string);
  }
  const firstCameraId = cameras[0].id as string;

  const beats = (Array.isArray(raw.beats) ? raw.beats : [])
    .filter(isObj)
    .slice(0, 40)
    .map((beat) => {
      const blocking = (Array.isArray(beat.blocking) ? beat.blocking : [])
        .filter(isObj)
        .filter((cue) => {
          if (typeof cue.characterId === "string" && !castIds.has(cue.characterId)) {
            warnings.push(`dropped blocking cue referencing missing character "${cue.characterId}"`);
            return false;
          }
          if (typeof cue.clip === "string") {
            cue.clip = snap<ClipId>(cue.clip, CLIP_IDS) ?? undefined;
          }
          return true;
        });

      let shot = isObj(beat.shot) ? { ...beat.shot } : null;
      if (!shot || typeof shot.cameraId !== "string" || !cameraIds.has(shot.cameraId)) {
        if (shot) {
          warnings.push(`beat "${String(beat.id)}" shot referenced missing camera — assigned wide master`);
        } else {
          warnings.push(`beat "${String(beat.id)}" had no shot — assigned wide master`);
        }
        shot = {
          cameraId: firstCameraId,
          subjectId: cast[0]?.id ?? "",
          move: "static",
        };
      }

      return {
        ...beat,
        duration: clamp(beat.duration, 1.2, 60, 1.2),
        blocking,
        shot,
      };
    });

  const repaired = {
    version: "0.1",
    scene: { id: "sc_01", ...scene },
    set: { dimensions: { w: 6, d: 5, h: 3 }, props: [], lights: [], ...set },
    cast,
    cameras,
    beats,
  };

  const parsed = PrevisSpecZ.safeParse(repaired);
  if (!parsed.success) {
    throw new Error(
      `coerceSpec: repaired spec still invalid: ${parsed.error.issues.map((i) => i.message).join("; ")}`
    );
  }

  return { spec: parsed.data, warnings };
}
