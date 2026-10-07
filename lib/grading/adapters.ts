import type {
  ActionDef,
  AnswerKey,
  MatchOption,
  OrderingRule,
  Session,
  SessionEvent,
  SessionEventType,
} from "./types";
import { ValidationError } from "./types";

const ACTION_KINDS = new Set([
  "safety",
  "question",
  "observation",
  "electrical_check",
  "invasive_check",
  "other",
]);

const EVENT_TYPES = new Set<SessionEventType>([
  "safety",
  "question",
  "check",
  "cite_evidence",
  "diagnosis",
  "repair",
]);

const EVENTS_NEEDING_ACTION: SessionEventType[] = [
  "safety",
  "question",
  "check",
  "cite_evidence",
];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asString(v: unknown, path: string, errors: string[]): string {
  if (typeof v !== "string" || !v.trim()) {
    errors.push(`${path} must be a non-empty string`);
    return "";
  }
  return v.trim();
}

function parseMatchOptions(
  raw: unknown,
  path: string,
  errors: string[]
): MatchOption[] {
  if (!Array.isArray(raw)) {
    errors.push(`${path} must be an array`);
    return [];
  }
  return raw.map((item, i) => {
    if (!isPlainObject(item)) {
      errors.push(`${path}[${i}] must be an object`);
      return { match: "", credit: 0 };
    }
    const match = asString(item.match, `${path}[${i}].match`, errors).toLowerCase();
    const credit = Number(item.credit);
    if (!Number.isFinite(credit) || credit < 0) {
      errors.push(`${path}[${i}].credit must be a non-negative number`);
    }
    return { match, credit: Number.isFinite(credit) ? credit : 0 };
  });
}

function parseAction(id: string, raw: unknown, errors: string[]): ActionDef | null {
  if (!isPlainObject(raw)) {
    errors.push(`actions.${id} must be an object`);
    return null;
  }
  const actionId = asString(raw.id ?? id, `actions.${id}.id`, errors);
  if (actionId && actionId !== id) {
    errors.push(`actions.${id}.id must equal the key "${id}"`);
  }
  const kind = asString(raw.kind, `actions.${id}.kind`, errors);
  if (kind && !ACTION_KINDS.has(kind)) {
    errors.push(`actions.${id}.kind "${kind}" is not a valid action kind`);
  }
  const label = asString(raw.label, `actions.${id}.label`, errors);
  if (typeof raw.requiresSafetyBefore !== "boolean") {
    errors.push(`actions.${id}.requiresSafetyBefore must be a boolean`);
  }
  if (typeof raw.isKeyEvidence !== "boolean") {
    errors.push(`actions.${id}.isKeyEvidence must be a boolean`);
  }
  return {
    id: actionId || id,
    kind: (kind || "other") as ActionDef["kind"],
    label,
    requiresSafetyBefore: Boolean(raw.requiresSafetyBefore),
    isKeyEvidence: Boolean(raw.isKeyEvidence),
    irrelevant: raw.irrelevant === true,
  };
}

/**
 * Load and validate an answer-key JSON document into the internal AnswerKey type.
 * All teammate-format specifics stay here.
 */
export function loadAnswerKey(json: unknown): AnswerKey {
  const errors: string[] = [];
  if (!isPlainObject(json)) {
    throw new ValidationError("Answer key must be a JSON object");
  }

  const scenarioId = asString(json.scenarioId, "scenarioId", errors);

  if (!isPlainObject(json.actions)) {
    errors.push("actions must be an object keyed by action id");
  }
  const actions: Record<string, ActionDef> = {};
  if (isPlainObject(json.actions)) {
    for (const [id, raw] of Object.entries(json.actions)) {
      const action = parseAction(id, raw, errors);
      if (action) actions[id] = action;
    }
  }

  if (!Array.isArray(json.requiredSafety)) {
    errors.push("requiredSafety must be an array of action ids");
  }
  const requiredSafety = Array.isArray(json.requiredSafety)
    ? json.requiredSafety.map((id, i) => {
        const s = asString(id, `requiredSafety[${i}]`, errors);
        if (s && !actions[s]) {
          errors.push(`requiredSafety[${i}] "${s}" is not defined in actions`);
        }
        return s;
      })
    : [];

  if (!Array.isArray(json.orderingRules)) {
    errors.push("orderingRules must be an array");
  }
  const orderingRules: OrderingRule[] = Array.isArray(json.orderingRules)
    ? json.orderingRules.map((rule, i) => {
        if (!isPlainObject(rule)) {
          errors.push(`orderingRules[${i}] must be an object`);
          return { before: "", after: "", message: "" };
        }
        const before = asString(rule.before, `orderingRules[${i}].before`, errors);
        const after = asString(rule.after, `orderingRules[${i}].after`, errors);
        const message = asString(rule.message, `orderingRules[${i}].message`, errors);
        if (before && !actions[before]) {
          errors.push(`orderingRules[${i}].before "${before}" is not defined in actions`);
        }
        if (after && !actions[after]) {
          errors.push(`orderingRules[${i}].after "${after}" is not defined in actions`);
        }
        return { before, after, message };
      })
    : [];

  if (!Array.isArray(json.keyEvidence)) {
    errors.push("keyEvidence must be an array of action ids");
  }
  const keyEvidence = Array.isArray(json.keyEvidence)
    ? json.keyEvidence.map((id, i) => {
        const s = asString(id, `keyEvidence[${i}]`, errors);
        if (s && !actions[s]) {
          errors.push(`keyEvidence[${i}] "${s}" is not defined in actions`);
        }
        return s;
      })
    : [];

  if (!isPlainObject(json.diagnosis)) {
    errors.push("diagnosis must be an object with correct and partial arrays");
  }
  if (!isPlainObject(json.repair)) {
    errors.push("repair must be an object with correct and partial arrays");
  }

  const diagnosis = {
    correct: parseMatchOptions(
      isPlainObject(json.diagnosis) ? json.diagnosis.correct : [],
      "diagnosis.correct",
      errors
    ),
    partial: parseMatchOptions(
      isPlainObject(json.diagnosis) ? json.diagnosis.partial : [],
      "diagnosis.partial",
      errors
    ),
  };
  const repair = {
    correct: parseMatchOptions(
      isPlainObject(json.repair) ? json.repair.correct : [],
      "repair.correct",
      errors
    ),
    partial: parseMatchOptions(
      isPlainObject(json.repair) ? json.repair.partial : [],
      "repair.partial",
      errors
    ),
  };

  if (errors.length) {
    throw new ValidationError("Invalid answer key", errors);
  }

  return {
    scenarioId,
    actions,
    requiredSafety,
    orderingRules,
    keyEvidence,
    diagnosis,
    repair,
  };
}

/**
 * Load and validate a UI session log into the internal Session type.
 * When answerKey is provided, unknown action ids are reported as validation errors.
 */
export function loadSession(json: unknown, answerKey?: AnswerKey): Session {
  const errors: string[] = [];
  if (!isPlainObject(json)) {
    throw new ValidationError("Session must be a JSON object");
  }

  const scenarioId = asString(json.scenarioId, "scenarioId", errors);

  if (answerKey && scenarioId && scenarioId !== answerKey.scenarioId) {
    errors.push(
      `session scenarioId "${scenarioId}" does not match answer key "${answerKey.scenarioId}"`
    );
  }

  if (!Array.isArray(json.events)) {
    errors.push("events must be an array");
  }

  const events: SessionEvent[] = Array.isArray(json.events)
    ? json.events.map((raw, i) => {
        if (!isPlainObject(raw)) {
          errors.push(`events[${i}] must be an object`);
          return { type: "question" as SessionEventType };
        }
        const type = asString(raw.type, `events[${i}].type`, errors) as SessionEventType;
        if (type && !EVENT_TYPES.has(type)) {
          errors.push(`events[${i}].type "${type}" is not a valid event type`);
        }

        let actionId: string | undefined;
        if (EVENTS_NEEDING_ACTION.includes(type)) {
          actionId = asString(raw.actionId, `events[${i}].actionId`, errors);
          if (actionId && answerKey && !answerKey.actions[actionId]) {
            errors.push(
              `action '${actionId}' in session is not defined in answer key (events[${i}])`
            );
          }
        } else if (raw.actionId != null && raw.actionId !== "") {
          actionId = asString(raw.actionId, `events[${i}].actionId`, errors);
        }

        let value: string | undefined;
        if (type === "diagnosis" || type === "repair") {
          value = asString(raw.value, `events[${i}].value`, errors);
        } else if (typeof raw.value === "string") {
          value = raw.value;
        }

        return { type, actionId, value };
      })
    : [];

  if (errors.length) {
    throw new ValidationError("Invalid session", errors);
  }

  return { scenarioId, events };
}
