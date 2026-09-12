// cameraInGeometry.ts
// Purpose: CAMERA_IN_GEOMETRY — a camera positioned inside a prop, outside
//          the room, or below the floor/above the ceiling (plan.md §9.2 #9).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { PROP_DIMENSIONS } from "@/assets/manifest";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const PROP_INFLATE = 0.2;
const FLOOR_MARGIN = 0.3;
const CEILING_MARGIN = 0.2;

export function checkCameraInGeometry(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];
  const { w, d, h } = spec.set.dimensions;
  const halfW = w / 2;
  const halfD = d / 2;

  for (const cam of spec.cameras) {
    const [x, y, z] = cam.position;
    const usedByBeat = spec.beats.find((b) => b.shot.cameraId === cam.id);

    if (x < -halfW || x > halfW || z < -halfD || z > halfD) {
      notes.push({
        id: `camera_in_geometry_outside_${cam.id}`,
        code: "CAMERA_IN_GEOMETRY",
        severity: "error",
        beatIds: usedByBeat ? [usedByBeat.id] : [],
        characterIds: [],
        message: `${cam.label || cam.id} is outside the room.`,
      });
      continue;
    }

    if (y < FLOOR_MARGIN || y > h - CEILING_MARGIN) {
      notes.push({
        id: `camera_in_geometry_height_${cam.id}`,
        code: "CAMERA_IN_GEOMETRY",
        severity: "error",
        beatIds: usedByBeat ? [usedByBeat.id] : [],
        characterIds: [],
        message: `${cam.label || cam.id} is ${y < FLOOR_MARGIN ? "below floor level" : "above the ceiling"}.`,
      });
      continue;
    }

    for (const prop of spec.set.props) {
      const dims = PROP_DIMENSIONS[prop.type] ?? [0.5, 0.5, 0.5];
      const halfPW = (dims[0] * prop.scale) / 2 + PROP_INFLATE;
      const propH = dims[1] * prop.scale + PROP_INFLATE;
      const halfPD = (dims[2] * prop.scale) / 2 + PROP_INFLATE;
      const [px, , pz] = prop.position;

      const inside =
        x > px - halfPW && x < px + halfPW && y > 0 && y < propH && z > pz - halfPD && z < pz + halfPD;

      if (inside) {
        notes.push({
          id: `camera_in_geometry_prop_${cam.id}_${prop.id}`,
          code: "CAMERA_IN_GEOMETRY",
          severity: "error",
          beatIds: usedByBeat ? [usedByBeat.id] : [],
          characterIds: [],
          message: `${cam.label || cam.id} is inside the ${prop.type.replace(/_/g, " ")}.`,
        });
        break;
      }
    }
  }

  return notes;
}
