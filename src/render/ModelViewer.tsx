// ModelViewer.tsx
// Purpose: Inspect an arbitrary GLB/GLTF — from a local file or a URL — against
//          a 1.75 m human reference and a 1 m grid, with a full animation
//          transport for checking clips. Built for QA on generated and
//          retargeted assets before they reach the manifest: meshes arrive at
//          arbitrary scale and Mixamo exports arrive with arbitrary action
//          names, and both break the analyzer quietly (§6.2, §6.3, §9).
// Author: lovegupta2001@gmail.com
// Date: 2026-09-12

"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  OrbitControls,
  useAnimations,
  useGLTF,
} from "@react-three/drei";

type ClipInfo = { name: string; duration: number };

type Stats = {
  size: [number, number, number];
  center: [number, number, number];
  triangles: number;
  meshes: number;
  materials: number;
  clips: ClipInfo[];
};

type Source = { url: string; label: string; isBlob: boolean };
type Transport = "playing" | "paused" | "stopped";
type Preset = "fit" | "front" | "right" | "top";

type ModelApi = { seek: (t: number) => void };

const HUMAN_HEIGHT = 1.75;
const HUMAN_RADIUS = 0.28;

const fmt = (t: number) => `${t.toFixed(2)}s`;

function countGeometry(root: THREE.Object3D) {
  let triangles = 0;
  let meshes = 0;
  const materials = new Set<string>();
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    meshes += 1;
    const g = mesh.geometry;
    triangles += g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
    const mat = mesh.material;
    if (Array.isArray(mat)) mat.forEach((m) => materials.add(m.uuid));
    else if (mat) materials.add(mat.uuid);
  });
  return { triangles: Math.round(triangles), meshes, materials: materials.size };
}

function Model({
  source,
  scale,
  clip,
  transport,
  speed,
  loop,
  wireframe,
  shadows,
  onStats,
  onTime,
  onApi,
}: {
  source: Source;
  scale: number;
  clip: string | null;
  transport: Transport;
  speed: number;
  loop: boolean;
  wireframe: boolean;
  shadows: boolean;
  onStats: (s: Stats) => void;
  onTime: (t: number) => void;
  onApi: (api: ModelApi) => void;
}) {
  const { scene, animations } = useGLTF(source.url);
  const group = React.useRef<THREE.Group>(null);
  const { actions, mixer } = useAnimations(animations, group);
  const active = clip ? (actions[clip] ?? null) : null;

  // Box3.setFromObject walks WORLD matrices, which here include the wrapping
  // group's scale — measuring that way and multiplying by scale again would
  // double-count it. Accumulate in scene-local space so the reported size is
  // always the asset's authored size.
  React.useEffect(() => {
    scene.updateMatrixWorld(true);
    const toLocal = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    const box = new THREE.Box3();
    const scratch = new THREE.Matrix4();
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox;
      if (!b) return;
      box.union(b.clone().applyMatrix4(scratch.multiplyMatrices(toLocal, mesh.matrixWorld)));
    });
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    if (!box.isEmpty()) {
      box.getSize(size);
      box.getCenter(center);
    }
    const { triangles, meshes, materials } = countGeometry(scene);
    onStats({
      size: [size.x, size.y, size.z],
      center: [center.x, center.y, center.z],
      triangles,
      meshes,
      materials,
      clips: animations.map((a) => ({ name: a.name, duration: a.duration })),
    });
  }, [scene, animations, onStats]);

  React.useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = shadows;
      mesh.receiveShadow = shadows;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        const mat = m as THREE.MeshStandardMaterial;
        if (mat && "wireframe" in mat) mat.wireframe = wireframe;
      });
    });
  }, [scene, wireframe, shadows]);

  // Starting a clip is separate from transport state, so pausing does not
  // restart playback from frame zero.
  React.useEffect(() => {
    if (!active) return;
    active.reset();
    active.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    active.clampWhenFinished = !loop;
    active.play();
    return () => {
      active.stop();
    };
  }, [active, loop]);

  React.useEffect(() => {
    if (!active) return;
    if (transport === "stopped") {
      active.paused = true;
      active.time = 0;
      mixer.update(0);
      onTime(0);
      return;
    }
    if (!active.isRunning()) active.play();
    active.paused = transport === "paused";
  }, [active, transport, mixer, onTime]);

  React.useEffect(() => {
    mixer.timeScale = speed;
  }, [mixer, speed]);

  React.useEffect(() => {
    onApi({
      seek: (t) => {
        if (!active) return;
        const wasPaused = active.paused;
        active.paused = false;
        active.time = t;
        mixer.update(0); // re-pose at the new time even while paused
        active.paused = wasPaused;
        onTime(t);
      },
    });
  }, [active, mixer, onApi, onTime]);

  // Reporting every frame would re-render the panel at 60 Hz for no benefit.
  const since = React.useRef(0);
  useFrame((_, delta) => {
    if (!active || active.paused) return;
    since.current += delta;
    if (since.current < 0.066) return;
    since.current = 0;
    onTime(active.time);
  });

  return (
    <group ref={group} scale={scale}>
      <primitive object={scene} />
    </group>
  );
}

class LoadBoundary extends React.Component<
  { children: React.ReactNode; resetKey: string; onError: (m: string) => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn("GLB failed to load:", error);
    this.props.onError(error.message || "the file could not be parsed as glTF");
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Frames the model. Replaces drei <Bounds> so manual presets and auto-fit
 *  share one mechanism instead of fighting each other. */
function ViewController({
  token,
  preset,
  target,
  radius,
}: {
  token: string;
  preset: Preset;
  target: [number, number, number];
  radius: number;
}) {
  const { camera, controls } = useThree();
  React.useEffect(() => {
    const c = new THREE.Vector3(...target);
    // Distance that actually fits a sphere of `radius` in this camera's frustum,
    // plus a margin. A fixed multiplier crops tall models.
    const cam = camera as THREE.PerspectiveCamera;
    const fov = ((cam.isPerspectiveCamera ? cam.fov : 45) * Math.PI) / 180;
    const d = Math.max((radius / Math.tan(fov / 2)) * 1.25, 0.4);
    const offsets: Record<Preset, [number, number, number]> = {
      fit: [d * 0.55, d * 0.45, d * 0.75],
      front: [0, d * 0.12, d],
      right: [d, d * 0.12, 0],
      top: [0.001, d, 0.001],
    };
    const [x, y, z] = offsets[preset];
    camera.position.set(c.x + x, c.y + y, c.z + z);
    camera.near = Math.max(d / 500, 0.001);
    camera.far = d * 50;
    camera.updateProjectionMatrix();
    camera.lookAt(c);
    const ctrl = controls as unknown as { target?: THREE.Vector3; update?: () => void } | null;
    if (ctrl?.target) {
      ctrl.target.copy(c);
      ctrl.update?.();
    }
    // token forces a re-run when the same preset is picked twice
  }, [token, preset, target, radius, camera, controls]);
  return null;
}

function CaptureBridge({ onReady }: { onReady: (gl: THREE.WebGLRenderer) => void }) {
  const { gl } = useThree();
  // Block body on purpose: an arrow returning onReady(gl) would hand React the
  // renderer as a "cleanup function", which throws.
  React.useEffect(() => {
    onReady(gl);
  }, [gl, onReady]);
  return null;
}

function FpsMeter({ onFps }: { onFps: (n: number) => void }) {
  const frames = React.useRef(0);
  const elapsed = React.useRef(0);
  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < 0.5) return;
    onFps(Math.round(frames.current / elapsed.current));
    frames.current = 0;
    elapsed.current = 0;
  });
  return null;
}

function HumanReference() {
  return (
    <mesh position={[0, HUMAN_HEIGHT / 2, 0]}>
      <capsuleGeometry args={[HUMAN_RADIUS, HUMAN_HEIGHT - HUMAN_RADIUS * 2, 6, 12]} />
      <meshStandardMaterial color="#8fb4d9" transparent opacity={0.4} />
    </mesh>
  );
}

function BoundsBox({ size, center }: { size: [number, number, number]; center: [number, number, number] }) {
  return (
    <mesh position={center}>
      <boxGeometry args={size} />
      <meshBasicMaterial color="#e8b04a" wireframe transparent opacity={0.55} />
    </mesh>
  );
}

const PANEL: React.CSSProperties = {
  position: "absolute",
  top: 14,
  left: 14,
  zIndex: 10,
  width: 336,
  maxHeight: "calc(100vh - 28px)",
  overflowY: "auto",
  padding: 14,
  borderRadius: 10,
  background: "rgba(18,20,25,0.94)",
  border: "1px solid #2b2f38",
  color: "#e6e8ec",
  font: "13px/1.5 system-ui, sans-serif",
};

const FIELD: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  marginTop: 4,
  borderRadius: 6,
  border: "1px solid #3a3f4a",
  background: "#0e1014",
  color: "#e6e8ec",
  font: "12px/1.4 ui-monospace, monospace",
};

const BTN: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 6,
  border: "1px solid #3a3f4a",
  background: "#1b1e25",
  color: "#c3c7d0",
  font: "11px system-ui, sans-serif",
  cursor: "pointer",
};

const BTN_ON: React.CSSProperties = { ...BTN, background: "#2d4a63", borderColor: "#4a7fb0" };

const LABEL: React.CSSProperties = {
  display: "block",
  marginTop: 12,
  marginBottom: 2,
  color: "#8b8f99",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

export function ModelViewer() {
  const [source, setSource] = React.useState<Source | null>(null);
  const [urlDraft, setUrlDraft] = React.useState("");
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [scale, setScale] = React.useState(1);

  const [clip, setClip] = React.useState<string | null>(null);
  const [transport, setTransport] = React.useState<Transport>("stopped");
  const [speed, setSpeed] = React.useState(1);
  const [loop, setLoop] = React.useState(true);
  const [time, setTime] = React.useState(0);

  // Off by default: the reference capsule is a measuring stick, not scenery, so
  // an empty viewer should be empty. The "human" toggle below turns it on when
  // you actually want to judge an asset's scale against it.
  const [showHuman, setShowHuman] = React.useState(false);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showBox, setShowBox] = React.useState(false);
  const [showAxes, setShowAxes] = React.useState(false);
  const [wireframe, setWireframe] = React.useState(false);
  const [shadows, setShadows] = React.useState(true);
  const [autoRotate, setAutoRotate] = React.useState(false);
  const [fps, setFps] = React.useState(0);

  const [preset, setPreset] = React.useState<Preset>("fit");
  const [viewToken, setViewToken] = React.useState("init");

  const api = React.useRef<ModelApi | null>(null);
  const renderer = React.useRef<THREE.WebGLRenderer | null>(null);
  const current = React.useRef<Source | null>(null);

  const load = React.useCallback((next: Source) => {
    const previous = current.current;
    if (previous?.isBlob && previous.url !== next.url) {
      URL.revokeObjectURL(previous.url);
      useGLTF.clear(previous.url);
    }
    current.current = next;
    setSource(next);
    setStats(null);
    setError(null);
    setScale(1);
    setClip(null);
    setTransport("stopped");
    setTime(0);
  }, []);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src");
    if (!src) return;
    setUrlDraft(src);
    load({ url: src, label: src, isBlob: false });
    const preset = Number(params.get("scale"));
    if (Number.isFinite(preset) && preset > 0) setScale(preset);
  }, [load]);

  // First clip is selected and framed as soon as a model reports in.
  React.useEffect(() => {
    if (!stats) return;
    if (stats.clips.length && clip === null) {
      setClip(stats.clips[0].name);
      setTransport("playing");
    }
    setViewToken(`auto-${Date.now()}`);
  }, [stats, clip]);

  const loadFile = React.useCallback(
    (file: File) => {
      if (!/\.(glb|gltf)$/i.test(file.name)) {
        setError(`${file.name} is not a .glb or .gltf file`);
        return;
      }
      load({ url: URL.createObjectURL(file), label: file.name, isBlob: true });
    },
    [load],
  );

  const normalize = (target: number) => {
    if (!stats || stats.size[1] <= 0) return;
    setScale(target / stats.size[1]);
    setViewToken(`norm-${Date.now()}`);
  };

  const setView = (next: Preset) => {
    setPreset(next);
    setViewToken(`${next}-${Date.now()}`);
  };

  const snapshot = () => {
    const gl = renderer.current;
    if (!gl) return;
    const link = document.createElement("a");
    link.href = gl.domElement.toDataURL("image/png");
    link.download = `${(source?.label ?? "model").replace(/[^\w.-]+/g, "_")}.png`;
    link.click();
  };

  const scaled = stats ? (stats.size.map((v) => v * scale) as [number, number, number]) : null;
  const centerScaled = stats
    ? (stats.center.map((v) => v * scale) as [number, number, number])
    : ([0, 0.8, 0] as [number, number, number]);
  // Bounding-sphere radius, not half the tallest side — the diagonal is what
  // has to fit in frame when the camera sits off-axis.
  const radius = scaled ? Math.hypot(...scaled) * 0.5 : 1;
  const activeClip = stats?.clips.find((c) => c.name === clip) ?? null;
  const duration = activeClip?.duration ?? 0;

  return (
    <div
      style={{ position: "relative", width: "100%", height: "100%" }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) loadFile(file);
      }}
    >
      <div style={PANEL}>
        <strong style={{ fontSize: 14 }}>GLB inspector</strong>
        <p style={{ color: "#8b8f99", margin: "4px 0 0" }}>Drop a file anywhere, or load one below.</p>

        <input
          type="file"
          accept=".glb,.gltf,model/gltf-binary"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) loadFile(f);
          }}
          style={{ ...FIELD, padding: 6 }}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = urlDraft.trim();
            if (t) load({ url: t, label: t, isBlob: false });
          }}
        >
          <input
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            placeholder="…or paste a GLB url"
            style={FIELD}
          />
        </form>

        {error && <p style={{ marginTop: 10, color: "#e8907a" }}>Could not load: {error}</p>}

        {stats && (
          <>
            <span style={LABEL}>Animation</span>
            {stats.clips.length === 0 ? (
              <p style={{ color: "#8b8f99", margin: 0, fontSize: 12 }}>
                No clips in this file — it is a static mesh.
              </p>
            ) : (
              <>
                <select
                  value={clip ?? ""}
                  onChange={(e) => {
                    setClip(e.target.value);
                    setTransport("playing");
                    setTime(0);
                  }}
                  style={{ ...FIELD, marginTop: 0 }}
                >
                  {stats.clips.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name} · {fmt(c.duration)}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button
                    type="button"
                    style={transport === "playing" ? BTN_ON : BTN}
                    onClick={() => setTransport("playing")}
                  >
                    ▶ Play
                  </button>
                  <button
                    type="button"
                    style={transport === "paused" ? BTN_ON : BTN}
                    onClick={() => setTransport("paused")}
                  >
                    ⏸ Pause
                  </button>
                  <button
                    type="button"
                    style={transport === "stopped" ? BTN_ON : BTN}
                    onClick={() => {
                      setTransport("stopped");
                      setTime(0);
                    }}
                  >
                    ⏹ Stop
                  </button>
                </div>

                <input
                  type="range"
                  min={0}
                  max={Math.max(duration, 0.001)}
                  step={0.01}
                  value={Math.min(time, duration)}
                  onChange={(e) => {
                    const t = Number(e.target.value);
                    setTransport("paused");
                    api.current?.seek(t);
                  }}
                  style={{ width: "100%", marginTop: 10 }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    font: "11px ui-monospace, monospace",
                    color: "#8b8f99",
                  }}
                >
                  <span>{fmt(Math.min(time, duration))}</span>
                  <span>{fmt(duration)}</span>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
                  <span style={{ color: "#8b8f99", fontSize: 11 }}>speed</span>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.1}
                    value={speed}
                    onChange={(e) => setSpeed(Number(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ font: "11px ui-monospace, monospace" }}>{speed.toFixed(1)}×</span>
                </div>
                <label style={{ display: "block", marginTop: 6, color: "#c3c7d0", fontSize: 12 }}>
                  <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> loop
                </label>
              </>
            )}

            <span style={LABEL}>View</span>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["fit", "front", "right", "top"] as Preset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  style={preset === p ? BTN_ON : BTN}
                  onClick={() => setView(p)}
                >
                  {p}
                </button>
              ))}
              <button type="button" style={BTN} onClick={snapshot}>
                png
              </button>
            </div>

            <span style={LABEL}>Display</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, color: "#c3c7d0", fontSize: 12 }}>
              {(
                [
                  ["human", showHuman, setShowHuman],
                  ["grid", showGrid, setShowGrid],
                  ["bounds", showBox, setShowBox],
                  ["axes", showAxes, setShowAxes],
                  ["wireframe", wireframe, setWireframe],
                  ["shadows", shadows, setShadows],
                  ["spin", autoRotate, setAutoRotate],
                ] as [string, boolean, (v: boolean) => void][]
              ).map(([name, value, set]) => (
                <label key={name}>
                  <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} /> {name}
                </label>
              ))}
            </div>

            <span style={LABEL}>Measurements</span>
            <div style={{ color: "#8b8f99", marginBottom: 4, fontSize: 11 }}>{source?.label}</div>
            <table style={{ width: "100%", font: "12px/1.6 ui-monospace, monospace" }}>
              <tbody>
                <tr>
                  <td style={{ color: "#8b8f99" }}>size</td>
                  <td>
                    {scaled![0].toFixed(2)} × {scaled![1].toFixed(2)} × {scaled![2].toFixed(2)} m
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#8b8f99" }}>scale</td>
                  <td>×{scale.toFixed(4)}</td>
                </tr>
                <tr>
                  <td style={{ color: "#8b8f99" }}>tris</td>
                  <td>{stats.triangles.toLocaleString()}</td>
                </tr>
                <tr>
                  <td style={{ color: "#8b8f99" }}>meshes</td>
                  <td>
                    {stats.meshes} / {stats.materials} mat
                  </td>
                </tr>
                <tr>
                  <td style={{ color: "#8b8f99" }}>clips</td>
                  <td>{stats.clips.length || "none"}</td>
                </tr>
                <tr>
                  <td style={{ color: "#8b8f99" }}>fps</td>
                  <td>{fps}</td>
                </tr>
              </tbody>
            </table>

            <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {([["human 1.75 m", 1.75], ["table 0.75 m", 0.75], ["chair 0.9 m", 0.9]] as [string, number][]).map(
                ([label, target]) => (
                  <button key={label} type="button" style={BTN} onClick={() => normalize(target)}>
                    {label}
                  </button>
                ),
              )}
              <button
                type="button"
                style={BTN}
                onClick={() => {
                  setScale(1);
                  setViewToken(`reset-${Date.now()}`);
                }}
              >
                reset
              </button>
            </div>
            <p style={{ color: "#8b8f99", marginTop: 8, fontSize: 11 }}>
              Normalize, then bake the multiplier into the asset — the analyzer assumes metres.
            </p>
          </>
        )}
      </div>

      <Canvas
        // "percentage" = PCFShadowMap. R3F's default is PCFSoftShadowMap,
        // which three 0.186 removed — it warns and silently downgrades.
        shadows="percentage"
        gl={{ preserveDrawingBuffer: true }}
        camera={{ position: [2.6, 1.9, 3.2], fov: 45 }}
      >
        <color attach="background" args={["#15171c"]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 5, 2]} intensity={2.2} castShadow />
        <directionalLight position={[-3, 2, -2]} intensity={0.5} />

        <CaptureBridge onReady={(gl) => (renderer.current = gl)} />
        <FpsMeter onFps={setFps} />

        {showGrid && (
          <Grid
            args={[20, 20]}
            cellSize={1}
            cellColor="#2f3440"
            sectionSize={5}
            sectionColor="#454c5c"
            infiniteGrid
            fadeDistance={60}
          />
        )}
        {showAxes && <axesHelper args={[1]} />}
        {showHuman && <HumanReference />}
        {showBox && scaled && <BoundsBox size={scaled} center={centerScaled} />}

        {source && (
          <LoadBoundary resetKey={source.url} onError={setError}>
            <React.Suspense fallback={null}>
              <Model
                key={source.url}
                source={source}
                scale={scale}
                clip={clip}
                transport={transport}
                speed={speed}
                loop={loop}
                wireframe={wireframe}
                shadows={shadows}
                onStats={setStats}
                onTime={setTime}
                onApi={(a) => (api.current = a)}
              />
            </React.Suspense>
          </LoadBoundary>
        )}

        <ViewController token={viewToken} preset={preset} target={centerScaled} radius={radius} />
        <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
          <GizmoViewport axisColors={["#d46a6a", "#7fb069", "#6a8fd4"]} labelColor="#e6e8ec" />
        </GizmoHelper>
        <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.2} />
      </Canvas>
    </div>
  );
}

export default ModelViewer;
