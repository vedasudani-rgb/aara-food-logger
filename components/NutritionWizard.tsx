"use client";
import { useState, useRef, useEffect, useCallback } from "react";

export function NutritionWizard() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleAsk = useCallback(async () => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setAnswer(null);
    try {
      // Collect recent meals from localStorage so behavioral questions
      // ("how am I doing") have real data — the API route is server-side
      // and cannot access localStorage itself.
      const recentMeals: unknown[] = [];
      if (typeof window !== "undefined") {
        for (let i = 0; i < 14; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const key = `logs:${d.toISOString().split("T")[0]}`;
          try {
            const raw = localStorage.getItem(key);
            if (raw) recentMeals.push(...JSON.parse(raw));
          } catch { /* ignore */ }
        }
      }
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: question, recentMeals }),
      });
      if (!res.ok) {
        setAnswer("Couldn't get an answer right now. Please try again.");
        return;
      }
      const data = await res.json();
      if (data.food_answer) {
        setAnswer(data.food_answer);
      } else if (data.behavioral_response) {
        setAnswer(data.behavioral_response);
      } else {
        setAnswer("That looks like a meal log — use the log button above to save it.");
      }
    } catch {
      setAnswer("Couldn't get an answer right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [question, loading]);

  const handleClose = () => {
    setOpen(false);
    setQuestion("");
    setAnswer(null);
  };

  return (
    <>
      {/* FAB — larger, more prominent pill */}
      {!open && (
        <div className="fixed z-40" style={{ bottom: 100, right: 20 }}>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center gap-2.5 rounded-full font-semibold shadow-xl"
            style={{
              backgroundColor: "#C4633A",
              color: "#fff",
              padding: "14px 22px",
              fontSize: 15,
              letterSpacing: "-0.01em",
              boxShadow: "0 6px 24px rgba(196,99,58,0.45)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Ask Aara
          </button>
        </div>
      )}

      {/* Expanded panel */}
      {open && (
        <div
          className="fixed z-40 rounded-2xl shadow-xl overflow-hidden"
          style={{
            bottom: 100,
            right: 20,
            width: 320,
            backgroundColor: "#fff",
            border: "1.5px solid #e5e0d8",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 pt-3.5 pb-2.5"
            style={{ borderBottom: "1px solid #f0e8de" }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "#C4633A" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <p className="text-sm font-semibold" style={{ color: "#3D3D3D" }}>
                Ask Aara
              </p>
            </div>
            <button
              onClick={handleClose}
              className="w-6 h-6 rounded-full flex items-center justify-center text-sm leading-none"
              style={{ backgroundColor: "#f0e8de", color: "#3D3D3D" }}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3.5">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAsk()}
                placeholder="e.g. How much protein in 1 idli?"
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{
                  border: "1.5px solid #e5e0d8",
                  color: "#3D3D3D",
                  backgroundColor: "#FAFAF8",
                  fontSize: 13,
                }}
              />
              <button
                onClick={handleAsk}
                disabled={!question.trim() || loading}
                className="rounded-xl px-3.5 py-2.5 text-sm font-semibold shrink-0"
                style={{
                  backgroundColor: "#C4633A",
                  color: "#fff",
                  opacity: !question.trim() || loading ? 0.4 : 1,
                  transition: "opacity 0.15s",
                  fontSize: 13,
                }}
              >
                {loading ? "…" : "Ask"}
              </button>
            </div>

            {answer && (
              <div
                className="mt-3 rounded-xl px-3.5 py-3 text-sm leading-relaxed"
                style={{ backgroundColor: "#FBF7F0", color: "#3D3D3D", fontSize: 13 }}
              >
                {answer}
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 pb-3.5">
            <p style={{ color: "#3D3D3D", opacity: 0.35, fontSize: 11 }}>
              Try: protein in dosa · kcal in idli · am I eating well?
            </p>
          </div>
        </div>
      )}
    </>
  );
}
