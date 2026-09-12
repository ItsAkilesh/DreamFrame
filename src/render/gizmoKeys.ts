// gizmoKeys.ts
// Purpose: Keyboard bindings for the Editor View's pose gizmo — WASD or the
//          arrows nudge the selected character across the floor, Q/E or the
//          brackets turn them, G/R switch the on-screen gizmo. Pure mapping
//          (key + modifiers -> an action), so the bindings are unit-testable
//          and the component keeps only the wiring.
// Author: shreyag.coder <2002sgupta@gmail.com>
// Date: 2026-09-12

export type GizmoMode = "translate" | "rotate";

/** The parts of a KeyboardEvent the bindings actually read. */
export interface GizmoKeyEvent {
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

export type GizmoKeyAction =
  | { kind: "translate"; dx: number; dz: number }
  | { kind: "rotate"; dRotationY: number }
  | { kind: "mode"; mode: GizmoMode };

// Metres per press. Plain is a readable nudge, Shift strides, Alt inches —
// the plain step is a multiple of the gizmo's own 0.05 translation snap so
// dragging and nudging land on the same grid.
export const TRANSLATE_STEP = 0.1;
export const TRANSLATE_STEP_COARSE = 0.5;
export const TRANSLATE_STEP_FINE = 0.02;

// Radians per press: 15°, 45° with Shift, 5° with Alt.
export const ROTATE_STEP = Math.PI / 12;
export const ROTATE_STEP_COARSE = Math.PI / 4;
export const ROTATE_STEP_FINE = Math.PI / 36;

const translateStep = (event: GizmoKeyEvent): number =>
  event.shiftKey ? TRANSLATE_STEP_COARSE : event.altKey ? TRANSLATE_STEP_FINE : TRANSLATE_STEP;

const rotateStep = (event: GizmoKeyEvent): number =>
  event.shiftKey ? ROTATE_STEP_COARSE : event.altKey ? ROTATE_STEP_FINE : ROTATE_STEP;

/** Keep a facing in [-π, π) so repeated turns can't wander off to ±40 rad. */
export function wrapAngle(radians: number): number {
  const twoPi = Math.PI * 2;
  return ((((radians + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
}

/**
 * The action a keypress means for the gizmo, or null to leave the event alone.
 *
 * WASD and the arrows both slide the character across the floor, and Q/E and
 * the brackets both turn them — movement and facing are always live, so
 * neither costs a tool switch and no key goes dead depending on which gizmo
 * is showing. G and R still swap the on-screen gizmo for pointer dragging.
 *
 * Movement is along world axes, not the orbit camera's — with the default
 * framing W reads as "away from you", but after orbiting behind the set it
 * still means -Z.
 */
export function gizmoKeyAction(event: GizmoKeyEvent): GizmoKeyAction | null {
  // Leave browser and OS shortcuts (Cmd-R, Ctrl-arrow desktop switching…) alone.
  if (event.ctrlKey || event.metaKey) return null;

  const move = translateStep(event);
  const turn = rotateStep(event);

  switch (event.key) {
    case "ArrowLeft":
    case "a":
    case "A":
      return { kind: "translate", dx: -move, dz: 0 };
    case "ArrowRight":
    case "d":
    case "D":
      return { kind: "translate", dx: move, dz: 0 };
    // Up/W is "further from camera" in the default framing: -Z (§3.1's back wall).
    case "ArrowUp":
    case "w":
    case "W":
      return { kind: "translate", dx: 0, dz: -move };
    case "ArrowDown":
    case "s":
    case "S":
      return { kind: "translate", dx: 0, dz: move };
    case "[":
    case "q":
    case "Q":
      return { kind: "rotate", dRotationY: -turn };
    case "]":
    case "e":
    case "E":
      return { kind: "rotate", dRotationY: turn };
    case "g":
    case "G":
      return { kind: "mode", mode: "translate" };
    case "r":
    case "R":
      return { kind: "mode", mode: "rotate" };
    default:
      return null;
  }
}

/** True when the keypress belongs to whatever the user is typing in. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element || !element.tagName) return false;
  if (element.isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName);
}
