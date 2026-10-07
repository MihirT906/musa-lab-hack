"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicScenario } from "../lib/scenarios";

type Msg = { role: "user" | "assistant"; content: string };
type Area = { score: number; note: string };
type Grade = {
  overall: number;
  safety: Area;
  order: Area;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
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
  const endRef = useRef<HTMLDivElement>(null);

  const active = scenarios.find((s) => s.id === activeId)!;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, grade, busy]);

  function load(id: string) {
    setActiveId(id);
    setMessages([]);
    setGrade(null);
    setError("");
    setInput("");
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
    try {
      const { reply } = await post<{ reply: string }>("/api/chat", {
        scenarioId: activeId,
        messages: next,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    if (grading || messages.length === 0) return;
    setError("");
    setGrading(true);
    try {
      setGrade(await post<Grade>("/api/grade", { scenarioId: activeId, messages }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGrading(false);
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
            disabled={grading || messages.length === 0 || !!grade}
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
            className="mic"
            disabled
            aria-label="Voice input, coming soon"
            title="Voice input is coming soon"
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
                : "Ask a question, take a reading, or state your diagnosis and fix"
            }
            disabled={busy || !!grade}
            autoComplete="off"
          />
          <button className="btn primary" type="submit" disabled={busy || !input.trim() || !!grade}>
            Send
          </button>
        </form>
      </section>
    </main>
  );
}
