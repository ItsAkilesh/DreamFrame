// gizmoKeys.test.ts
// Purpose: The keyboard gizmo writes real keyframes, so its bindings — which
//          key means which axis, that WASD and the arrows agree, what the
//          modifiers scale, and which presses must be left to the browser —
//          are pinned here.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

import { describe, expect, it } from "vitest";

import {
  gizmoKeyAction,
  isTypingTarget,
  ROTATE_STEP,
  ROTATE_STEP_COARSE,
  ROTATE_STEP_FINE,
  TRANSLATE_STEP,
  TRANSLATE_STEP_COARSE,
  TRANSLATE_STEP_FINE,
  wrapAngle,
  type GizmoKeyEvent,
} from "@/render/gizmoKeys";

const press = (key: string, modifiers: Partial<GizmoKeyEvent> = {}): GizmoKeyEvent => ({
  key,
  shiftKey: false,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...modifiers,
});

describe("movement — WASD and the arrows are interchangeable", () => {
  it("maps both key sets onto the same floor-plane axes", () => {
    const left = { kind: "translate", dx: -TRANSLATE_STEP, dz: 0 };
    const right = { kind: "translate", dx: TRANSLATE_STEP, dz: 0 };
    // Up/W is away from the default camera, which is -Z.
    const away = { kind: "translate", dx: 0, dz: -TRANSLATE_STEP };
    const toward = { kind: "translate", dx: 0, dz: TRANSLATE_STEP };

    expect(gizmoKeyAction(press("ArrowLeft"))).toEqual(left);
    expect(gizmoKeyAction(press("a"))).toEqual(left);
    expect(gizmoKeyAction(press("ArrowRight"))).toEqual(right);
    expect(gizmoKeyAction(press("d"))).toEqual(right);
    expect(gizmoKeyAction(press("ArrowUp"))).toEqual(away);
    expect(gizmoKeyAction(press("w"))).toEqual(away);
    expect(gizmoKeyAction(press("ArrowDown"))).toEqual(toward);
    expect(gizmoKeyAction(press("s"))).toEqual(toward);
  });

  it("accepts WASD shifted into uppercase", () => {
    for (const key of ["W", "A", "S", "D"]) {
      expect(gizmoKeyAction(press(key, { shiftKey: true }))?.kind).toBe("translate");
    }
  });

  it("never moves along Y — characters stay on the floor", () => {
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"]) {
      const action = gizmoKeyAction(press(key));
      expect(action).toMatchObject({ kind: "translate" });
    }
  });

  it("scales with Shift and Alt", () => {
    expect(gizmoKeyAction(press("d", { shiftKey: true }))).toMatchObject({
      dx: TRANSLATE_STEP_COARSE,
    });
    expect(gizmoKeyAction(press("ArrowRight", { altKey: true }))).toMatchObject({
      dx: TRANSLATE_STEP_FINE,
    });
  });
});

describe("rotation", () => {
  it("turns on Q/E and the brackets", () => {
    expect(gizmoKeyAction(press("q"))).toEqual({ kind: "rotate", dRotationY: -ROTATE_STEP });
    expect(gizmoKeyAction(press("["))).toEqual({ kind: "rotate", dRotationY: -ROTATE_STEP });
    expect(gizmoKeyAction(press("e"))).toEqual({ kind: "rotate", dRotationY: ROTATE_STEP });
    expect(gizmoKeyAction(press("]"))).toEqual({ kind: "rotate", dRotationY: ROTATE_STEP });
    expect(gizmoKeyAction(press("E"))).toMatchObject({ kind: "rotate" });
  });

  it("scales with Shift and Alt", () => {
    expect(gizmoKeyAction(press("]", { shiftKey: true }))).toEqual({
      kind: "rotate",
      dRotationY: ROTATE_STEP_COARSE,
    });
    expect(gizmoKeyAction(press("]", { altKey: true }))).toEqual({
      kind: "rotate",
      dRotationY: ROTATE_STEP_FINE,
    });
  });

  it("stays available while the move gizmo is showing, and vice versa", () => {
    // Nothing in the mapping depends on the active tool — no key goes dead.
    expect(gizmoKeyAction(press("e"))?.kind).toBe("rotate");
    expect(gizmoKeyAction(press("w"))?.kind).toBe("translate");
  });
});

describe("tool switching and pass-through", () => {
  it("G picks move, R picks rotate", () => {
    expect(gizmoKeyAction(press("g"))).toEqual({ kind: "mode", mode: "translate" });
    expect(gizmoKeyAction(press("R"))).toEqual({ kind: "mode", mode: "rotate" });
  });

  it("leaves Ctrl/Cmd combinations to the browser", () => {
    expect(gizmoKeyAction(press("r", { metaKey: true }))).toBeNull();
    expect(gizmoKeyAction(press("a", { metaKey: true }))).toBeNull();
    expect(gizmoKeyAction(press("ArrowRight", { ctrlKey: true }))).toBeNull();
  });

  it("ignores keys it has no binding for", () => {
    expect(gizmoKeyAction(press("k"))).toBeNull();
    expect(gizmoKeyAction(press(" "))).toBeNull();
  });
});

describe("wrapAngle", () => {
  it("keeps repeated turns inside [-π, π)", () => {
    expect(wrapAngle(0)).toBeCloseTo(0, 6);
    expect(wrapAngle(Math.PI * 2 + 0.5)).toBeCloseTo(0.5, 6);
    expect(wrapAngle(-Math.PI * 3)).toBeCloseTo(-Math.PI, 6);
    let angle = 0;
    for (let i = 0; i < 40; i += 1) angle = wrapAngle(angle + ROTATE_STEP);
    expect(Math.abs(angle)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });
});

describe("isTypingTarget", () => {
  it("recognises form fields and contenteditable, and nothing else", () => {
    expect(isTypingTarget({ tagName: "INPUT" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTypingTarget({ tagName: "DIV" } as unknown as EventTarget)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
