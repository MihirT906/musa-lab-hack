export type Msg = { role: "user" | "assistant"; content: string };

const GEMINI_MAX_ATTEMPTS = 3;
const GEMINI_RETRYABLE_STATUSES = new Set([429, 503]);
const GEMINI_INTERACTIONS_URL = "https://generativelanguage.googleapis.com/v1beta/interactions";

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

export async function transcribeAudio(audioData: string, mimeType: string): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new Error("Gemini transcription requires GEMINI_API_KEY in .env.local.");
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const text = await callGeminiInteraction(geminiKey, {
    model,
    system_instruction:
      "You are a precise speech transcription engine. Transcribe the speaker verbatim in US English. Do not answer, summarize, correct their technical reasoning, or add words they did not say. Preserve measurements, component names, and safety terminology. Return only the transcript as plain text.",
    store: false,
    input: [
      {
        type: "text",
        text:
          "Transcribe this HVAC trainee. Likely vocabulary includes thermostat, contactor, capacitor, compressor, disconnect, breaker, blower, airflow, indoor coil, outdoor coil, suction line, refrigerant, voltage, amperage, ohms, microfarads, L1, L2, lockout, and tagout.",
      },
      { type: "audio", data: audioData, mime_type: mimeType },
    ],
    generation_config: { max_output_tokens: 500, temperature: 0, thinking_level: "minimal" },
  });

  const transcript = text.trim();
  if (!transcript) throw new Error("Gemini did not return a transcript. Please record again.");
  return transcript;
}

async function callGeminiInteraction(
  geminiKey: string,
  requestBody: Record<string, unknown>
): Promise<string> {
  const body = JSON.stringify(requestBody);

  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt++) {
    const res = await fetch(GEMINI_INTERACTIONS_URL, {
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

async function request(system: string, messages: Msg[]): Promise<string> {
  const geminiKey = process.env.GEMINI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (geminiKey) {
    const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
    return callGeminiInteraction(geminiKey, {
      model,
      system_instruction: system,
      store: false,
      input: messages.map((message) => ({
        type: message.role === "assistant" ? "model_output" : "user_input",
        content: [{ type: "text", text: message.content }],
      })),
      generation_config: { max_output_tokens: 2000, temperature: 0.6 },
    });
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
