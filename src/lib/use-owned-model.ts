"use client";

import { useEffect, useState } from "react";
import { FBXLoader, GLTFLoader } from "three-stdlib";
import { type Object3D, type Mesh, Texture } from "three";

// Each viewer owns its model. Do not retain dozens of 100MB FBXs in useLoader's
// global cache or let two canvases reparent and animate the same skeleton.
export function disposeModel(object: Object3D) {
  const textures = new Set<Texture>();
  object.traverse((node) => {
    const mesh = node as Mesh;
    mesh.geometry?.dispose();
    const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const material of materials) {
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
      material.dispose();
    }
  });
  textures.forEach((texture) => texture.dispose());
}

export function useOwnedModel(url: string, format: string) {
  const [state, setState] = useState<{url: string; object: Object3D | null; error: string | null}>({url, object: null, error: null});
  useEffect(() => {
    let cancelled = false;
    let owned: Object3D | null = null;
    const request = format === "fbx"
      ? new FBXLoader().loadAsync(url)
      : new GLTFLoader().loadAsync(url).then((gltf) => gltf.scene);
    request.then((object) => {
      if (cancelled) { disposeModel(object); return; }
      owned = object;
      setState({url, object, error: null});
    }).catch((error: unknown) => {
      if (!cancelled) setState({url, object: null, error: error instanceof Error ? error.message : "Unable to load model"});
    });
    return () => { cancelled = true; if (owned) disposeModel(owned); };
  }, [url, format]);
  return state.url === url ? state : {url, object: null, error: null};
}
