# Grader Handoff

Context for whoever (person or coding agent) works on the FieldReady grading agent next. It explains what scenario data the grader can use, what it uses today, and what is still unused. Read this before changing `app/api/grade/route.ts` or `graderPrompt` in `lib/scenarios.ts`.

## What FieldReady does

A trainee picks a service call, chats with an AI that plays both the homeowner and the equipment, states a diagnosis and repair, then presses Finish. The grader reads the transcript and returns a scorecard. All readings are simulated; this is a training tool and must never coach a learner into unsafe live work.

## Where scenarios come from

Scenarios are no longer hardcoded. There are eight, all for one unit (a Carrier 24ACC636 air conditioner), stored as JSON briefs in `scenarios/`. The app reads that folder on every request, so adding or editing a file changes the app with no code change.

| Piece | File | Role |
| --- | --- | --- |
| Briefs | `scenarios/*.json` | Source of truth for each scenario. Format is described in `scenarios/README.md`. |
| Unit facts | `docs/sources/24ACC636-facts.md` | Manual-sourced values the briefs are built on, with page citations. |
| Adapter | `lib/manualScenarios.ts` | Reads the briefs and converts each to the `Scenario` type. |
| Types and prompts | `lib/scenarios.ts` | `Scenario` type, `simulatorPrompt`, `graderPrompt`. |
| Grade route | `app/api/grade/route.ts` | Builds the transcript, calls the model, parses and clamps the scores. |
| Scorecard UI | `app/Simulator.tsx` | `Grade` type and the score bars. |

Scenario ids are neutral (`ac-01` to `ac-08`) because they are sent to the browser. The file names are descriptive and stay on the server. Do not send any other brief field to the client; `publicScenarios()` in `lib/scenarios.ts` controls what leaves the server.

## What the grader receives today

`graderPrompt(s)` gets a `Scenario` built by the adapter:

| `Scenario` field | Built from (brief field) | Notes |
| --- | --- | --- |
| `fault` | `hidden_fault.description` | The actual fault. |
| `acceptedDiagnoses` | `diagnosis.accept` | Phrases that count as naming the fault correctly. |
| `fix` | `diagnosis.repair` | The correct repair. |
| `escalateWhen` | `escalate_when` | When the trainee should stop and hand off. For `ac-08` (low refrigerant) the answer is "always". |
| `safety` | `expected_sequence`, `escalate_when`, `unsafe_actions` | Lockout step, capacitor discharge step if relevant, the escalation rule, then one "Never: ..." line per unsafe action. |
| `idealOrder` | `expected_sequence` | "Ask the homeowner..." followed by the labels of the expected checks, in order. |
| `keyEvidence` | `key_evidence` joined to `checks` | One line per key check as "label: result". Can include normal readings that rule out another cause. |

The grader returns four areas, each 0 to 100 with a one-sentence note: `safety`, `order`, `evidence`, `fix`. It also returns `summary` and `nextTime`. The route averages the four into `overall`.

The response shape the UI expects:

```json
{
  "overall": 0,
  "safety": { "score": 0, "note": "" },
  "order": { "score": 0, "note": "" },
  "evidence": { "score": 0, "note": "" },
  "fix": { "score": 0, "note": "" },
  "summary": "",
  "nextTime": [""]
}
```

If you add or rename an area, update three places together: the JSON shape in `graderPrompt`, the parsing in `app/api/grade/route.ts`, and the `Grade` type and bar list in `app/Simulator.tsx`.

## Transcript format

The route sends the model one user message containing the transcript. Lines are prefixed `TRAINEE:` or `SIMULATOR:`. The first line is always the homeowner's opening. Simulator replies contain sections that start with `Homeowner:`, `Reading:` or `Safety:` on their own line. A `Safety:` line means the simulator judged the trainee's action unsafe; the grader can treat it as a strong signal but should still judge from the trainee's own words.

Trainees type free text. There is no structured log of which checks they ran, so the grader has to infer that from the transcript.

## Brief fields the grader does not use yet

These are in every brief but are dropped by the adapter. Each is a possible improvement.

| Brief field | What it holds | Possible use |
| --- | --- | --- |
| `checks[].cite` | Manual page for each reading, for example "SM p. 12" | Quote the source in feedback so the trainee sees why a value matters. Document codes are defined in `docs/sources/24ACC636-facts.md`. |
| `checks[].requires` | Safety steps that must precede a check (`lockout`, `cap_discharge`) | Detect a power-off check done before lockout, instead of relying on the model to notice. |
| `checks[].abnormal` | Whether a result differs from a healthy unit | Tell whether the trainee found the abnormal readings or only took normal ones. |
| `checks[].category` | `observation`, `live measurement (simulated)`, `power-off check`, `safety step` | Reward moving from observation to measurement to component tests. |
| `scoring` | Intended rubric: safety, sequence, evidence, outcome at 25 points each, with criteria text | Align the grader's wording and weights with it. The app currently weights the four areas equally out of 100 each. |
| `homeowner.red_herring` | A misleading suggestion from the homeowner | Credit the trainee for not following it without evidence. |
| `instructor_notes` | The teaching point of the scenario | Use in `summary` or `nextTime`. |
| `assumptions` | Values not taken from the manuals | Do not present these as manufacturer figures in feedback. |

To expose any of these, add the field to the `Brief` type and to `toScenario` in `lib/manualScenarios.ts`, add it to the `Scenario` type in `lib/scenarios.ts`, then use it in `graderPrompt`.

## Rules the grader should keep

- Grade only from the transcript. Do not credit steps the trainee did not state.
- No stated diagnosis means a `fix` score of 0.
- A correct guess with no supporting readings should score low on `evidence`.
- Unsafe actions should cost heavily on `safety`. The briefs list them in `unsafe_actions`.
- For a scenario whose `escalate_when` applies, recommending a handoff is the correct outcome, not a failure to fix.
- Feedback may reveal the fault, since it is shown after the call ends.
- Some readings are assumptions, not manual values (the 45/5 µF capacitor rating and the running-amp figures in particular). Each brief lists its own under `assumptions`.

## Known gaps

- The grader has not been run end to end against these scenarios. The app needs `GEMINI_API_KEY` or `ANTHROPIC_API_KEY` in `.env.local`, and none was available when the scenarios were wired in. Expect to tune the prompt once real transcripts exist.
- The model's reply is parsed by slicing from the first `{` to the last `}`. A reply with extra braces in prose will fail to parse.
- Every attempt at a scenario is identical; there is no variation in homeowner or readings yet.
- An HVAC professional has not reviewed the briefs.

## How to test

1. `npm install`, then copy `.env.local.example` to `.env.local` and add one key.
2. `npm run dev` and open http://localhost:3000.
3. To hit the grader directly, replacing the messages with a real exchange:

```
curl -s -X POST http://localhost:3000/api/grade \
  -H 'content-type: application/json' \
  -d '{"scenarioId":"ac-01","messages":[{"role":"user","content":"I shut off the disconnect, verified zero volts, discharged and tested the capacitor: 27 uF on a 45 uF section. The run capacitor has failed; replace it with the same rating."}]}'
```

Useful transcripts to try for each scenario: a careful correct call, a correct guess with no checks, a call that skips lockout before a power-off check, and a wrong diagnosis that follows the homeowner's red herring.

Do not run `npm run build` or delete `.next` while a dev server is running in the same folder; it breaks the running server until it is restarted.
