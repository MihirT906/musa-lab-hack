import { NextResponse } from "next/server";
import { transcribeAudio } from "../../../lib/llm";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/mpeg",
  "audio/mp3",
]);

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "No audio recording was received." }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: "The recording is too long. Keep each voice message under one minute." },
        { status: 413 }
      );
    }

    const mimeType = audio.type.split(";", 1)[0].toLowerCase();
    if (!SUPPORTED_AUDIO_TYPES.has(mimeType)) {
      return NextResponse.json(
        { error: `This browser recorded an unsupported audio format (${mimeType || "unknown"}).` },
        { status: 415 }
      );
    }

    const audioData = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const transcript = await transcribeAudio(audioData, mimeType);
    return NextResponse.json({ transcript });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
