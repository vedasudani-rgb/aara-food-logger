import { NextRequest, NextResponse } from "next/server";
import { callGroq, callGeminiText } from "@/lib/gemini";
import { buildCoachSummaryPrompt, CoachSummaryInput } from "@/lib/prompts";

const SYSTEM = "You are a clinical nutrition coach assistant. Generate precise, data-driven summaries.";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body as CoachSummaryInput;

    if (!input || typeof input.timeframeDays !== "number") {
      return NextResponse.json({ error: "valid CoachSummaryInput is required" }, { status: 400 });
    }

    const prompt = buildCoachSummaryPrompt(input);

    let summary: string;
    try {
      summary = await callGroq(SYSTEM, prompt, { temperature: 0.2, maxTokens: 1200 });
    } catch (groqErr) {
      console.warn("Groq coach-summary failed, trying Gemini fallback:", groqErr);
      summary = await callGeminiText(`${SYSTEM}\n\n${prompt}`, { temperature: 0.2 });
    }

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("/api/coach-summary error:", err);
    return NextResponse.json({ error: "Failed to generate summary." }, { status: 500 });
  }
}
