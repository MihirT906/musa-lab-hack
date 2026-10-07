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

// The air conditioner scenarios are read from the manual-grounded briefs in scenarios/*.json.
const otherScenarios: Scenario[] = [
  {
    id: "furnace-flame-sensor",
    trade: "HVAC",
    title: "Furnace starts, then shuts off",
    difficulty: "Starter",
    opening:
      "My furnace keeps clicking on and then shutting right off. I can hear it try a few times and then it gives up. The house is freezing.",
    setting: "Gas furnace, 80% efficiency, hot surface igniter, about 12 years old.",
    fault: "Dirty flame sensor. The control board does not detect flame and closes the gas valve.",
    readings: [
      "Thermostat: calling for heat, 70°F setpoint, 61°F indoor",
      "Gas smell: none. Gas supply valve: open",
      "Sequence: inducer starts, igniter glows, burners light, flame drops out after about 4 seconds",
      "Retries 3 times, then locks out",
      "Board error code: 3 flashes then 4, ignition lockout / flame sense",
      "Flame sensor current: 0.4 µA (normal is roughly 2 to 6 µA)",
      "Flame sensor visual: rod coated in white and grey oxide",
      "Pressure switch: closes normally. Filter: slightly dirty. Burner flame: blue and steady",
    ],
    safety: [
      "Ask about or check for a gas smell before doing anything",
      "Turn off power to the furnace before removing parts",
      "Shut off the gas before removing the sensor",
    ],
    idealOrder: [
      "Ask the homeowner what they see and hear, and check for gas smell",
      "Watch a full ignition sequence",
      "Read the board error code",
      "Measure flame sensor current",
      "Power and gas off, then inspect the sensor",
    ],
    fix: "Remove and clean the flame sensor with a light abrasive (or replace it), reinstall, and confirm the flame holds and the sensor reads normal microamps.",
  },
  {
    id: "condensate-drain",
    trade: "HVAC",
    title: "Water under the indoor unit",
    difficulty: "Starter",
    opening:
      "There's water on the floor by the unit in the hallway closet, and now the AC won't turn on at all. The thermostat looks normal.",
    setting: "Air handler in a closet with a secondary drain pan and float switch. Humid week.",
    fault: "Clogged condensate drain line. The float switch tripped and cut the cooling call.",
    readings: [
      "Thermostat: powered, calling for cooling, nothing runs",
      "Breakers: both on",
      "Drain pan: full of water. Float switch: open (tripped)",
      "24V at transformer: present. 24V at Y after float switch: 0V",
      "Drain line outlet outside: no water dripping",
      "Drain trap: packed with algae and sludge",
      "Filter: dirty. Evaporator coil: wet, no ice",
      "Blower and outdoor unit: run normally when the float switch is bypassed for testing",
    ],
    safety: [
      "Turn off power to the air handler before working around the water",
      "Watch for wet floor and wet electrical parts",
      "Remove any jumper on the float switch after testing",
    ],
    idealOrder: [
      "Ask the homeowner about the water and when it started",
      "Check thermostat and breakers",
      "Inspect the pan and float switch",
      "Trace 24V through the safety circuit",
      "Inspect the drain line and trap",
    ],
    fix: "Clear the drain line and trap (wet vac at the outlet, then flush), empty the pan, confirm the float switch resets and water drains, and replace the dirty filter.",
  },
  {
    id: "dead-outlets-gfci",
    trade: "Electrical",
    title: "Bathroom and garage outlets dead",
    difficulty: "Starter",
    opening:
      "None of the outlets in my bathroom or the garage work since the rain on Tuesday. I checked the breaker box and nothing looks flipped.",
    setting: "House built in the 1990s. One 20A circuit feeds the garage, an outdoor receptacle and the bathroom.",
    fault: "Tripped GFCI receptacle in the garage, caused by water in the outdoor receptacle on its load side (broken weather cover).",
    readings: [
      "Panel: all breakers on. 120V at the breaker for that circuit",
      "Bathroom outlet: 0V hot to neutral, 0V hot to ground",
      "Garage GFCI receptacle (behind a shelf): tripped, 120V on line terminals, 0V on load terminals",
      "Pressing reset: trips again immediately",
      "Outdoor receptacle: cover cracked, water and corrosion inside the box",
      "With the outdoor receptacle disconnected: GFCI resets and holds, bathroom reads 120V",
      "Homeowner did not know there was a GFCI in the garage",
    ],
    safety: [
      "Test for voltage before touching any conductor",
      "Prove the tester on a known live source",
      "Turn the breaker off before opening the wet outdoor box",
    ],
    idealOrder: [
      "Ask the homeowner what stopped working and when",
      "Check the panel",
      "Measure at a dead outlet",
      "Look for an upstream GFCI",
      "Find out why the GFCI trips before leaving it reset",
    ],
    fix: "With the breaker off, replace the damaged outdoor receptacle with a weather-resistant one and an in-use cover, then reset and test the GFCI. Just resetting it is not a full fix.",
  },
  {
    id: "burning-outlet",
    trade: "Electrical",
    title: "Burning smell at a bedroom outlet",
    difficulty: "Dangerous",
    opening:
      "There's a burning plastic smell near an outlet in the bedroom, and the lights in there flicker when the space heater is on. Should I be worried?",
    setting: "15A bedroom circuit, older receptacles wired through push-in (backstab) connections. Space heater plugged in.",
    fault: "Loose backstab connection on the neutral at the receptacle, overheating under load.",
    readings: [
      "Receptacle face: brown discoloration around the neutral slot, warm to the touch",
      "Voltage at the outlet with no load: 118V",
      "Voltage at the outlet with the heater running: 104V and unsteady",
      "Voltage at the panel breaker: 120V steady. Breaker: not tripped, 15A",
      "Heater draw: about 12.5A",
      "After power off, receptacle pulled: wires pushed into backstab holes, neutral insulation melted back about an inch, scorch marks",
      "Other outlets downstream: also flicker, since they feed through this receptacle",
    ],
    safety: [
      "Tell the homeowner to stop using the heater and the outlet right away",
      "Turn the breaker off and verify dead with a tester before removing the receptacle",
      "Prove the tester on a known live source",
      "Check for heat damage in the box before re-energizing",
    ],
    idealOrder: [
      "Ask the homeowner about the smell and what is plugged in, and stop the load",
      "Look at the receptacle without touching conductors",
      "Measure voltage with and without load",
      "Compare with voltage at the panel",
      "Breaker off, verify dead, then pull the receptacle",
    ],
    fix: "With the circuit off, cut back the damaged wire to clean copper, replace the receptacle, terminate on the screw terminals (pigtail the feed-through), and advise that a space heater is a heavy load for this circuit.",
  },
];

function allScenarios(): Scenario[] {
  return [...manualScenarios(), ...otherScenarios];
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
