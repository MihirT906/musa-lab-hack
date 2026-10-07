import { NextResponse } from "next/server";
import { gradeWithBuiltinKey, ValidationError } from "../../../lib/grading";

/**
 * Rule-based grader. Body must be a structured session log:
 *   { scenarioId: string, events: SessionEvent[] }
 *
 * Chat transcripts ({ messages }) are not graded here — the UI should
 * emit action ids when the trainee finishes. See README "Grading layer".
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body && Array.isArray(body.messages) && !Array.isArray(body.events)) {
      return NextResponse.json(
        {
          error:
            "Structured session required. Send { scenarioId, events } with action ids; free-text chat messages are not graded by the rule-based grader.",
        },
        { status: 400 }
      );
    }

    const scorecard = gradeWithBuiltinKey(body);
    return NextResponse.json(scorecard);
  } catch (e) {
    if (e instanceof ValidationError) {
      return NextResponse.json(
        { error: e.message, details: e.details },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
