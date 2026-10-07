import { NextResponse } from "next/server";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return NextResponse.json(
        { error: "Voice input is not configured. Add OPENAI_API_KEY to .env.local and restart the server." },
        { status: 503 }
      );
    }

    const incoming = await req.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof File) || !audio.type.startsWith("audio/")) {
      return NextResponse.json({ error: "Upload a valid audio recording." }, { status: 400 });
    }
    if (audio.size === 0) {
      return NextResponse.json({ error: "The audio recording was empty." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "The recording is too large. Keep each message under 10 MB." }, { status: 413 });
    }

    const body = new FormData();
    body.append("file", audio, audio.name || "fieldready-recording.webm");
    body.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    body.append("language", "en");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error?.message || `Transcription provider error (${response.status}).`);
    }

    return NextResponse.json({ text: String(data?.text || "").trim() });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
