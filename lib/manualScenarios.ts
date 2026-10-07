import type { Scenario } from "./scenarios";
import failedRunCapacitor from "../scenarios/failed-run-capacitor.json";
import openContactorCoil from "../scenarios/open-contactor-coil.json";
import disconnectOff from "../scenarios/disconnect-off.json";
import dirtyAirFilter from "../scenarios/dirty-air-filter.json";
import failedOutdoorFanMotor from "../scenarios/failed-outdoor-fan-motor.json";
import dirtyCondenserCoil from "../scenarios/dirty-condenser-coil.json";
import cutThermostatCable from "../scenarios/cut-thermostat-cable.json";
import lowRefrigerantCharge from "../scenarios/low-refrigerant-charge.json";

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

export const manualScenarios: Scenario[] = (
  [
    failedRunCapacitor,
    openContactorCoil,
    disconnectOff,
    dirtyAirFilter,
    failedOutdoorFanMotor,
    dirtyCondenserCoil,
    cutThermostatCable,
    lowRefrigerantCharge,
  ] as Brief[]
).map(toScenario);
