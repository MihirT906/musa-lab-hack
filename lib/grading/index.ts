import acCapacitorKey from "./answerKeys/ac-capacitor.json";
import { loadAnswerKey, loadSession } from "./adapters";
import { gradeSession } from "./grader";
import type { AnswerKey, Scorecard, Session } from "./types";
import { ValidationError } from "./types";

export type { AnswerKey, Session, Scorecard, Finding, CategoryScore } from "./types";
export { ValidationError } from "./types";
export { loadAnswerKey, loadSession } from "./adapters";
export { gradeSession } from "./grader";
export { WEIGHTS, PASS_THRESHOLD } from "./config";

const BUILTIN_KEYS: Record<string, unknown> = {
  "ac-capacitor": acCapacitorKey,
};

/** Load a built-in structured answer key by scenario id. */
export function getAnswerKey(scenarioId: string): AnswerKey {
  const raw = BUILTIN_KEYS[scenarioId];
  if (!raw) {
    throw new ValidationError(
      `No structured answer key for scenario "${scenarioId}". Add lib/grading/answerKeys/${scenarioId}.json.`
    );
  }
  return loadAnswerKey(raw);
}

/**
 * One-shot entry point for the UI / HTTP route:
 * validate answer key + session, then return a Scorecard.
 */
export function grade(
  answerKeyJson: unknown,
  sessionJson: unknown
): Scorecard {
  const answerKey = loadAnswerKey(answerKeyJson);
  const session = loadSession(sessionJson, answerKey);
  return gradeSession(answerKey, session);
}

/** Grade using a built-in answer key for the session's scenarioId. */
export function gradeWithBuiltinKey(sessionJson: unknown): Scorecard {
  if (
    typeof sessionJson !== "object" ||
    sessionJson === null ||
    Array.isArray(sessionJson) ||
    typeof (sessionJson as Session).scenarioId !== "string"
  ) {
    throw new ValidationError("Session must be a JSON object with scenarioId");
  }
  const answerKey = getAnswerKey((sessionJson as Session).scenarioId);
  const session = loadSession(sessionJson, answerKey);
  return gradeSession(answerKey, session);
}
