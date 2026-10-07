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

This repository currently contains the project brief, the [source manuals and unit facts](docs/sources/), and eight [scenario briefs](scenarios/) for a Carrier 24ACC636 air conditioner. The simulator implementation and its run instructions have not yet been added.

## AI Build Log

The hackathon requires an AI-generated codebase and asks teams to record the tools and prompts used. Keep this log current as implementation work is added.

| Tool | Prompt or task | Scope |
| --- | --- | --- |
| GitHub Copilot | Turn the supplied HVAC/electrical service-call simulator concept and hackathon brief into a project README. | This README only |
| Claude Code (Claude Opus 5.5) | Find official manufacturer manuals and OSHA safety references for one equipment family, extract cited facts for the Carrier 24ACC636, and write a set of scenario briefs grounded in them. | `docs/sources/`, `scenarios/`, `scripts/fetch_sources.sh` |

## Hackathon Pitch

FieldReady gives apprentices more chances to practice the judgment behind a service call: what to ask, what to check next, when to stop for safety, and how to support a diagnosis with evidence. Training providers and employers can use repeatable scenarios to extend practice beyond limited lab time, especially for faults that are rare, costly, or unsafe to reproduce on real equipment.