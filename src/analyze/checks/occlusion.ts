// occlusion.ts
// Purpose: OCCLUSION — raycasts camera-to-subject against each prop's AABB
//          (plan.md §9.2 #5). Prop rotation is ignored for the box test — an
//          acceptable simplification at placeholder-geometry fidelity.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import * as THREE from "three";

import { PROP_DIMENSIONS } from "@/assets/manifest";
import { headPos, nameOf } from "@/analyze/geom";
import type { Note, PrevisSpec } from "@/schema/previsSpec";

const CLEARANCE_MARGIN = 0.05;

export function checkOcclusion(spec: PrevisSpec): Note[] {
  const notes: Note[] = [];

  for (const beat of spec.beats) {
    const cam = spec.cameras.find((c) => c.id === beat.shot.cameraId);
    if (!cam) continue;

    const subjectId = beat.shot.subjectId;
    const head = headPos(spec, subjectId, beat.id);
    const camPos = new THREE.Vector3(...cam.position);
    const headVec = new THREE.Vector3(...head);
    const toHead = headVec.clone().sub(camPos);
    const maxDist = toHead.length();
    if (maxDist === 0) continue;

    const ray = new THREE.Ray(camPos, toHead.clone().normalize());

    for (const prop of spec.set.props) {
      const dims = PROP_DIMENSIONS[prop.type] ?? [0.5, 0.5, 0.5];
      const halfW = (dims[0] * prop.scale) / 2;
      const height = dims[1] * prop.scale;
      const halfD = (dims[2] * prop.scale) / 2;
      const [px, , pz] = prop.position;

      const box = new THREE.Box3(
        new THREE.Vector3(px - halfW, 0, pz - halfD),
        new THREE.Vector3(px + halfW, height, pz + halfD)
      );

      const hit = ray.intersectBox(box, new THREE.Vector3());
      if (hit && camPos.distanceTo(hit) < maxDist - CLEARANCE_MARGIN) {
        notes.push({
          id: `occlusion_${beat.id}_${prop.id}`,
          code: "OCCLUSION",
          severity: "error",
          beatIds: [beat.id],
          characterIds: [subjectId],
          message: `The ${prop.type.replace(/_/g, " ")} blocks ${nameOf(spec, subjectId)}'s face on beat ${beat.id}.`,
          suggestedFix: {
            cameraId: cam.id,
            position: [cam.position[0], 1.75, cam.position[2]],
            lookAt: cam.lookAt,
            lens_mm: cam.lens_mm,
          },
        });
        break;
      }
    }
  }

  return notes;
}
