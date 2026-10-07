import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { loadAnswerKey, loadSession } from "./adapters";
import { gradeSession } from "./grader";
import { getAnswerKey, gradeWithBuiltinKey } from "./index";
import { ValidationError } from "./types";
import type { Session } from "./types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const answerKeyJson = JSON.parse(
  readFileSync(join(__dirname, "answerKeys/ac-capacitor.json"), "utf8")
);

function session(events: Session["events"]): Session {
  return { scenarioId: "ac-capacitor", events };
}

const perfectEvents: Session["events"] = [
  { type: "question", actionId: "ask_symptoms" },
  { type: "check", actionId: "check_thermostat_airflow" },
  { type: "check", actionId: "observe_outdoor_unit" },
  { type: "check", actionId: "check_contactor_voltage" },
  { type: "safety", actionId: "power_off_disconnect" },
  { type: "safety", actionId: "verify_zero_voltage" },
  { type: "safety", actionId: "discharge_capacitor" },
  { type: "check", actionId: "capacitor_visual" },
  { type: "check", actionId: "test_capacitor" },
  { type: "cite_evidence", actionId: "test_capacitor" },
  { type: "cite_evidence", actionId: "observe_outdoor_unit" },
  { type: "diagnosis", value: "Failed dual run capacitor" },
  {
    type: "repair",
    value: "Replace the dual run capacitor with the same 45/5 µF rating",
  },
];

describe("FieldReady grading layer", () => {
  const answerKey = loadAnswerKey(answerKeyJson);

  it("1. perfect session -> pass, near full marks", () => {
    const card = gradeSession(answerKey, session(perfectEvents));
    assert.equal(card.passed, true);
    assert.equal(card.categories.safety.score, 35);
    assert.equal(card.categories.outcome.score, 20);
    assert.equal(card.categories.evidence.score, 20);
    assert.ok(card.total >= 90, `expected high total, got ${card.total}`);
    assert.ok(card.findings.every((f) => f.severity !== "critical"));
  });

  it("2. hands-on check before power off -> critical, fail", () => {
    const card = gradeSession(
      answerKey,
      session([
        { type: "question", actionId: "ask_symptoms" },
        { type: "check", actionId: "test_capacitor" },
        { type: "safety", actionId: "power_off_disconnect" },
        { type: "diagnosis", value: "Failed dual run capacitor" },
        { type: "repair", value: "Replace the dual run capacitor" },
      ])
    );
    assert.equal(card.categories.safety.score, 0);
    assert.equal(card.passed, false);
    assert.ok(card.findings.some((f) => f.severity === "critical" && f.category === "safety"));
  });

  it("3. right diagnosis, key reading never taken -> evidence deduction", () => {
    const card = gradeSession(
      answerKey,
      session([
        { type: "question", actionId: "ask_symptoms" },
        { type: "safety", actionId: "power_off_disconnect" },
        { type: "safety", actionId: "verify_zero_voltage" },
        { type: "safety", actionId: "discharge_capacitor" },
        { type: "diagnosis", value: "Failed dual run capacitor" },
        { type: "repair", value: "Replace the dual run capacitor" },
      ])
    );
    assert.equal(card.categories.safety.score, 35);
    assert.equal(card.categories.outcome.score, 20);
    assert.equal(card.categories.evidence.score, 0);
    assert.ok(
      card.findings.some(
        (f) => f.category === "evidence" && /lucky guess|supporting readings/i.test(f.message)
      )
    );
  });

  it("4. cited a reading never taken -> evidence deduction", () => {
    const card = gradeSession(
      answerKey,
      session([
        { type: "question", actionId: "ask_symptoms" },
        { type: "check", actionId: "observe_outdoor_unit" },
        { type: "check", actionId: "check_contactor_voltage" },
        { type: "safety", actionId: "power_off_disconnect" },
        { type: "safety", actionId: "verify_zero_voltage" },
        { type: "safety", actionId: "discharge_capacitor" },
        { type: "check", actionId: "capacitor_visual" },
        // test_capacitor never taken, but cited
        { type: "cite_evidence", actionId: "test_capacitor" },
        { type: "diagnosis", value: "Failed dual run capacitor" },
        { type: "repair", value: "Replace the dual run capacitor" },
      ])
    );
    assert.ok(card.categories.evidence.score < 20);
    assert.ok(
      card.findings.some(
        (f) =>
          f.category === "evidence" &&
          /does not appear earlier/i.test(f.message) &&
          f.event_index !== null
      )
    );
  });

  it("5. invasive check before basic questions -> sequence deduction", () => {
    const card = gradeSession(
      answerKey,
      session([
        { type: "safety", actionId: "power_off_disconnect" },
        { type: "safety", actionId: "verify_zero_voltage" },
        { type: "safety", actionId: "discharge_capacitor" },
        { type: "check", actionId: "test_capacitor" },
        { type: "question", actionId: "ask_symptoms" },
        { type: "check", actionId: "check_thermostat_airflow" },
        { type: "check", actionId: "observe_outdoor_unit" },
        { type: "check", actionId: "check_contactor_voltage" },
        { type: "check", actionId: "capacitor_visual" },
        { type: "diagnosis", value: "Failed dual run capacitor" },
        { type: "repair", value: "Replace the dual run capacitor" },
      ])
    );
    assert.equal(card.categories.safety.score, 35);
    assert.ok(card.categories.sequence.score < 25);
    assert.ok(
      card.findings.some(
        (f) => f.category === "sequence" && /before invasive/i.test(f.message)
      )
    );
  });

  it("6. wrong diagnosis, perfect safety -> outcome deduction only", () => {
    const card = gradeSession(
      answerKey,
      session([
        { type: "question", actionId: "ask_symptoms" },
        { type: "check", actionId: "check_thermostat_airflow" },
        { type: "check", actionId: "observe_outdoor_unit" },
        { type: "check", actionId: "check_contactor_voltage" },
        { type: "safety", actionId: "power_off_disconnect" },
        { type: "safety", actionId: "verify_zero_voltage" },
        { type: "safety", actionId: "discharge_capacitor" },
        { type: "check", actionId: "capacitor_visual" },
        { type: "check", actionId: "test_capacitor" },
        { type: "diagnosis", value: "Low refrigerant charge" },
        { type: "repair", value: "Add refrigerant" },
      ])
    );
    assert.equal(card.categories.safety.score, 35);
    assert.equal(card.categories.evidence.score, 20);
    assert.ok(card.categories.outcome.score < 20);
    assert.ok(card.findings.some((f) => f.category === "outcome"));
    assert.ok(!card.findings.some((f) => f.severity === "critical"));
  });

  it("7. empty/abandoned session -> no crash, clear result", () => {
    const card = gradeSession(answerKey, session([]));
    assert.equal(card.passed, false);
    assert.equal(card.categories.outcome.score, 0);
    assert.ok(card.findings.some((f) => /abandoned|empty/i.test(f.message)));
  });

  it("8a. malformed answer key -> clear validation error", () => {
    assert.throws(
      () => loadAnswerKey({ scenarioId: "x" }),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.ok(err.message.length > 0);
        return true;
      }
    );
  });

  it("8b. malformed session / unknown action -> clear validation error", () => {
    assert.throws(
      () =>
        loadSession(
          {
            scenarioId: "ac-capacitor",
            events: [{ type: "check", actionId: "test_cap" }],
          },
          answerKey
        ),
      (err: unknown) => {
        assert.ok(err instanceof ValidationError);
        assert.match(err.message, /test_cap.*not defined in answer key/);
        return true;
      }
    );
  });

  it("gradeWithBuiltinKey wires adapters + grader", () => {
    const card = gradeWithBuiltinKey(session(perfectEvents));
    assert.equal(card.scenarioId, "ac-capacitor");
    assert.equal(card.passed, true);
  });

  it("getAnswerKey rejects unknown scenario", () => {
    assert.throws(() => getAnswerKey("no-such-scenario"), ValidationError);
  });
});
