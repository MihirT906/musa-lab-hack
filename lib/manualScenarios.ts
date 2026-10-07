import { readdirSync, readFileSync } from "fs";
import path from "path";
import type { Scenario } from "./scenarios";

// Shape of the manual-grounded briefs in scenarios/*.json (see scenarios/README.md).
type Brief = {
  id: string;
  public_title: string;
  difficulty: string;
  equipment: { make: string; model: string; description: string };
  conditions: { outdoor_temp_f: number; indoor_temp_f: number };
  hidden_fault: { description: string };
  homeowner: { name: string; persona: string; opening_line: string; reveals_if_asked: string[]; red_herring: string };
  checks: { id: string; label: string; requires: string[]; result: string }[];
  expected_sequence: string[];
  diagnosis: { repair: string };
  escalate_when: string;
  unsafe_actions: { action: string }[];
};

const LOCKOUT = "Turn off the disconnect, lock out and tag it, and verify zero voltage before any power-off check";
const DISCHARGE = "Discharge the capacitor with a 15,000-ohm, 2-watt resistor before touching or testing it";

function prerequisite(requires: string[]): string {
  if (requires.includes("cap_discharge")) return " (unsafe unless power is locked out and the capacitor is discharged first)";
  if (requires.includes("lockout")) return " (unsafe unless power is locked out and verified dead first)";
  return "";
}

function toScenario(b: Brief): Scenario {
  const label = new Map(b.checks.map((c) => [c.id, c.label]));
  const safety = [
    ...(b.expected_sequence.includes("lockout") ? [LOCKOUT] : []),
    ...(b.expected_sequence.includes("cap_discharge") ? [DISCHARGE] : []),
    `Stop and escalate: ${b.escalate_when}`,
    ...b.unsafe_actions.map((u) => `Never: ${u.action}`),
  ];
  return {
    id: b.id,
    trade: "HVAC",
    title: b.public_title,
    difficulty: b.difficulty === "beginner" ? "Starter" : "Intermediate",
    opening: b.homeowner.opening_line,
    setting:
      `${b.equipment.make} ${b.equipment.model}: ${b.equipment.description}. ` +
      `${b.conditions.outdoor_temp_f}°F outside, ${b.conditions.indoor_temp_f}°F inside. ` +
      `The homeowner is ${b.homeowner.name}. ${b.homeowner.persona} ` +
      `Things the homeowner knows and shares only when asked about them: ${b.homeowner.reveals_if_asked.join(" ")} ` +
      `If asked what they think is wrong, the homeowner says: "${b.homeowner.red_herring}"`,
    fault: b.hidden_fault.description,
    readings: b.checks.map((c) => `${c.label}${prerequisite(c.requires)}: ${c.result}`),
    safety,
    idealOrder: [
      "Ask the homeowner about symptoms and history",
      ...b.expected_sequence.map((id) => label.get(id) ?? id),
    ],
    fix: b.diagnosis.repair,
  };
}

const LEVELS = ["beginner", "intermediate", "advanced"];

// Reads every brief in scenarios/ on each call, so adding or editing a JSON file
// there changes the app without touching code. Server only.
export function manualScenarios(): Scenario[] {
  const dir = path.join(process.cwd(), "scenarios");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")) as Brief)
    .sort((a, b) => LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty))
    .map(toScenario);
}
