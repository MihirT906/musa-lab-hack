import { NextResponse } from "next/server";
import { callLLM, type Msg } from "../../../lib/llm";
import { getScenario, graderPrompt } from "../../../lib/scenarios";

const clamp = (n: unknown) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export async function POST(req: Request) {
  try {
    const { scenarioId, messages } = (await req.json()) as { scenarioId: string; messages: Msg[] };
    const scenario = getScenario(scenarioId);
    if (!scenario) return NextResponse.json({ error: "Unknown scenario." }, { status: 400 });

    const transcript =
      `SIMULATOR: Homeowner: ${scenario.opening}\n` +
      messages
        .map((m) => `${m.role === "user" ? "TRAINEE" : "SIMULATOR"}: ${m.content}`)
        .join("\n");

    const raw = await callLLM(graderPrompt(scenario), [
      { role: "user", content: `Transcript of the call:\n\n${transcript}\n\nGrade it now.` },
    ]);

    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start < 0 || end < 0) throw new Error("The grader did not return a score. Try again.");
    const g = JSON.parse(raw.slice(start, end + 1));

    const safety = clamp(g?.safety?.score);
    const order = clamp(g?.order?.score);
    const fix = clamp(g?.fix?.score);
    return NextResponse.json({
      overall: Math.round((safety + order + fix) / 3),
      safety: { score: safety, note: String(g?.safety?.note || "") },
      order: { score: order, note: String(g?.order?.note || "") },
      fix: { score: fix, note: String(g?.fix?.note || "") },
      summary: String(g?.summary || ""),
      nextTime: Array.isArray(g?.nextTime) ? g.nextTime.map(String).slice(0, 3) : [],
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
