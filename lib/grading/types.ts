/** Internal types used by the grader. Format-specific parsing lives in adapters. */

export type Severity = "info" | "warning" | "critical";

export type CategoryId = "safety" | "sequence" | "evidence" | "outcome";

export type ActionKind =
  | "safety"
  | "question"
  | "observation"
  | "electrical_check"
  | "invasive_check"
  | "other";

export type ActionDef = {
  id: string;
  kind: ActionKind;
  label: string;
  /** Hands-on electrical work that requires requiredSafety steps first. */
  requiresSafetyBefore: boolean;
  /** Counts as a key reading that proves the fault. */
  isKeyEvidence: boolean;
  /**
   * Known but off-path check. Taking it costs a small capped sequence deduction.
   * Extra safety steps must never set this.
   */
  irrelevant?: boolean;
};

export type OrderingRule = {
  before: string;
  after: string;
  message: string;
};

export type MatchOption = {
  /** Normalized match token (lowercase substring or exact id). */
  match: string;
  /** Points awarded out of the category slice (diagnosis or repair max). */
  credit: number;
};

export type AnswerKey = {
  scenarioId: string;
  actions: Record<string, ActionDef>;
  /** Safety action ids that must all appear before any requiresSafetyBefore check. */
  requiredSafety: string[];
  orderingRules: OrderingRule[];
  /** Action ids that must be taken to earn full evidence credit. */
  keyEvidence: string[];
  diagnosis: {
    correct: MatchOption[];
    partial: MatchOption[];
  };
  repair: {
    correct: MatchOption[];
    partial: MatchOption[];
  };
};

export type SessionEventType =
  | "safety"
  | "question"
  | "check"
  | "cite_evidence"
  | "diagnosis"
  | "repair";

export type SessionEvent = {
  type: SessionEventType;
  /** Required for safety / question / check / cite_evidence. */
  actionId?: string;
  /** Free text for diagnosis / repair; optional note for others. */
  value?: string;
};

export type Session = {
  scenarioId: string;
  events: SessionEvent[];
};

export type Finding = {
  category: CategoryId;
  severity: Severity;
  message: string;
  event_index: number | null;
};

export type CategoryScore = {
  score: number;
  max: number;
};

export type Scorecard = {
  scenarioId: string;
  categories: {
    safety: CategoryScore;
    sequence: CategoryScore;
    evidence: CategoryScore;
    outcome: CategoryScore;
  };
  total: number;
  maxTotal: number;
  passed: boolean;
  findings: Finding[];
};

export class ValidationError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(details.length ? `${message}: ${details.join("; ")}` : message);
    this.name = "ValidationError";
    this.details = details;
  }
}
