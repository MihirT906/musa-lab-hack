import { manualScenarios } from "./manualScenarios";

export type PublicScenario = {
  id: string;
  trade: "HVAC" | "Electrical";
  title: string;
  difficulty: "Starter" | "Intermediate" | "Dangerous";
  opening: string;
};

export type Scenario = PublicScenario & {
  // Everything below stays on the server. The trainee never sees it.
  setting: string;
  fault: string;
  readings: string[];
  safety: string[];
  idealOrder: string[];
  fix: string;
};

// Scenarios are read from the manual-grounded briefs in scenarios/*.json.
function allScenarios(): Scenario[] {
  return manualScenarios();
}

export function getScenario(id: string): Scenario | undefined {
  return allScenarios().find((s) => s.id === id);
}

export function publicScenarios(): PublicScenario[] {
  return allScenarios().map(({ id, trade, title, difficulty, opening }) => ({
    id,
    trade,
    title,
    difficulty,
    opening,
  }));
}

export function simulatorPrompt(s: Scenario): string {
  return `You run a service-call training simulation for a ${s.trade} trainee. You play two parts:

1. HOMEOWNER: a regular person with no trade knowledge. Speak plainly, answer only what is asked, and never use technical terms.
2. EQUIPMENT: when the trainee says they inspect, test or measure something, report what they find.

Start each part of your reply with "Homeowner:" or "Reading:" on its own line. Use both only when both apply.

The homeowner already opened the call with: "${s.opening}"

SETTING: ${s.setting}
HIDDEN FAULT (never state it): ${s.fault}
KNOWN READINGS:
- ${s.readings.join("\n- ")}

Rules:
- Give a reading only when the trainee asks for that specific check. One check per request.
- For checks not listed, give a realistic normal value consistent with the hidden fault.
- Never name the fault, hint at it, coach, or suggest the next step.
- If the trainee does something unsafe (for example touches live parts without shutting off power), add a line starting "Safety:" that briefly says what went wrong, then continue.
- If the trainee states a diagnosis or a repair, reply as the homeowner would ("OK, go ahead") without confirming whether it is right.
- Keep every reply under 70 words.`;
}

export function graderPrompt(s: Scenario): string {
  return `You grade a ${s.trade} trainee on a simulated service call. Be fair and specific, and base every point on the transcript only.

SCENARIO: ${s.title}
ACTUAL FAULT: ${s.fault}
CORRECT FIX: ${s.fix}
EXPECTED SAFETY STEPS:
- ${s.safety.join("\n- ")}
SENSIBLE DIAGNOSTIC ORDER:
- ${s.idealOrder.join("\n- ")}

Score three areas from 0 to 100:
- safety: did the trainee state the safety steps before the risky actions? Unsafe actions cost heavily.
- order: did they go from simple and likely checks to specific ones, without guessing or swapping parts blindly?
- fix: did they name the actual fault and a complete, correct repair? No stated diagnosis means 0.

Reply with JSON only, no markdown, in exactly this shape:
{"safety":{"score":0,"note":""},"order":{"score":0,"note":""},"fix":{"score":0,"note":""},"summary":"","nextTime":["",""]}

Each note is one sentence. summary is two sentences and may reveal the actual fault. nextTime has two or three short tips.`;
}
