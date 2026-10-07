import { NextResponse } from "next/server";
import { callLLM, type Msg } from "../../../lib/llm";
import { getScenario, graderPrompt } from "../../../lib/scenarios";

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
const weight = (n: unknown) => Math.max(0, Number(n) || 0);

export async function POST(req: Request) {
  try {
    const { scenarioId, messages } = (await req.json()) as { scenarioId: string; messages: Msg[] };
    const scenario = getScenario(scenarioId);
    if (!scenario) return NextResponse.json({ error: "Unknown scenario." }, { status: 400 });
    if (!Array.isArray(messages) || messages.length === 0)
      return NextResponse.json({ error: "No messages to send." }, { status: 400 });

    const transcript =
      `SIMULATOR: Homeowner: ${scenario.opening}\n` +
      messages
        .map((m) => `${m.role === "user" ? "TRAINEE" : "SIMULATOR"}: ${m.content}`)
        .join("\n");

    const raw = await callLLM(graderPrompt(scenario), [
      { role: "user", content: `Transcript of the call:\n\n${transcript}\n\nGrade it now.` },
    ]);

    let g;
    try {
      g = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
    } catch {
      throw new Error("The grader did not return a score. Try again.");
    }

    const safety = clamp(g?.safety?.score);
    const order = clamp(g?.order?.score);
    const evidence = clamp(g?.evidence?.score);
    const fix = clamp(g?.fix?.score);
    const weights = {
      safety: weight(scenario.scoring.safety.points),
      order: weight(scenario.scoring.sequence.points),
      evidence: weight(scenario.scoring.evidence.points),
      fix: weight(scenario.scoring.outcome.points),
    };
    const totalWeight = weights.safety + weights.order + weights.evidence + weights.fix;
    const overall = totalWeight
      ? Math.round(
          (safety * weights.safety +
            order * weights.order +
            evidence * weights.evidence +
            fix * weights.fix) /
            totalWeight
        )
      : Math.round((safety + order + evidence + fix) / 4);
    return NextResponse.json({
      overall,
      safety: { score: safety, note: String(g?.safety?.note || "") },
      order: { score: order, note: String(g?.order?.note || "") },
      evidence: { score: evidence, note: String(g?.evidence?.note || "") },
      fix: { score: fix, note: String(g?.fix?.note || "") },
      summary: String(g?.summary || ""),
      nextTime: Array.isArray(g?.nextTime) ? g.nextTime.map(String).slice(0, 3) : [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
