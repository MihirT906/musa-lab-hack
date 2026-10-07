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

type BrowserSpeechResult = {
  isFinal: boolean;
  0?: { transcript: string };
};

type BrowserSpeechEvent = Event & {
  resultIndex: number;
  results: { length: number; [index: number]: BrowserSpeechResult };
};

type BrowserSpeechErrorEvent = Event & { error: string };

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: BrowserSpeechEvent) => void) | null;
  onerror: ((event: BrowserSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

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
  const [voiceState, setVoiceState] = useState<"idle" | "listening">("idle");
  const endRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  // Bumped on every scenario load so replies from an abandoned call are dropped.
  const session = useRef(0);

  const active = scenarios.find((s) => s.id === activeId)!;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, grade, busy]);

  useEffect(() => {
    return () => cancelRecognition();
  }, []);

  function cancelRecognition() {
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.abort();
  }

  function startRecognition() {
    if (busy || grading || grade || voiceState !== "idle") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported in this browser. You can still type your response.");
      return;
    }

    setError("");
    const recognitionSession = session.current;
    const startingText = input.trim();
    let finalText = "";
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      if (recognitionSession !== session.current) return;
      let interimText = "";
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const text = event.results[index][0]?.transcript.trim() || "";
        if (event.results[index].isFinal) finalText = `${finalText} ${text}`.trim();
        else interimText = `${interimText} ${text}`.trim();
      }
      setInput([startingText, finalText, interimText].filter(Boolean).join(" "));
    };

    recognition.onerror = (event) => {
      if (recognitionSession !== session.current || event.error === "aborted") return;
      const message =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was not allowed. Enable it for this site or use the text box."
          : event.error === "no-speech"
            ? "No speech was detected. Click the microphone and try again."
            : event.error === "network"
              ? "Speech recognition could not reach the browser service. You can still type your response."
              : "Speech recognition stopped unexpectedly. Please try again or type your response.";
      setError(message);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      if (recognitionSession === session.current) setVoiceState("idle");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setVoiceState("listening");
    } catch (err) {
      recognitionRef.current = null;
      setVoiceState("idle");
      setError((err as Error).message || "Speech recognition could not be started.");
    }
  }

  function stopRecognition() {
    recognitionRef.current?.stop();
  }

  function toggleRecognition() {
    if (voiceState === "listening") stopRecognition();
    else if (voiceState === "idle") startRecognition();
  }

  function load(id: string) {
    cancelRecognition();
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
            className={`mic ${voiceState === "listening" ? "listening" : ""}`}
            disabled={busy || grading || !!grade}
            aria-label={voiceState === "listening" ? "Stop voice recognition" : "Start voice recognition"}
            title={voiceState === "listening" ? "Stop voice recognition" : "Start voice recognition"}
            onClick={toggleRecognition}
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
                : voiceState === "listening"
                  ? "Listening… click the microphone when you finish"
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
            {voiceState === "listening" ? "Listening. Click the microphone when you finish speaking." : ""}
          </span>
        </form>
      </section>
    </main>
  );
}
