# FieldReady

**Practice the service call before it is real.**

FieldReady is an AI-powered troubleshooting simulator for people learning HVAC and electrical service work. A trainee talks with an AI homeowner, asks diagnostic questions, chooses simulated checks, interprets the readings, and explains a repair. They can repeat realistic fault scenarios without needing a live customer or energized equipment.

## Who It Is For

Trade students, apprentices, instructors, and employers who need a repeatable way to practice diagnostic judgment. Instructors can use scenarios to give learners more reps between hands-on lab sessions; service teams can use them to reinforce a consistent, safety-first diagnostic process.

## A Practice Call

1. The trainee receives a service request, such as an air conditioner blowing warm air.
2. They interview the simulated homeowner to learn the symptoms and history.
3. They choose a safe inspection or simulated measurement. The scenario returns a result that fits the underlying fault.
4. They identify the likely cause, cite the evidence, and recommend a repair.
5. They receive feedback on safety, diagnostic order, use of evidence, and the proposed fix.

Scenarios can vary the homeowner's account and the measurements while keeping the underlying fault consistent. This lets learners practice reasoning rather than memorizing a single answer.

## What It Trains

- Asking useful questions and narrowing down symptoms
- Choosing diagnostic steps in a sensible order
- Interpreting readings in the context of the complaint
- Prioritizing safety and recognizing when to stop and escalate
- Explaining a diagnosis and repair clearly

The simulator is for training, not a substitute for qualified supervision, manufacturer instructions, applicable codes, or real equipment procedures. Measurements and equipment states are simulated; the product must not direct learners to perform unsafe live work.

## Why Simulation

Learners can get additional practice with uncommon or high-risk fault patterns without creating a hazardous fault on real equipment. A simulated customer also gives them room to practice communication and decision-making, not just identify a component from a diagram. The initial experience is conversational, so adding tactile practice with real tools remains an opportunity for future development.

## Hackathon MVP

The intended first version is a focused service-call loop:

- One HVAC complaint and one clearly defined fault
- AI homeowner responses grounded in a scenario brief
- A small menu of simulated readings and inspection results
- A diagnosis and repair recommendation from the trainee
- A short scorecard covering safety, diagnostic sequence, evidence, and outcome

This repository contains a working Next.js simulator with six scenarios (four HVAC, two electrical).

## Run It Locally

1. Install Node.js 18.18 or newer.
2. Run `npm install`.
3. Copy `.env.local.example` to `.env.local` and add one key: `GEMINI_API_KEY` (free tier, https://aistudio.google.com/apikey) or `ANTHROPIC_API_KEY` (https://console.anthropic.com).
4. Run `npm run dev` and open http://localhost:3000.

Pick a scenario on the left (or Shuffle scenario), talk to the homeowner and state your checks in the chat, then press Finish and get score.

## Code Map

- `lib/scenarios.ts`: scenarios, hidden faults, readings, and the simulator prompt
- `lib/llm.ts`: model call (Gemini or Claude, chosen by which key is set)
- `lib/grading/`: rule-based grading layer (adapters, grader, structured answer keys)
- `app/api/chat/route.ts`: homeowner and equipment agent
- `app/api/grade/route.ts`: POST endpoint that returns a Scorecard JSON
- `app/Simulator.tsx`, `app/globals.css`: glassmorphism UI; the mic button is a placeholder for voice

## Grading layer

The grader sits between the scenario answer key and the UI session log. It is **rule-based and deterministic** (no LLM).

### Inputs

**Answer key** (structured JSON in `lib/grading/answerKeys/<scenarioId>.json`):

- `actions` — stable action ids with kind, safety flags, and optional `irrelevant`
- `requiredSafety` — must complete before any check with `requiresSafetyBefore: true`
- `orderingRules` — A-before-B pairs with trainee-facing messages
- `keyEvidence` — readings that prove the fault
- `diagnosis` / `repair` — correct and partial match strings with credit

The free-text fields in `lib/scenarios.ts` are for the simulator agent. Grading uses the structured keys above so format changes stay in adapters.

**Session log** (what the UI should POST to `/api/grade`):

```json
{
  "scenarioId": "ac-capacitor",
  "events": [
    { "type": "question", "actionId": "ask_symptoms" },
    { "type": "check", "actionId": "observe_outdoor_unit" },
    { "type": "safety", "actionId": "power_off_disconnect" },
    { "type": "cite_evidence", "actionId": "observe_outdoor_unit" },
    { "type": "diagnosis", "value": "Failed dual run capacitor" },
    { "type": "repair", "value": "Replace the dual run capacitor with 45/5 µF" }
  ]
}
```

Event types: `safety` | `question` | `check` | `cite_evidence` | `diagnosis` | `repair`.

### Scoring (weights in `lib/grading/config.ts`)

| Category | Max | Rules |
| --- | --- | --- |
| Safety | 35 | Required safety steps before hands-on electrical checks. Skipping one is a **critical** violation: safety = 0 and the session fails. |
| Diagnostic sequence | 25 | Deductions for violated A-before-B rules; small capped deduction for irrelevant checks. Extra safety steps are never penalized. |
| Use of evidence | 20 | Key readings taken; cited evidence must appear earlier in the log. Correct diagnosis with no supporting readings loses evidence (lucky guess). |
| Outcome | 20 | Diagnosis (10) + repair (10), with partial credit from the answer key. |

Pass: no critical safety violation, session not empty, and total ≥ 60.

### Output (Scorecard)

Example: `lib/grading/example-scorecard.json`

```json
{
  "scenarioId": "ac-capacitor",
  "categories": {
    "safety": { "score": 0, "max": 35 },
    "sequence": { "score": 15, "max": 25 },
    "evidence": { "score": 10, "max": 20 },
    "outcome": { "score": 20, "max": 20 }
  },
  "total": 45,
  "maxTotal": 100,
  "passed": false,
  "findings": [
    {
      "category": "safety",
      "severity": "critical",
      "message": "De-energize and verify before handling components: missing or late step — Shut off power at the outdoor disconnect before opening the panel.",
      "event_index": 1
    }
  ]
}
```

### API for the UI

- `POST /api/grade` with the session JSON above → Scorecard
- Or import `gradeWithBuiltinKey` / `gradeSession` from `lib/grading`
- Run tests: `npm test` (uses `ac-capacitor` fixtures)

Only `ac-capacitor` has a structured answer key so far. Add `lib/grading/answerKeys/<id>.json` for other scenarios.

## AI Build Log

The hackathon requires an AI-generated codebase and asks teams to record the tools and prompts used. Keep this log current as implementation work is added.

| Tool | Prompt or task | Scope |
| --- | --- | --- |
| GitHub Copilot | Turn the supplied HVAC/electrical service-call simulator concept and hackathon brief into a project README. | This README only |
| Claude (`claude-fable-5-1`) | Build the service-call simulator as a localhost Next.js web UI with glassmorphism: scenario list and shuffle button on the left, chat with the loaded scenario on the right, a grading agent that scores the interaction, voice as a future step. | All app code |
| Claude Code (`claude-opus-5-5`) | Run the project, then make sure there is no redundant code and no errors. | Bug and error-handling fixes in `app/` and `lib/`, `next.config.ts`, `.claude/launch.json` |
| Cursor | Grading layer connecting scenario JSON and UI | grading module (`lib/grading/`, `/api/grade`) |

## Hackathon Pitch

FieldReady gives apprentices more chances to practice the judgment behind a service call: what to ask, what to check next, when to stop for safety, and how to support a diagnosis with evidence. Training providers and employers can use repeatable scenarios to extend practice beyond limited lab time, especially for faults that are rare, costly, or unsafe to reproduce on real equipment.