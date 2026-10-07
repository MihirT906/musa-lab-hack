export type Msg = { role: "user" | "assistant"; content: string };

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRYABLE_STATUSES = new Set([429, 503]);

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(retryAfter: string | null, attempt: number): number {
  const seconds = Number(retryAfter);
  if (retryAfter && Number.isFinite(seconds)) {
    return Math.min(4000, Math.max(0, seconds * 1000));
  }
  return 750 * 2 ** attempt;
}

// Calls whichever provider has a key in .env.local. Gemini is tried first (free tier).
export async function callLLM(system: string, messages: Msg[]): Promise<string> {
  const text = (await request(system, messages)).trim();
  if (!text) throw new Error("The model returned an empty reply. Try again.");
  return text;
}

async function request(system: string, messages: Msg[]): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (geminiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    const body = JSON.stringify({
      model,
      system_instruction: system,
      store: false,
      input: messages.map((message) => ({
        type: message.role === "assistant" ? "model_output" : "user_input",
        content: [{ type: "text", text: message.content }],
      })),
      generation_config: { max_output_tokens: 2000, temperature: 0.6 },
    });

    for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": geminiKey },
        body,
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        const steps = Array.isArray(data?.steps) ? data.steps : [];
        return steps
          .filter((step: { type?: string }) => step.type === "model_output")
          .flatMap((step: { content?: { type?: string; text?: string }[] }) => step.content || [])
          .filter((content: { type?: string }) => content.type === "text")
          .map((content: { text?: string }) => content.text || "")
          .join("");
      }

      const retryable = GEMINI_RETRYABLE_STATUSES.has(res.status);
      const hasAnotherAttempt = attempt + 1 < GEMINI_MAX_ATTEMPTS;
      if (!retryable || !hasAnotherAttempt) {
        if (retryable) {
          throw new Error("Gemini is temporarily busy. Please wait a moment and try again.");
        }
        throw new Error(data?.error?.message || `Gemini error ${res.status}`);
      }

      await wait(retryDelayMs(res.headers.get("retry-after"), attempt));
    }

    throw new Error("Gemini is temporarily unavailable. Please try again.");
  }

  if (anthropicKey) {
    const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model, max_tokens: 1000, system, messages }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Anthropic error ${res.status}`);
    return (data?.content || [])
      .map((b: { type: string; text?: string }) => (b.type === "text" ? b.text : ""))
      .join("");
  }

  throw new Error(
    "No API key found. Copy .env.local.example to .env.local, add a GEMINI_API_KEY or ANTHROPIC_API_KEY, and restart the server."
  );
}
