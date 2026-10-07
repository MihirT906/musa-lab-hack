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
  const [voiceState, setVoiceState] = useState<"idle" | "requesting" | "recording" | "transcribing">("idle");
  const endRef = useRef<HTMLDivElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Bumped on every scenario load so replies from an abandoned call are dropped.
  const session = useRef(0);

  const active = scenarios.find((s) => s.id === activeId)!;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, grade, busy]);

  useEffect(() => {
    return () => cancelRecording();
  }, []);

  function releaseStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function cancelRecording() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder?.state === "recording") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stop();
    }
    chunksRef.current = [];
    releaseStream();
  }

  async function transcribe(blob: Blob, sessionId: number) {
    if (blob.size === 0) {
      setError("No audio was captured. Click the microphone, speak, then click it again to stop.");
      setVoiceState("idle");
      return;
    }

    setVoiceState("transcribing");
    try {
      const extension = blob.type.includes("mp4") ? "mp4" : "webm";
      const form = new FormData();
      form.append("audio", blob, `fieldready-recording.${extension}`);
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (sessionId !== session.current) return;
      if (!res.ok) throw new Error(data.error || `Transcription failed (${res.status}).`);

      const text = String(data.text || "").trim();
      if (!text) throw new Error("No speech was detected. Try recording for a little longer.");
      setInput((current) => (current.trim() ? `${current.trim()} ${text}` : text));
    } catch (err) {
      if (sessionId === session.current) setError((err as Error).message);
    } finally {
      if (sessionId === session.current) setVoiceState("idle");
    }
  }

  async function startRecording() {
    if (busy || grading || grade || voiceState !== "idle") return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice input is not supported in this browser. You can still type your response.");
      return;
    }

    setError("");
    const recordingSession = session.current;
    setVoiceState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recordingSession !== session.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type)
      );
      const recorder = new MediaRecorder(stream, preferredType ? { mimeType: preferredType } : undefined);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The recording could not be completed. Please try again or type your response.");
        cancelRecording();
        setVoiceState("idle");
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        recorderRef.current = null;
        releaseStream();
        void transcribe(blob, recordingSession);
      };

      recorder.start();
      setVoiceState("recording");
    } catch (err) {
      releaseStream();
      if (recordingSession !== session.current) return;
      setVoiceState("idle");
      const name = (err as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Microphone access was not allowed. Enable it for this site or use the text box."
          : "The microphone could not be started. Please try again or type your response."
      );
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }

  function toggleRecording() {
    if (voiceState === "recording") stopRecording();
    else if (voiceState === "idle") void startRecording();
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
            disabled={busy || grading || !!grade || voiceState === "requesting" || voiceState === "transcribing"}
            aria-label={voiceState === "recording" ? "Stop recording and transcribe" : "Start voice recording"}
            title={voiceState === "recording" ? "Stop recording and transcribe" : "Start voice recording"}
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
                  : voiceState === "requesting"
                    ? "Waiting for microphone access…"
                    : voiceState === "transcribing"
                      ? "Turning your speech into text…"
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
              : voiceState === "requesting"
                ? "Waiting for microphone access."
                : voiceState === "transcribing"
                  ? "Transcribing your recording."
                  : ""}
          </span>
        </form>
      </section>
    </main>
  );
}
