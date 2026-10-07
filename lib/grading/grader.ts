import {
  IRRELEVANT_CHECK_CAP,
  IRRELEVANT_CHECK_EACH,
  ORDERING_VIOLATION_EACH,
  OUTCOME_DIAGNOSIS_MAX,
  OUTCOME_REPAIR_MAX,
  PASS_THRESHOLD,
  WEIGHTS,
} from "./config";
import type {
  AnswerKey,
  Finding,
  MatchOption,
  Scorecard,
  Session,
  SessionEvent,
} from "./types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function bestMatchCredit(text: string, options: MatchOption[]): number {
  const n = normalize(text);
  if (!n) return 0;
  let best = 0;
  for (const opt of options) {
    if (!opt.match) continue;
    if (n.includes(opt.match) || opt.match.includes(n)) {
      best = Math.max(best, opt.credit);
    }
  }
  return best;
}

function firstIndexOfAction(events: SessionEvent[], actionId: string): number | null {
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (
      (e.type === "safety" || e.type === "question" || e.type === "check") &&
      e.actionId === actionId
    ) {
      return i;
    }
  }
  return null;
}

function takenActionIds(events: SessionEvent[]): Set<string> {
  const ids = new Set<string>();
  for (const e of events) {
    if (
      (e.type === "safety" || e.type === "question" || e.type === "check") &&
      e.actionId
    ) {
      ids.add(e.actionId);
    }
  }
  return ids;
}

function gradeSafety(
  answerKey: AnswerKey,
  session: Session,
  findings: Finding[]
): { score: number; critical: boolean } {
  const max = WEIGHTS.safety;
  const events = session.events;

  let firstHandsOnIndex: number | null = null;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== "check" || !e.actionId) continue;
    const def = answerKey.actions[e.actionId];
    if (def?.requiresSafetyBefore) {
      firstHandsOnIndex = i;
      break;
    }
  }

  if (firstHandsOnIndex === null) {
    // No hands-on electrical work — no critical safety violation from sequencing.
    // Abandoned / non-electrical sessions keep safety points (outcome/evidence catch incompleteness).
    return { score: max, critical: false };
  }

  const missing: string[] = [];
  for (const safetyId of answerKey.requiredSafety) {
    const idx = firstIndexOfAction(events, safetyId);
    if (idx === null || idx >= firstHandsOnIndex) {
      missing.push(safetyId);
      const label = answerKey.actions[safetyId]?.label ?? safetyId;
      findings.push({
        category: "safety",
        severity: "critical",
        message: `De-energize and verify before handling components: missing or late step — ${label}.`,
        event_index: firstHandsOnIndex,
      });
    }
  }

  if (missing.length > 0) {
    return { score: 0, critical: true };
  }

  return { score: max, critical: false };
}

function gradeSequence(
  answerKey: AnswerKey,
  session: Session,
  findings: Finding[]
): number {
  const max = WEIGHTS.sequence;
  let deductions = 0;
  const events = session.events;

  for (const rule of answerKey.orderingRules) {
    const afterIdx = firstIndexOfAction(events, rule.after);
    if (afterIdx === null) continue;
    const beforeIdx = firstIndexOfAction(events, rule.before);
    if (beforeIdx === null || beforeIdx > afterIdx) {
      deductions += ORDERING_VIOLATION_EACH;
      findings.push({
        category: "sequence",
        severity: "warning",
        message: rule.message,
        event_index: afterIdx,
      });
    }
  }

  let irrelevantDeduction = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== "check" && e.type !== "safety" && e.type !== "question") continue;
    if (!e.actionId) continue;
    const def = answerKey.actions[e.actionId];
    // Extra safety steps are never penalized.
    if (!def || def.kind === "safety" || e.type === "safety") continue;
    if (!def.irrelevant) continue;
    const add = Math.min(IRRELEVANT_CHECK_EACH, IRRELEVANT_CHECK_CAP - irrelevantDeduction);
    if (add <= 0) continue;
    irrelevantDeduction += add;
    findings.push({
      category: "sequence",
      severity: "info",
      message: `Irrelevant check "${def.label}" does not help isolate this fault.`,
      event_index: i,
    });
  }

  deductions += irrelevantDeduction;
  return clamp(max - deductions, 0, max);
}

function gradeEvidence(
  answerKey: AnswerKey,
  session: Session,
  findings: Finding[]
): number {
  const max = WEIGHTS.evidence;
  const events = session.events;
  const taken = takenActionIds(events);

  if (answerKey.keyEvidence.length === 0) {
    return max;
  }

  const perReading = max / answerKey.keyEvidence.length;
  let score = 0;

  for (const evidenceId of answerKey.keyEvidence) {
    const idx = firstIndexOfAction(events, evidenceId);
    if (idx !== null) {
      score += perReading;
    } else {
      const label = answerKey.actions[evidenceId]?.label ?? evidenceId;
      findings.push({
        category: "evidence",
        severity: "warning",
        message: `Key reading not taken: ${label}. A diagnosis without supporting readings is a lucky guess.`,
        event_index: null,
      });
    }
  }

  // Cited evidence must appear earlier in the log as a taken check/safety/question.
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type !== "cite_evidence" || !e.actionId) continue;
    const takenIdx = firstIndexOfAction(events, e.actionId);
    if (takenIdx === null || takenIdx >= i) {
      score = clamp(score - perReading, 0, max);
      const label = answerKey.actions[e.actionId]?.label ?? e.actionId;
      findings.push({
        category: "evidence",
        severity: "warning",
        message: `Cited reading "${label}" does not appear earlier in the session log.`,
        event_index: i,
      });
    }
  }

  // Correct diagnosis with no key evidence taken → strip evidence (lucky guess).
  const diagnosisEvent = [...events].reverse().find((e) => e.type === "diagnosis");
  if (diagnosisEvent?.value) {
    const diagCredit = Math.max(
      bestMatchCredit(diagnosisEvent.value, answerKey.diagnosis.correct),
      bestMatchCredit(diagnosisEvent.value, answerKey.diagnosis.partial)
    );
    const anyKeyTaken = answerKey.keyEvidence.some((id) => taken.has(id));
    if (diagCredit >= OUTCOME_DIAGNOSIS_MAX && !anyKeyTaken) {
      findings.push({
        category: "evidence",
        severity: "warning",
        message:
          "Correct diagnosis without supporting readings — evidence credit removed (lucky guess).",
        event_index: events.indexOf(diagnosisEvent),
      });
      return 0;
    }
  }

  return clamp(Math.round(score * 10) / 10, 0, max);
}

function gradeOutcome(
  answerKey: AnswerKey,
  session: Session,
  findings: Finding[]
): number {
  const events = session.events;
  let diagnosisScore = 0;
  let repairScore = 0;

  const diagnosisIdx = [...events]
    .map((e, i) => ({ e, i }))
    .reverse()
    .find((x) => x.e.type === "diagnosis");
  const repairIdx = [...events]
    .map((e, i) => ({ e, i }))
    .reverse()
    .find((x) => x.e.type === "repair");

  if (!diagnosisIdx) {
    findings.push({
      category: "outcome",
      severity: "warning",
      message: "No diagnosis stated.",
      event_index: null,
    });
  } else {
    const correct = bestMatchCredit(
      diagnosisIdx.e.value || "",
      answerKey.diagnosis.correct
    );
    const partial = bestMatchCredit(
      diagnosisIdx.e.value || "",
      answerKey.diagnosis.partial
    );
    diagnosisScore = Math.min(OUTCOME_DIAGNOSIS_MAX, Math.max(correct, partial));
    if (diagnosisScore < OUTCOME_DIAGNOSIS_MAX) {
      findings.push({
        category: "outcome",
        severity: diagnosisScore === 0 ? "warning" : "info",
        message:
          diagnosisScore === 0
            ? "Diagnosis does not match the fault in the answer key."
            : "Partial credit for diagnosis; name the specific fault for full credit.",
        event_index: diagnosisIdx.i,
      });
    }
  }

  if (!repairIdx) {
    findings.push({
      category: "outcome",
      severity: "warning",
      message: "No repair stated.",
      event_index: null,
    });
  } else {
    const correct = bestMatchCredit(repairIdx.e.value || "", answerKey.repair.correct);
    const partial = bestMatchCredit(repairIdx.e.value || "", answerKey.repair.partial);
    repairScore = Math.min(OUTCOME_REPAIR_MAX, Math.max(correct, partial));
    if (repairScore < OUTCOME_REPAIR_MAX) {
      findings.push({
        category: "outcome",
        severity: repairScore === 0 ? "warning" : "info",
        message:
          repairScore === 0
            ? "Repair does not match the correct fix in the answer key."
            : "Partial credit for repair; specify the complete correct fix for full credit.",
        event_index: repairIdx.i,
      });
    }
  }

  return diagnosisScore + repairScore;
}

/**
 * Grade a validated session against a validated answer key.
 * Pure and deterministic — no I/O or LLM calls.
 */
export function gradeSession(answerKey: AnswerKey, session: Session): Scorecard {
  const findings: Finding[] = [];

  const safety = gradeSafety(answerKey, session, findings);
  const sequence = gradeSequence(answerKey, session, findings);
  const evidence = gradeEvidence(answerKey, session, findings);
  const outcome = gradeOutcome(answerKey, session, findings);

  const categories = {
    safety: { score: safety.score, max: WEIGHTS.safety },
    sequence: { score: sequence, max: WEIGHTS.sequence },
    evidence: { score: evidence, max: WEIGHTS.evidence },
    outcome: { score: outcome, max: WEIGHTS.outcome },
  };

  const total = Math.round(
    (categories.safety.score +
      categories.sequence.score +
      categories.evidence.score +
      categories.outcome.score) *
      10
  ) / 10;
  const maxTotal =
    WEIGHTS.safety + WEIGHTS.sequence + WEIGHTS.evidence + WEIGHTS.outcome;

  const abandoned = session.events.length === 0;
  if (abandoned) {
    findings.push({
      category: "outcome",
      severity: "info",
      message: "Session has no events — abandoned or empty call.",
      event_index: null,
    });
  }

  const passed =
    !safety.critical && !abandoned && total >= PASS_THRESHOLD;

  return {
    scenarioId: answerKey.scenarioId,
    categories,
    total,
    maxTotal,
    passed,
    findings,
  };
}
