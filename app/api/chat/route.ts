import { NextResponse } from "next/server";
import { callLLM, type Msg } from "../../../lib/llm";
import { getScenario, simulatorPrompt } from "../../../lib/scenarios";

export async function POST(req: Request) {
  try {
    const { scenarioId, messages } = (await req.json()) as { scenarioId: string; messages: Msg[] };
    const scenario = getScenario(scenarioId);
    if (!scenario) return NextResponse.json({ error: "Unknown scenario." }, { status: 400 });
    const reply = await callLLM(simulatorPrompt(scenario), messages.slice(-40));
    return NextResponse.json({ reply });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
