import { describe, expect, it } from "vitest";

import { buildExpressiveSpeechText, emotionalDeliveryTag } from "@/lib/voice/emotional-delivery";

describe("emotional delivery", () => {
  it("prefers the current line's action over the scene's general tone", () => {
    expect(
      emotionalDeliveryTag({
        action: "She answers warmly and squeezes his hand.",
        sceneContext: "An ominous confrontation",
      })
    ).toBe("warmly");
  });

  it("prefers the agent's explicit performance choice over inferred action", () => {
    expect(
      emotionalDeliveryTag({
        voiceDirection: "dryly",
        action: "He smiles warmly.",
        sceneContext: "playful",
      })
    ).toBe("dryly");
  });

  it("uses scene tone when a stage direction has no vocal signal", () => {
    expect(
      emotionalDeliveryTag({
        action: "He crosses the room.",
        sceneContext: "A tense and faintly ominous discovery",
      })
    ).toBe("nervously");
  });

  it("adds a v3 audio tag without changing the spoken dialogue", () => {
    expect(
      buildExpressiveSpeechText("I thought you had left.", { action: "she whispers, afraid" })
    ).toBe("[whispering] I thought you had left.");
  });

  it("leaves neutral dialogue untagged", () => {
    expect(buildExpressiveSpeechText("The door is open.", { action: "He points to the door." })).toBe(
      "The door is open."
    );
  });
});
