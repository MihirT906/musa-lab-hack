"use client";

import { useEffect, useRef, useState } from "react";
import type { Msg } from "../lib/llm";
import type { PublicScenario } from "../lib/scenarios";

type Area = { score: number; note: string };
type Grade = {
  overall: number;
  safety: Area;
  order: Area;
  evidence: Area;
  fix: Area;
  summary: string;
  nextTime: string[];
};

type VoiceState = "idle" | "recording" | "transcribing";

type RecordingSession = {
  recorder: MediaRecorder;
  stream: MediaStream;
  chunks: Blob[];
  sessionId: number;
  startingText: string;
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data as T;
}

export default function Simulator({ scenarios }: { scenarios: PublicScenario[] }) {
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [error, setError] = useState("");
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const endRef = useRef<HTMLDivElement>(null);
  const recordingRef = useRef<RecordingSession | null>(null);
  // Bumped on every scenario load so replies from an abandoned call are dropped.
  const session = useRef(0);

  const active = scenarios.find((s) => s.id === activeId)!;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, grade, busy]);

  useEffect(() => {
    return () => cancelRecording();
  }, []);

  function cancelRecording() {
    const recording = recordingRef.current;
    recordingRef.current = null;
    if (!recording) return;
    recording.recorder.ondataavailable = null;
    recording.recorder.onerror = null;
    recording.recorder.onstop = null;
    if (recording.recorder.state !== "inactive") recording.recorder.stop();
    recording.stream.getTracks().forEach((track) => track.stop());
  }

  async function startRecording() {
    if (busy || grading || grade || voiceState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Audio recording is not supported in this browser. You can still type your response.");
      return;
    }

    setError("");
    const sessionId = session.current;
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (sessionId !== session.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(
        (type) => MediaRecorder.isTypeSupported(type)
      );
      const recorder = preferredType
        ? new MediaRecorder(stream, { mimeType: preferredType })
        : new MediaRecorder(stream);
      const recording: RecordingSession = {
        recorder,
        stream,
        chunks: [],
        sessionId,
        startingText: input.trim(),
      };

      recorder.ondataavailable = (event) => {
        if (event.data.size) recording.chunks.push(event.data);
      };
      recorder.onerror = () => {
        if (recording.sessionId === session.current) {
          setError("Audio recording stopped unexpectedly. Please try again or type your response.");
          setVoiceState("idle");
        }
        cancelRecording();
      };
      recorder.onstop = () => {
        if (recordingRef.current !== recording) return;
        recordingRef.current = null;
        recording.stream.getTracks().forEach((track) => track.stop());
        const audio = new Blob(recording.chunks, { type: recorder.mimeType || "audio/webm" });
        void transcribeRecording(audio, recording);
      };

      recordingRef.current = recording;
      recorder.start();
      setVoiceState("recording");
    } catch (err) {
      stream?.getTracks().forEach((track) => track.stop());
      setVoiceState("idle");
      const name = (err as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Microphone access was not allowed. Enable it for this site or use the text box."
          : (err as Error).message || "Audio recording could not be started."
      );
    }
  }

  async function transcribeRecording(audio: Blob, recording: RecordingSession) {
    if (recording.sessionId !== session.current) return;
    if (!audio.size) {
      setVoiceState("idle");
      setError("No audio was captured. Click the microphone and try again.");
      return;
    }

    setVoiceState("transcribing");
    try {
      const form = new FormData();
      form.append("audio", audio, audio.type.includes("mp4") ? "voice.m4a" : "voice.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status}).`);
      if (recording.sessionId !== session.current) return;
      const transcript = String(data.transcript || "").trim();
      if (!transcript) throw new Error("No speech was detected. Please record again.");
      setInput([recording.startingText, transcript].filter(Boolean).join(" "));
    } catch (err) {
      if (recording.sessionId === session.current) setError((err as Error).message);
    } finally {
      if (recording.sessionId === session.current) setVoiceState("idle");
    }
  }

  function toggleRecording() {
    if (voiceState === "recording") {
      setVoiceState("transcribing");
      recordingRef.current?.recorder.stop();
    } else if (voiceState === "idle") {
      void startRecording();
    }
  }

  function load(id: string) {
    cancelRecording();
    session.current++;
    setActiveId(id);
    setBusy(false);
    setGrading(false);
    setMessages([]);
    setGrade(null);
    setError("");
    setInput("");
    setVoiceState("idle");
  }

  function shuffle() {
    const others = scenarios.filter((s) => s.id !== activeId);
    load(others[Math.floor(Math.random() * others.length)].id);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy || grade) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setBusy(true);
    const id = session.current;
    try {
      const { reply } = await post<{ reply: string }>("/api/chat", {
        scenarioId: activeId,
        messages: next,
      });
      if (id !== session.current) return;
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      if (id !== session.current) return;
      // Drop the unanswered message so a retry doesn't send it twice.
      setMessages(messages);
      setInput(text);
      setError((err as Error).message);
    } finally {
      if (id === session.current) setBusy(false);
    }
  }

  async function finish() {
    if (busy || grading || messages.length === 0) return;
    setError("");
    setGrading(true);
    const id = session.current;
    try {
      const result = await post<Grade>("/api/grade", { scenarioId: activeId, messages });
      if (id === session.current) setGrade(result);
    } catch (err) {
      if (id === session.current) setError((err as Error).message);
    } finally {
      if (id === session.current) setGrading(false);
    }
  }

  return (
    <main className="shell">
      <aside className="glass side">
        <div className="brand">
          <h1>FieldReady</h1>
          <p>Practice the service call before it is real. Question the homeowner, take readings, then give your diagnosis.</p>
        </div>
        <button className="btn shuffle" onClick={shuffle}>
          Shuffle scenario
        </button>
        <nav className="list" aria-label="Scenarios">
          {scenarios.map((s) => (
            <button
              key={s.id}
              className={`card ${s.id === activeId ? "on" : ""}`}
              aria-current={s.id === activeId}
              onClick={() => load(s.id)}
            >
              <span className="tags">
                <span className={`tag ${s.trade.toLowerCase()}`}>{s.trade}</span>
                <span className={`tag level ${s.difficulty === "Dangerous" ? "danger" : ""}`}>
                  {s.difficulty}
                </span>
              </span>
              <span className="cardTitle">{s.title}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="glass chat">
        <header className="chatHead">
          <div>
            <div className="eyebrow">
              {active.trade} call · {active.difficulty}
            </div>
            <h2>{active.title}</h2>
          </div>
          <button
            className="btn primary"
            onClick={finish}
            disabled={busy || grading || messages.length === 0 || !!grade}
          >
            {grading ? "Grading…" : "Finish and get score"}
          </button>
        </header>

        <div className="thread">
          <div className="bubble them">
            <span className="who">Homeowner</span>
            {active.opening}
          </div>
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.role === "user" ? "me" : "them"}`}>
              {m.role === "user" && <span className="who">You</span>}
              {m.content}
            </div>
          ))}
          {busy && <div className="bubble them pending">Waiting for a reply…</div>}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          {grade && (
            <div className="glass score">
              <div className="scoreTop">
                <div className="big">{grade.overall}</div>
                <div>
                  <div className="eyebrow">Overall score out of 100</div>
                  <p>{grade.summary}</p>
                </div>
              </div>
              <div className="areas">
                {(
                  [
                    ["Safety steps", grade.safety],
                    ["Diagnostic order", grade.order],
                    ["Use of evidence", grade.evidence],
                    ["Right fix", grade.fix],
                  ] as [string, Area][]
                ).map(([label, a]) => (
                  <div key={label} className="area">
                    <div className="areaHead">
                      <span>{label}</span>
                      <strong>{a.score}</strong>
                    </div>
                    <div className="bar">
                      <div style={{ width: `${a.score}%` }} />
                    </div>
                    <p>{a.note}</p>
                  </div>
                ))}
              </div>
              {grade.nextTime.length > 0 && (
                <div>
                  <div className="eyebrow">Next time</div>
                  <ul>
                    {grade.nextTime.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="scoreActions">
                <button className="btn" onClick={() => load(activeId)}>
                  Retry this call
                </button>
                <button className="btn primary" onClick={shuffle}>
                  Next scenario
                </button>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form className="composer" onSubmit={send}>
          <button
            type="button"
            className={`mic ${voiceState === "recording" ? "recording" : ""}`}
            disabled={busy || grading || !!grade || voiceState === "transcribing"}
            aria-label={voiceState === "recording" ? "Stop recording" : "Start recording"}
            title={voiceState === "recording" ? "Stop recording" : "Record voice message"}
            onClick={toggleRecording}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="9" y="3" width="6" height="11" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </button>
          <label className="srOnly" htmlFor="say">
            Your message
          </label>
          <input
            id="say"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              grade
                ? "Call finished. Retry or pick another scenario."
                : voiceState === "recording"
                  ? "Recording… click the microphone when you finish"
                  : voiceState === "transcribing"
                    ? "Gemini is transcribing your recording…"
                  : "Ask a question, take a reading, or state your diagnosis and fix"
            }
            disabled={busy || grading || !!grade || voiceState !== "idle"}
            autoComplete="off"
          />
          <button
            className="btn primary"
            type="submit"
            disabled={busy || grading || !input.trim() || !!grade || voiceState !== "idle"}
          >
            Send
          </button>
          <span className="srOnly" aria-live="polite">
            {voiceState === "recording"
              ? "Recording. Click the microphone when you finish speaking."
              : voiceState === "transcribing"
                ? "Gemini is transcribing your recording."
                : ""}
          </span>
        </form>
      </section>
    </main>
  );
}
