// emotional-delivery.ts
// Purpose: Converts the simulation's stage direction and scene tone into a
//          short Eleven v3 audio tag. The direction is intentionally chosen
//          from a small, deterministic vocabulary: model-generated stage
//          directions must never become arbitrary TTS control markup, and a
//          single focused cue produces a more natural read than a pile of
//          conflicting adjectives.

export interface EmotionalDeliveryContext {
  voiceDirection?: string | null;
  action?: string | null;
  sceneContext?: string | null;
}

export const VOICE_DIRECTIONS = [
  "neutral",
  "whispering",
  "shouting",
  "with restrained anger",
  "fearfully",
  "tearfully",
  "nervously",
  "hesitantly",
  "dryly",
  "playfully",
  "excitedly",
  "laughing softly",
  "warmly",
  "sadly",
  "confidently",
  "warily",
  "gravely",
  "calmly",
  "with relief",
  "curiously",
  "in surprise",
  "wearily",
] as const;

interface DeliveryRule {
  pattern: RegExp;
  tag: string;
}

// More specific/intense performances come first. Scene tone is only a
// fallback because the per-line action describes what the actor is doing now.
const DELIVERY_RULES: DeliveryRule[] = [
  { pattern: /\b(whisper|whispers|whispering|hushed|under (?:his|her|their) breath)\b/i, tag: "whispering" },
  { pattern: /\b(shout|shouts|shouting|yell|yells|yelling|scream|screams|screaming)\b/i, tag: "shouting" },
  { pattern: /\b(furious|furiously|rage|enraged|angry|angrily|snaps?|hostile)\b/i, tag: "with restrained anger" },
  { pattern: /\b(terrified|panicked|panic|fearful|afraid|frightened|trembling)\b/i, tag: "fearfully" },
  { pattern: /\b(crying|cries|sobbing|sob|tearful|heartbroken|grief|grieving)\b/i, tag: "tearfully" },
  { pattern: /\b(nervous|nervously|anxious|anxiously|uneasy|uneasily|tense|tensely)\b/i, tag: "nervously" },
  { pattern: /\b(hesitant|hesitantly|uncertain|uncertainly|falters?|stammers?|reluctant)\b/i, tag: "hesitantly" },
  { pattern: /\b(sarcastic|sarcastically|dryly|wryly|deadpan)\b/i, tag: "dryly" },
  { pattern: /\b(teasing|teases|playful|playfully|mischievous|mischievously|flirtatious|flirts?)\b/i, tag: "playfully" },
  { pattern: /\b(excited|excitedly|thrilled|eager|eagerly|delighted|joyful|joyfully|celebrat)\w*\b/i, tag: "excitedly" },
  { pattern: /\b(laugh|laughs|laughing|chuckle|chuckles|chuckling|giggle|giggles|giggling)\b/i, tag: "laughing softly" },
  { pattern: /\b(tender|tenderly|gentle|gently|softly|warm|warmly|affectionate|loving|sincere|sincerely)\b/i, tag: "warmly" },
  { pattern: /\b(sad|sadly|somber|somberly|melancholy|regretful|regretfully|dejected)\b/i, tag: "sadly" },
  { pattern: /\b(confident|confidently|firm|firmly|determined|determinedly|defiant|defiantly)\b/i, tag: "confidently" },
  { pattern: /\b(suspicious|suspiciously|cautious|cautiously|guarded|warily|wary)\b/i, tag: "warily" },
  { pattern: /\b(ominous|ominously|grave|gravely|serious|seriously|threatening|menacing)\b/i, tag: "gravely" },
  { pattern: /\b(calm|calmly|reassuring|reassuringly|relaxed|steadily)\b/i, tag: "calmly" },
  { pattern: /\b(relief|relieved|reassured)\b/i, tag: "with relief" },
  { pattern: /\b(curious|curiously|inquisitive|questioning)\b/i, tag: "curiously" },
  { pattern: /\b(surprised|surprise|shocked|startled|astonished)\b/i, tag: "in surprise" },
  { pattern: /\b(bored|boredom|weary|wearily|tired|tiredly|exhausted)\b/i, tag: "wearily" },
];

function matchDelivery(value: string | null | undefined): string | null {
  if (!value) return null;
  return DELIVERY_RULES.find((rule) => rule.pattern.test(value))?.tag ?? null;
}

export function emotionalDeliveryTag({
  voiceDirection,
  action,
  sceneContext,
}: EmotionalDeliveryContext): string | null {
  if (voiceDirection === "neutral") return null;
  if (
    voiceDirection &&
    VOICE_DIRECTIONS.includes(voiceDirection as (typeof VOICE_DIRECTIONS)[number])
  ) {
    return voiceDirection;
  }
  return matchDelivery(action) ?? matchDelivery(sceneContext);
}

export function buildExpressiveSpeechText(text: string, context: EmotionalDeliveryContext): string {
  const tag = emotionalDeliveryTag(context);
  return tag ? `[${tag}] ${text}` : text;
}
