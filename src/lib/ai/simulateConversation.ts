// simulateConversation.ts
// Purpose: Turn-by-turn multi-agent scene simulation. Each character is an
//          independent agent — not a fixed round-robin script. Instead of
//          "character 0, 1, 2, 0, 1, 2, ...", every character has its own
//          jittered schedule (a priority queue, not real timers — this runs
//          inside one bounded API call, not a live browser tab), and reacting
//          to something pulls the OTHER characters' next opportunity sooner,
//          the way a real reply does. A character is also free to decide NOT
//          to react at all — silence is a valid outcome, not a bug.
//
//          Each character's physical reaction is picked directly from the
//          asset library's DISTINCT labeled clip names via a strict-schema
//          enum (structured outputs), not free text matched after the fact —
//          the model can only ever choose a clip that genuinely exists, so
//          there's no possibility of the "locks the front door" -> "Front
//          Flip" false match a keyword-matcher produced (found during an
//          earlier pass at this same feature). `reason` is separate, short
//          free text purely for the caption; it never drives clip selection.
//
//          Inspired by a sibling hackathon project's (ReDream) capability-
//          schema decisions and independent-heartbeat scheduling, adapted to
//          this app's bounded, saveable "take" model: ReDream's agents live
//          indefinitely in an open browser tab with no save concept at all;
//          this still needs to terminate and persist a SimulationRun so the
//          rest of the app (judge scoring, past-runs list, "Watch in 3D")
//          keeps working unchanged.
// Author: akilesh@vigilnz.com
// Date: 2026-09-12

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

import { loadLabeledAnimations } from "@/lib/animation-match";
import { openai, SIMULATION_MODEL } from "@/lib/openai";
import type { Character } from "@/lib/types";

const MAX_TURNS = 16; // accepted (react:true) turns
const MAX_THINK_ATTEMPTS = 40; // bounds total LLM calls even if most decline to react
const MAX_WALL_MS = 90_000; // this runs inside one bounded API route, not a live tab

// Jitter matches the sibling project's own formula (0.6-1.4x base) — keeps
// characters' schedules from ever landing exactly in sync.
const BASE_INTERVAL = 100;
const JITTER_MIN = 0.6;
const JITTER_RANGE = 0.8;
// When a character reacts, every other character's next opportunity is
// pulled at least this much closer — "something just happened" nudges
// everyone toward considering a response soon, without forcing one.
const REACT_PULL = BASE_INTERVAL * 0.5;

const EMOTION_AXES = ["joy", "curiosity", "unease", "boredom", "affection", "surprise"] as const;
type EmotionAxis = (typeof EMOTION_AXES)[number];
type EmotionVector = Record<EmotionAxis, number>;
const EMOTION_BASELINE: EmotionVector = {
  joy: 0.45,
  curiosity: 0.4,
  unease: 0.15,
  boredom: 0.35,
  affection: 0.3,
  surprise: 0.1,
};

function clampEmotions(v: Partial<Record<string, number>>): EmotionVector {
  const out = { ...EMOTION_BASELINE };
  for (const axis of EMOTION_AXES) {
    const value = v[axis];
    if (typeof value === "number") out[axis] = Math.min(1, Math.max(0, value));
  }
  return out;
}

interface MemoryEntry {
  kind: "say" | "perceive" | "feel";
  actor: string;
  text: string;
}

const MEMORY_TAIL = 12; // recent entries fed into a character's own prompt

interface AgentState {
  character: Character;
  stream: MemoryEntry[];
  emotions: EmotionVector;
  dueAt: number;
}

export interface SimulationTurnResult {
  characterId: string;
  text: string;
  // Short free-text flavor for the caption (e.g. "relieved, sits back down")
  // — display only, never used to pick the animation.
  action: string;
  // The asset library's "animation" category id (its filename), resolved
  // directly from the character's enum-constrained clip-name choice — always
  // either a real playable clip or null ("none"), never a guessed match.
  animationAssetId: string | null;
}

interface SimulateConversationOptions {
  scene: { title: string; text: string; toneTarget: string };
  characters: Character[];
}

function jitteredInterval(): number {
  return BASE_INTERVAL * (JITTER_MIN + Math.random() * JITTER_RANGE);
}

function actDecisionSchema(emoteNames: string[]) {
  const emoteEnum = (emoteNames.length > 0 ? ["none", ...emoteNames] : ["none"]) as [string, ...string[]];
  return z.object({
    react: z.boolean(),
    reason: z.string(),
    line: z.string().nullable(),
    emote: z.enum(emoteEnum),
    emotions: z.object(Object.fromEntries(EMOTION_AXES.map((axis) => [axis, z.number()]))),
  });
}

function renderStreamLine(agent: AgentState, entry: MemoryEntry): string {
  const isSelf = entry.actor === agent.character.name;
  switch (entry.kind) {
    case "say":
      return isSelf ? `You said: "${entry.text}"` : `${entry.actor} said: "${entry.text}"`;
    case "perceive":
      return `(you noticed ${entry.actor} act: ${entry.text})`;
    case "feel":
      return `(you felt ${entry.text})`;
  }
}

function buildSystemPrompt(
  agent: AgentState,
  others: AgentState[],
  scene: SimulateConversationOptions["scene"],
  emoteNames: string[]
): string {
  const character = agent.character;
  const otherLines = others.map((o) => `- ${o.character.name}: ${o.character.motivation}`).join("\n");

  return `You are playing ${character.name} in a live-improvised scene. Stay completely in character.

Your motivation: ${character.motivation}
Your traits: ${character.traits.join(", ") || "none specified"}
Your baseline emotional state: ${character.baselineEmotion}
Your current feelings (0-1 each): ${JSON.stringify(agent.emotions)}

Other characters in the scene:
${otherLines || "(none)"}

SCENE: ${scene.title}
CONTEXT: ${scene.text}
TONE: ${scene.toneTarget || "unspecified"}

Something may have happened — decide whether YOU would react to it right now. It is completely fine, and often more realistic, NOT to react: you might not have anything to add, might not notice, or might be letting someone else speak. Never speak for another character, and never break character to comment on the scene itself.

If you do react: give one short line of dialogue (or set "line" to null for a purely physical/wordless beat), a brief present-tense flavor note in "reason" (a few words, for a stage direction — not read aloud), and pick "emote" from the exact list below, or "none" if nothing fits.
Valid emotes: ${emoteNames.join(", ") || "(none available yet)"}, or "none".

Also report your updated feelings (0-1) on: ${EMOTION_AXES.join(", ")}.`;
}

function buildUserPrompt(agent: AgentState): string {
  const tail = agent.stream.slice(-MEMORY_TAIL);
  if (tail.length === 0) return "(the scene has not started yet — you may go first, or hold back and let someone else)";
  return `RECENT:\n${tail.map((entry) => renderStreamLine(agent, entry)).join("\n")}\n\nWhat do you do?`;
}

async function think(
  agent: AgentState,
  others: AgentState[],
  scene: SimulateConversationOptions["scene"],
  emoteNames: string[]
) {
  const response = await openai.responses.parse({
    model: SIMULATION_MODEL,
    input: [
      { role: "system", content: buildSystemPrompt(agent, others, scene, emoteNames) },
      { role: "user", content: buildUserPrompt(agent) },
    ],
    text: { format: zodTextFormat(actDecisionSchema(emoteNames), "agent_act") },
  });

  return response.output_parsed;
}

export async function* simulateConversation(
  options: SimulateConversationOptions
): AsyncGenerator<SimulationTurnResult> {
  const { scene, characters } = options;
  if (characters.length === 0) {
    throw new Error("simulateConversation: no characters to simulate");
  }

  // Loaded once for the whole run, not once per turn — see loadLabeledAnimations's
  // own header for why re-scanning the library per turn would be wasteful.
  const labeledAnimations = await loadLabeledAnimations();
  const emoteNames = [...new Set(labeledAnimations.map((asset) => asset.name))];
  const emoteToAssetId = new Map<string, string>();
  for (const asset of labeledAnimations) {
    if (!emoteToAssetId.has(asset.name)) emoteToAssetId.set(asset.name, asset.id);
  }

  const agents: AgentState[] = characters.map((character, i) => ({
    character,
    stream: [],
    emotions: { ...EMOTION_BASELINE },
    // Stagger starting priorities so the scene opens promptly (agent 0 goes
    // almost immediately) without every agent being exactly tied at t=0.
    dueAt: i * BASE_INTERVAL * 0.3 + jitteredInterval(),
  }));

  let turnCount = 0;
  let attempts = 0;
  const startedAt = Date.now();

  while (turnCount < MAX_TURNS && attempts < MAX_THINK_ATTEMPTS && Date.now() - startedAt < MAX_WALL_MS) {
    agents.sort((a, b) => a.dueAt - b.dueAt);
    const agent = agents[0];
    const others = agents.filter((a) => a !== agent);
    attempts++;

    const decision = await think(agent, others, scene, emoteNames);

    // This character's own next opportunity, regardless of outcome — an
    // agent who declines still waits its normal jittered interval, same as
    // one who spoke.
    agent.dueAt += jitteredInterval();

    if (!decision) continue; // model declined (refusal) — treat as "doesn't react" this round

    agent.emotions = clampEmotions(decision.emotions);

    if (!decision.react || !decision.line) continue;

    agent.stream.push({ kind: "say", actor: agent.character.name, text: decision.line });
    for (const other of others) {
      other.stream.push({ kind: "perceive", actor: agent.character.name, text: decision.line });
      // Something just happened nearby — pull their next opportunity
      // forward, without forcing an immediate reply (still competes with
      // their own jitter and whatever else pulls them).
      other.dueAt = Math.min(other.dueAt, agent.dueAt - REACT_PULL);
    }

    const emoteName = decision.emote !== "none" ? decision.emote : null;
    turnCount++;
    yield {
      characterId: agent.character.id,
      text: decision.line,
      action: decision.reason,
      animationAssetId: emoteName ? (emoteToAssetId.get(emoteName) ?? null) : null,
    };
  }
}
