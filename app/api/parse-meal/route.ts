import { NextRequest, NextResponse } from "next/server";
import { parseMeal, generateBehavioralResponse, generateFoodAnswer } from "@/lib/gemini";
import { getMealsForDate } from "@/lib/storage";

// Patterns that indicate a reflective/behavioral question rather than a meal log
const BEHAVIORAL_PATTERNS = [
  /how am i doing/i,
  /am i doing okay/i,
  /how.{0,20}eating/i,
  /doing okay/i,
  /am i on track/i,
  /how.{0,15}going/i,
  /what do you think/i,
];

// Patterns that indicate a food/nutrition information question (not a meal log)
const FOOD_QUESTION_PATTERNS = [
  /\?$/,                                        // ends with ?
  /^how (much|many) /i,
  /^what (is|are|does|do) /i,
  /^does .{2,40} have /i,
  /^is .{2,30} (healthy|good|bad|high|low|rich)/i,
  /^tell me (about|how|what)/i,
  /^how (many|much).{0,30}(calorie|protein|carb|fat)/i,
  /(calorie|protein|carb|fat|nutrition|nutritional|fiber|iron|calcium).{0,30}(in|of|does|per)/i,
  /^(calorie|protein|fat|carb|nutrition).{0,30}\?/i,
  /^what.*nutrition/i,
  /^(explain|define|describe) /i,
];

// Explicit nutrition-query keywords — these override the meal-log heuristic so that
// "how much protein in 1 idli" isn't mistakenly parsed as a meal log entry.
const NUTRITION_QUERY_KEYWORDS =
  /\b(protein|calorie|caloric|kcal|carb|carbohydrate|fat|fiber|fibre|vitamin|iron|calcium|macro|micronutrient|nutrition|nutritional|glycemic|gi)\b/i;

function isBehavioralQuestion(input: string): boolean {
  return BEHAVIORAL_PATTERNS.some((p) => p.test(input));
}

// A food question should not look like a meal log either
const MEAL_LOG_HINTS = /\b(had|ate|having|with|and|pieces?|cups?|bowls?|servings?|idli|dosa|rice|sambar|coffee|tea|roti|dal)\b/i;

function isFoodQuestion(input: string): boolean {
  const hasFoodQuestionPattern = FOOD_QUESTION_PATTERNS.some((p) => p.test(input));
  if (!hasFoodQuestionPattern) return false;
  // If the question explicitly asks about a nutrient, always treat it as a question
  // even if it mentions food items (e.g. "how much protein in 1 idli")
  if (NUTRITION_QUERY_KEYWORDS.test(input)) return true;
  // Otherwise, if the input strongly looks like a meal log, don't treat as a question
  const looksLikeLog = MEAL_LOG_HINTS.test(input) && input.length < 60 && !/\?/.test(input);
  return !looksLikeLog;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const input: string = body?.input;

    if (!input || typeof input !== "string" || input.trim().length === 0) {
      return NextResponse.json({ error: "input is required" }, { status: 400 });
    }

    const trimmed = input.trim();

    // Route food/nutrition questions to Groq Q&A
    if (isFoodQuestion(trimmed) && !isBehavioralQuestion(trimmed)) {
      const answer = await generateFoodAnswer(trimmed);
      return NextResponse.json({
        food_answer: answer,
        items: [],
        meal_type: "unknown",
        context: "unknown",
        completeness: "complete",
        meal_calories_estimate: 0,
        meal_calories_range: [0, 0],
        calories_confidence: "low",
        clarification_needed: null,
      });
    }

    // Route behavioral questions to a warm response instead of meal parsing
    if (isBehavioralQuestion(trimmed)) {
      // Client passes recentMeals because localStorage is browser-only and
      // unavailable in this server-side route. Fall back to server-side attempt
      // (always returns [] in production) so we degrade gracefully.
      let mealsJson: string;
      const clientMeals = body?.recentMeals;
      if (Array.isArray(clientMeals) && clientMeals.length > 0) {
        mealsJson = JSON.stringify(clientMeals.slice(0, 30));
      } else {
        const recentDates: string[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          recentDates.push(d.toISOString().split("T")[0]);
        }
        mealsJson = JSON.stringify(recentDates.flatMap((date) => getMealsForDate(date)).slice(0, 30));
      }

      const response = await generateBehavioralResponse(mealsJson);
      return NextResponse.json({
        behavioral_response: response,
        items: [],
        meal_type: "unknown",
        context: "unknown",
        completeness: "complete",
        meal_calories_estimate: 0,
        meal_calories_range: [0, 0],
        calories_confidence: "low",
        clarification_needed: null,
      });
    }

    const parsed = await parseMeal(trimmed);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("/api/parse-meal error:", err);
    return NextResponse.json(
      { error: "Failed to parse meal. Please try again." },
      { status: 500 }
    );
  }
}
