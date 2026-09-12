// noseRoom.ts
// Purpose: NOSE_ROOM — flags a subject framed against the edge they're
//          looking toward, with no room to look into (plan.md §9.2 #4).
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { facing, headPos, headingAt, nameOf, toNDC } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

// Below this, the subject is facing close enough to straight at (or away
// from) the camera that "which side are they looking toward" isn't a
// meaningful question — nose room only applies to profile/three-quarter
// framing. Without this, floating-point noise around dx==0 flags shots that
// are, by construction, dead-on.
const DX_DEADZONE = 0.02;

// `lead` is meant to flag a subject crowded against the edge they're looking
// toward — not one framed at exact centre (lead == 0.5), which is neutral,
// correct headroom on both sides. Without this tolerance, floating-point
// error alone pushes an exactly-centred subject to lead=0.49999... and
// flags a shot that is, by construction, fine.
const LEAD_EPSILON = 0.001;

export function checkNoseRoom(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];

  for (const beat of spec.beats) {
    const cam = spec.cameras.find((c) => c.id === beat.shot.cameraId);
    if (!cam) continue;

    const subjectId = beat.shot.subjectId;
    const head = headPos(spec, subjectId, beat.id);
    const rotationY = headingAt(spec, subjectId, beat.id);
    const f = facing(rotationY);
    const ahead: [number, number, number] = [head[0] + f[0], head[1], head[2] + f[2]];

    const headNdc = toNDC(cam, head);
    const aheadNdc = toNDC(cam, ahead);
    const dx = aheadNdc.x - headNdc.x;
    if (Math.abs(dx) < DX_DEADZONE) continue;

    const lead = dx > 0 ? (1 - headNdc.x) / 2 : (1 + headNdc.x) / 2;

    if (lead < 0.5 - LEAD_EPSILON) {
      const side = dx > 0 ? "right" : "left";
      notes.push({
        id: `nose_room_${beat.id}`,
        code: "NOSE_ROOM",
        severity: "warning",
        beatIds: [beat.id],
        characterIds: [subjectId],
        message: `${nameOf(spec, subjectId)} is looking frame-${side} but is framed against that edge on beat ${beat.id}. Give them room to look into.`,
        suggestedFix: {
          cameraId: cam.id,
          position: [cam.position[0] + (dx > 0 ? -0.4 : 0.4), cam.position[1], cam.position[2]],
          lookAt: cam.lookAt,
          lens_mm: cam.lens_mm,
        },
      });
    }
  }

  return notes;
}
