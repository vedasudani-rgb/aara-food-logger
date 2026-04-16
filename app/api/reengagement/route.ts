import { NextRequest, NextResponse } from "next/server";
import { generateReengagement } from "@/lib/gemini";
import { buildReengagementPrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const gap_days: number = body?.gap_days ?? 5;

    const prompt = buildReengagementPrompt(gap_days);
    const message = await generateReengagement(prompt);

    return NextResponse.json({ message });
  } catch (err) {
    console.error("/api/reengagement error:", err);
    // Fallback to a static message — never expose error to user
    return NextResponse.json({
      message: "What did you have today?",
    });
  }
}
