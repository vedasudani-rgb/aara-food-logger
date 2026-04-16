import { GoogleGenerativeAI } from "@google/generative-ai";
import { ParsedMeal } from "@/lib/types";
import { PARSE_MEAL_PROMPT, COACH_SUMMARY_PROMPT } from "@/lib/prompts";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenerativeAI(key);
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1) return text.slice(start, end + 1);
  return text.trim();
}

// Shared Groq helper — used as primary for all non-meal-parse LLM calls
export async function callGroq(
  systemPrompt: string,
  userContent: string,
  options?: { temperature?: number; maxTokens?: number; jsonMode?: boolean }
): Promise<string> {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not set");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 1024,
      ...(options?.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Groq error: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content as string;
}

export async function parseMealWithGemini(input: string): Promise<ParsedMeal> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: `${PARSE_MEAL_PROMPT}\n\nUser input: ${input}` }],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const text = result.response.text();
  const json = extractJson(text);
  return JSON.parse(json) as ParsedMeal;
}

export async function parseMealWithGroq(input: string): Promise<ParsedMeal> {
  const text = await callGroq(PARSE_MEAL_PROMPT, `User input: ${input}`, {
    temperature: 0.2,
    jsonMode: true,
  });
  return JSON.parse(extractJson(text)) as ParsedMeal;
}

// Try Groq first (faster, avoids Gemini quota issues), fall back to Gemini
export async function parseMeal(input: string): Promise<ParsedMeal> {
  try {
    return await parseMealWithGroq(input);
  } catch (groqErr) {
    console.warn("Groq failed, trying Gemini fallback:", groqErr);
    return await parseMealWithGemini(input);
  }
}

// Generic Gemini text call — used as fallback when Groq is unavailable
export async function callGeminiText(
  prompt: string,
  options?: { temperature?: number }
): Promise<string> {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: { temperature: options?.temperature ?? 0.3 },
  });
  return result.response.text();
}

export async function generateCoachSummary(mealsJson: string): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: `${COACH_SUMMARY_PROMPT}\n\nMeals data:\n${mealsJson}` }],
        },
      ],
      generationConfig: { temperature: 0.3 },
    });
    return result.response.text();
  } catch {
    return await callGroq(COACH_SUMMARY_PROMPT, `Meals data:\n${mealsJson}`, {
      temperature: 0.3,
      maxTokens: 1500,
    });
  }
}

export async function generateReengagement(prompt: string): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 100 },
    });
    return result.response.text().trim();
  } catch {
    return await callGroq("You generate brief, warm re-engagement messages.", prompt, {
      temperature: 0.7,
      maxTokens: 80,
    });
  }
}

export async function generateFoodAnswer(question: string): Promise<string> {
  const systemPrompt = `You are Aara, a knowledgeable food assistant specializing in South Indian and Indian cuisine.
Answer the user's food or nutrition question concisely and helpfully.
Use IFCT 2017 values where applicable. Mention that values are approximate for home cooking.
Keep answers to 2–4 sentences. Plain text only — no markdown, no lists.
Never judge what the user eats. Never add suggestions unless directly asked.`;

  try {
    return await callGroq(systemPrompt, question, { temperature: 0.4, maxTokens: 150 });
  } catch {
    return "Sorry, I couldn't look that up right now. Try again in a moment.";
  }
}

export async function generateBehavioralResponse(mealsJson: string): Promise<string> {
  const systemPrompt = `The user asked how their eating is going. Generate a warm, honest, non-judgmental 2–3 sentence behavioral observation.
Tone: like a thoughtful friend, not a nutritionist. Focus on patterns (timing, variety, completeness), never calories.
No suggestions. No "you should". No guilt. No praise for restriction. No mentions of weight.
Output: message text only, no JSON.`;

  try {
    return await callGroq(systemPrompt, `Meal data: ${mealsJson}`, {
      temperature: 0.7,
      maxTokens: 120,
    });
  } catch {
    return "Your eating looks pretty consistent — a mix of home-cooked meals across the day. Keep going at your own pace.";
  }
}
