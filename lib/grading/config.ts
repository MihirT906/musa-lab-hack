import type { CategoryId } from "./types";

/** Point weights for the four grading categories (must sum to 100). */
export const WEIGHTS: Record<CategoryId, number> = {
  safety: 35,
  sequence: 25,
  evidence: 20,
  outcome: 20,
};

/** Outcome splits into diagnosis + repair. */
export const OUTCOME_DIAGNOSIS_MAX = 10;
export const OUTCOME_REPAIR_MAX = 10;

/**
 * Max points deducted from Diagnostic Sequence for irrelevant checks
 * (checks not listed in the answer key actions).
 */
export const IRRELEVANT_CHECK_CAP = 5;
export const IRRELEVANT_CHECK_EACH = 2;

/** Points deducted per violated A-before-B ordering rule. */
export const ORDERING_VIOLATION_EACH = 5;

/** Minimum total (of 100) to pass when there is no critical safety violation. */
export const PASS_THRESHOLD = 60;
