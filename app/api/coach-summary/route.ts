import { NextRequest, NextResponse } from "next/server";
import { callGroq } from "@/lib/gemini";
import { buildCoachSummaryPrompt, CoachSummaryInput } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input = body as CoachSummaryInput;

    if (!input || typeof input.timeframeDays !== "number") {
      return NextResponse.json({ error: "valid CoachSummaryInput is required" }, { status: 400 });
    }

    const prompt = buildCoachSummaryPrompt(input);
    const summary = await callGroq(
      "You are a clinical nutrition coach assistant. Generate precise, data-driven summaries.",
      prompt,
      { temperature: 0.2, maxTokens: 800 }
    );

    return NextResponse.json({ summary });
  } catch (err) {
    console.error("/api/coach-summary error:", err);
    return NextResponse.json({ error: "Failed to generate summary." }, { status: 500 });
  }
}
