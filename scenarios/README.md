# Scenarios

Eight practice service calls for one unit, the Carrier 24ACC636 air conditioner. Each file is a complete scenario brief: the hidden fault, the simulated homeowner, the results of every check, and how to score the trainee.

| File | Complaint | Hidden fault | Level |
| --- | --- | --- | --- |
| [failed-run-capacitor.json](failed-run-capacitor.json) | Running but blowing warm air | Compressor side of the dual run capacitor failed | Beginner |
| [open-contactor-coil.json](open-contactor-coil.json) | Outside unit does nothing | Contactor coil open | Beginner |
| [disconnect-off.json](disconnect-off.json) | Stopped after work outside | Outdoor disconnect left OFF | Beginner |
| [dirty-air-filter.json](dirty-air-filter.json) | Runs constantly, weak airflow | Clogged filter, frosted indoor coil | Beginner |
| [failed-outdoor-fan-motor.json](failed-outdoor-fan-motor.json) | Cools briefly, then warm | Outdoor fan motor open winding | Intermediate |
| [dirty-condenser-coil.json](dirty-condenser-coil.json) | Warm on hot afternoons only | Outdoor coil blocked with debris | Intermediate |
| [cut-thermostat-cable.json](cut-thermostat-cable.json) | Outside unit does nothing | Low-voltage cable cut | Intermediate |
| [low-refrigerant-charge.json](low-refrigerant-charge.json) | Runs nonstop, only slightly cool | Undercharged from a slow leak | Advanced |

The app reads every `.json` file in this folder at runtime (see `lib/manualScenarios.ts`). To add a scenario, add a file here in the same format; no code change is needed.

## How a scenario is used

- **`service_request`** is all the trainee sees at the start.
- **`homeowner`** drives the AI homeowner. It gives a persona, an opening line, facts to reveal only when asked, and a misleading suggestion. The homeowner must never name the fault.
- **`checks`** is the menu of simulated inspections and measurements. All eight scenarios share the same 22 checks, so the menu does not give the answer away; only the results differ. `requires` lists the safety steps that must come first, and `abnormal` marks results that differ from a healthy unit.
- **`expected_sequence`** and **`key_evidence`** are the reference path and the readings a good diagnosis should cite. Key evidence can include normal readings that rule out another cause.
- **`diagnosis`**, **`escalate_when`**, **`unsafe_actions`** and **`scoring`** feed the scorecard (safety, sequence, evidence, outcome; 25 points each).

## Where the numbers come from

Readings are grounded in [docs/sources/24ACC636-facts.md](../docs/sources/24ACC636-facts.md), and each check carries a `cite` to a manual page (PD, WD, SI, SM as defined there). Values the manuals do not give are listed in each file's `assumptions`, most importantly the 45/5 µF capacitor rating and the illustrative running-amp readings.

All measurements are simulated. These scenarios are for training and do not replace manufacturer instructions, codes, or qualified supervision.
