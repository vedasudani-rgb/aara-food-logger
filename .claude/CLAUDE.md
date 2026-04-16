# AI Food Logger — Current State (as of April 16, 2026, last updated April 16, 2026 — v3)

**Thesis:** Capture anything, forgive everything, surface pattern not precision. Voice-first, guilt-free, South Indian food–aware.
**User:** Megha (Chennai, vegetarian, home-cooked South Indian). **Coach:** Kavitha (needs behavioral signal, not calorie precision).

## Stack
- **Next.js 14** (App Router) + **Tailwind CSS** (custom components — no shadcn/ui)
- **Layout:** `max-w-md` (448px) centered, mobile-first
- **Primary LLM:** Groq `llama-3.3-70b-versatile` (`GROQ_API_KEY`) — primary for all LLM calls: meal parsing, coach summary, behavioral responses, food Q&A, re-engagement messages.
- **Fallback LLM:** Gemini 2.0 Flash (`@google/generative-ai`) — fallback when Groq is unavailable. Key: `GEMINI_API_KEY`. Env var `GEMINI_MODEL` overrides model (default: `gemini-2.0-flash`).
- **Rate limits (free tier):** Groq 100k tokens/day rolling window; Gemini 15 req/min. Both can be exhausted under heavy testing — if parsing fails, wait a few minutes for the window to clear.
- **Voice:** Web Speech API (`lang: "en-IN"`, `continuous: true`) — no key, no cost
- **Storage:** localStorage only — `logs:YYYY-MM-DD` (array of MealEntry), `settings:user`

## File Structure (actual)
```
app/
  layout.tsx                 # Root layout — max-w-md wrapper, bg #FBF7F0
  page.tsx                   # Home — today's timeline + voice/text input + snack nudge
  day/[date]/page.tsx        # Day view — date nav, past/future handling, same log flow
  week/[week]/page.tsx       # Week view — ISO week grid + per-day cards, keyboard nav
  coach/page.tsx             # Coach dashboard (password: "kavitha") — all coach UI inlined here
  api/
    parse-meal/route.ts      # POST {input, recentMeals?} → routes to food Q&A | behavioral | meal parse
    coach-summary/route.ts   # POST CoachSummaryInput → Groq summary (markdown), Gemini fallback
    reengagement/route.ts    # POST {gap_days} → Gemini/Groq warm re-entry message

components/
  VoiceLogButton.tsx         # Hold-to-speak circle, pulse animation, text mode fallback
  ConfirmationCard.tsx       # Bottom sheet — meal type selector, ChipEditor list, add food, re-parse
  ChipEditor.tsx             # Inline quantity editor — countable (stepper) | beverage | grain | volumetric
  MealTimeline.tsx           # 3 meal slots + snack section + drag-and-drop + MealDetailSheet
  WeekGrid.tsx               # Mon–Sun dot grid + protein color band
  NutritionWizard.tsx        # Floating "Ask Aara" FAB — food Q&A + behavioral questions
  SnackNudge.tsx             # 4pm multi-select snack quick-add card

lib/
  types.ts                   # MealItem, MealEntry, ParsedMeal, UserProfile, CoachProfile
  storage.ts                 # localStorage CRUD — getMealsForDate/Week, saveMeal, updateMeal, deleteMeal, getDaysSinceLastLog
  gemini.ts                  # parseMeal (Groq→Gemini), callGroq, callGeminiText, generateCoachSummary, generateReengagement, generateFoodAnswer, generateBehavioralResponse
  prompts.ts                 # PARSE_MEAL_PROMPT, buildCoachSummaryPrompt, buildReengagementPrompt, buildUserBehaviorPrompt, CoachSummaryInput type
  dates.ts                   # ISO week utils, extractISTMinutes, minutesToTimeStr, shortDayName/DateLabel
  seedData.ts                # April 1–15 2026 demo data — seeded into localStorage on first load

hooks/
  useVoiceInput.ts           # SpeechRecognition wrapper — continuous, en-IN, MIN_HOLD_MS=300, timeout stops (not switches to text)
  useMealLog.ts              # useState wrapper for storage CRUD + todayIST() + nowIST()
```

## Core Flow
1. User holds voice button (or types) → `useVoiceInput` captures transcript → `POST /api/parse-meal`
2. API route **classifies** input first:
   - **Food/nutrition question** (e.g. "how much protein in idli?") → `generateFoodAnswer` via Groq → returns `food_answer`
   - **Behavioral question** (e.g. "am I doing okay?") → `generateBehavioralResponse` via Groq, uses `recentMeals` from client → returns `behavioral_response`
   - **Meal log** → `parseMeal` (Groq first, Gemini fallback) → returns `ParsedMeal` JSON
3. `ConfirmationCard` slides up with ChipEditor chips → user edits if needed → confirm → `saveMeal` → localStorage
4. `NutritionWizard` FAB (fixed, bottom-right) handles food/behavioral questions inline without going through the log flow

**Mic denied / STT unavailable:** switches to text mode. Timeout (30s) just stops recording, stays in voice mode. `MIN_HOLD_MS=300` prevents accidental taps.

## Data Schema (`lib/types.ts`)
```typescript
interface MealItem {
  name: string              // preserve Tamil/user term
  quantity: string          // vague OK: "medium portion", "2-3 pieces"
  confidence: number
  inferred: boolean         // AI-guessed → dotted border on chip
  category: "grain"|"protein"|"vegetable"|"fat"|"dairy"|"beverage"|"snack"|"dessert"
  protein_level: "low"|"medium"|"high"|"unknown"
  calories_estimate: number // IFCT 2017
  calories_range: [number, number]
  edited_by_user?: boolean
}
interface MealEntry {
  meal_id: string           // uuid
  timestamp_logged: string  // ISO8601 +05:30 (when the log was submitted)
  timestamp_meal: string    // ISO8601 +05:30 (when the meal was eaten, back-dated if time_hint given)
  logged_late: boolean
  raw_input: string
  input_modality: "voice"|"text"
  meal_type: "breakfast"|"lunch"|"dinner"|"snack"
  context: "home"|"restaurant"|"social_occasion"|"festival"|"travel"|"unknown"
  items: MealItem[]
  meal_calories_estimate: number
  meal_calories_range: [number, number]
  calories_confidence: "low"|"medium"|"high"
  completeness: "complete"|"approximate"|"partial"
  quantity_certainty: "shared_bowl"|"self_reported"|"estimated"
  edited_by_user: boolean
}
interface ParsedMeal {      // returned by /api/parse-meal
  items: MealItem[]
  meal_type: MealType | "unknown"
  context: MealContext
  completeness: Completeness
  meal_calories_estimate: number
  meal_calories_range: [number, number]
  calories_confidence: CaloriesConfidence
  clarification_needed: string | null
  time_hint?: string | null       // "HH:MM" 24h if time mentioned in input
  behavioral_response?: string    // set for "how am I doing?" type inputs
  food_answer?: string            // set for nutrition Q&A inputs
}
```

## PARSE_MEAL_PROMPT (actual, in `lib/prompts.ts`)
```
You are Aara, a food logging assistant for Indian users, specializing in South Indian cuisine.
Parse the user's meal description into structured JSON.

SOUTH INDIAN DISH GLOSSARY:
Idli: steamed rice-lentil cakes, 2–4/serving | Dosa: rice-lentil crepe, 1–2/serving
Sambar: lentil-vegetable soup, 1 katori | Rasam: thin tamarind broth, 1 small bowl
Kootu: vegetable+coconut-lentil curry, 3 tbsp | Poriyal: dry vegetable stir fry, 3 tbsp
Mor kuzhambu: buttermilk curry | Puli sadam: tamarind rice | Vazhaipoo kootu: banana flower curry
Sundal: boiled legume stir fry (HIGH PROTEIN — flag) | Filter coffee/tea: 50ml milk, 1–2 tsp sugar
Murukku/chakli/mixture: fried snacks ~25–30g/handful | Payasam/kheer: dessert
Dark chocolate/chocolate: 1–2 pieces/squares per serving — always count in pieces, never bowls

IFCT 2017 CALORIES (NIN/ICMR):
Idli 58/piece | Dosa 112/piece | Rice 195/cup | Sambar 35/katori | Rasam 16/bowl
Kootu 48/3tbsp | Poriyal 55/3tbsp | Curd 60/katori | Sundal 131/katori
Filter coffee 42/cup | Murukku 117/handful | Chapati 71/piece
Portion scale: small=0.6×, medium=1.0×, large=1.5×. Non-listed → category avg, confidence=low.

RULES:
1. Accept vague quantities. "some kootu"→"medium portion". "2-3 idlis"→"2-3 pieces".
2. ANY mention of "rice meal", "rice meals", "rice at home", "typical rice meal", "simple rice meal", "usual rice", "home rice", "rice and curry", "rice and sambar", or similar → infer the standard South Indian plate: rice + sambar/rasam + kootu/poriyal + curd. Mark ALL inferred items with inferred:true. DO NOT ask for clarification on these inputs.
3. Accept Tamil-English code-switching. Never translate dish names to English.
4. Shared bowls → prefix quantity "~". Never ask for weights.
5. Never comment on healthiness or calories.
6. Unknown dish → ONE question: "Is [dish] a rice dish, curry, or snack?" — only for truly unrecognizable items, NOT for common rice meal phrasings.
7. Festival/celebration → tag context, skip precise portion estimates.
8. Ignore any calorie numbers the user mentions.
9. If the user mentions a time (e.g. "at 9am", "around 1pm", "at noon"), extract it as time_hint in 24h HH:MM format. Convert: noon→"12:00", midnight→"00:00". If no time is mentioned, set time_hint: null.
10. Piece-countable items (idli, dosa, chapati, roti, vadai, biscuit, cookie, chocolate squares, laddoo, barfi, modak, samosa, bread slices) → quantity must use "pieces" or "piece", never "bowl" or "katori".

OUTPUT (strict JSON):
{"items":[...],"meal_type":"breakfast|lunch|dinner|snack|unknown",
"context":"home|restaurant|social_occasion|festival|travel|unknown",
"completeness":"complete|approximate|partial",
"meal_calories_estimate":number,"meal_calories_range":[n,n],
"calories_confidence":"low|medium|high","clarification_needed":null,"time_hint":null}
```

## `ChipEditor.tsx` — Editor type classification
- **Countable (stepper ±0.5):** idli, dosa, chapati, roti, murukku, vadai, vada, puri, paratha, uttapam, adai, paniyaram, laddoo, naan, bread, samosa, bonda, bajji, **chocolate, biscuit, cookie, cracker, date, fig, laddu, mithai, sweet, barfi, peda, modak**
- **Beverage:** coffee, tea, chai, juice, water, milk, lassi, buttermilk, mor, sherbet, soda
- **Volumetric grain (serving):** rice, pongal, upma, oats, rava, semolina, poha, puli sadam, tamarind rice, curd rice, lemon rice
- **Volumetric default (bowl):** everything else (curries, sambar, kootu, etc.)

Size selector (small/medium/large) is shown for ALL editor types.

## `/api/parse-meal` — Routing logic
Three classifiers run on every input:
1. `isBehavioralQuestion()` — regex patterns: "how am I doing", "am I doing okay", "how.*eating", "am I eating well", "is my diet okay", etc.
2. `isFoodQuestion()` — ends with `?`, "how much/many", "what is/are", nutrient keywords. If also matches meal-log hints AND no `?` AND short → treated as log, not question.
3. Everything else → `parseMeal()`

Priority: food question (if not behavioral) → behavioral → meal parse.
Client passes `recentMeals` array for behavioral questions (localStorage is browser-only).

**Known crash patterns (fixed):**
- When the LLM returns a clarification-only response (`{"clarification_needed": "..."}` with no other fields), `parsedMeal.context` is `undefined`. `ConfirmationCard` now guards `contextLabel` and `completenessLabel` with a truthiness check before `.replace()`. Both page files also use `Array.isArray(data.items)` guard when spreading items — including in `handleReparse` (previously missing). `NutritionWizard` checks `res.ok` before reading the response body.
- "I had a typical rice meal" / "I had a rice meal at home" were sometimes returned as `clarification_needed` by the LLM. Fixed by strengthening Rule 2 in `PARSE_MEAL_PROMPT` to be explicit about all common "rice meal" phrasings.
- `handleReparse` in both `app/page.tsx` and `app/day/[date]/page.tsx` lacked the `Array.isArray(data.items)` guard, which could throw if the LLM returned a clarification-only response. Fixed.
- Coach summary Behavioral Flags section was returning "Insufficient data" even with 16 days of data. Fixed by adding explicit behavioral flag derivation rules to `buildCoachSummaryPrompt` (gaps, low protein majority, late dinners, weekday/weekend divergence).
- `handleTranscript` in `app/page.tsx` had an empty `[]` useCallback deps array, causing a stale `slotTapped` closure. Slot-tapped meal type was always overridden by the LLM's guess. Fixed by adding `slotTapped` to the deps array.
- API parse failures were silently swallowed. Both `app/page.tsx` and `app/day/[date]/page.tsx` now expose a `parseError` state shown near the input bar.
- `parseMeal` was Gemini-first, but Gemini's 15 RPM free-tier limit is easily hit during development, causing every parse to fail then fall back to Groq (double latency, double token spend). Swapped to Groq-first with Gemini as fallback. `coach-summary` route was Groq-only with no fallback; added `callGeminiText` helper and Gemini fallback so coach summary survives Groq rate-limit windows.

## Coach Dashboard (`app/coach/page.tsx`)
All UI is inlined — no separate CoachDashboard component. Components:

**Three data states:**
- `ZeroDayState` — 0 logged days
- `PartialDataState` — 1–3 days, shows day breakdown + "check back in N days"
- `FullDashboard` — 4+ days, shows all cards

**FullDashboard cards:**
- `DayBreakdown` — linked list of each day with meal count, always visible
- `CompletenessCard` — total meals vs expected, progress bar, period-over-period delta (vs previous equal-length window), hover tooltip
- `ProteinSignalCard` — horizontal bars (high/medium/low), tap bar → side panel with meal list for that level
- `CalorieRangesCard` — bar+range chart per day, hover/tap for tooltip (est + range)
- `MealTimingCard` — avg breakfast/lunch/dinner chips, late meals (>11pm) flags, timing outliers (>90 min from avg)
- `MarkdownSummary` — rendered markdown from Groq `buildCoachSummaryPrompt` call. Sections in order: Executive Summary (first), Completeness, Meal Timing, Protein Signal, Weekend Pattern, Behavioral Flags. Max 2 bullets per section, one sentence each.

**Timeframe toggle:** 7 or 14 days. Auto-fetches summary when ≥4 days logged. Polls every 60s. Coach summary API uses maxTokens: 1200, tries Groq first with Gemini fallback. "Generate summary" button available in "no summary" state; "Retry" button in error state (both solid CTA-colored buttons).
**Timing computation:** single `computeTimingDetails()` function feeds both the display cards and the `CoachSummaryInput` sent to the API — no divergence.

## Features beyond original spec
- **Ask Aara (NutritionWizard):** Floating FAB on all pages. Food Q&A (e.g. "protein in 1 dosa") → Groq answer. Behavioral ("how am I doing?") → warm Groq narrative using last 14 days of meals from localStorage.
- **Snack nudge (SnackNudge):** Accordion pill — always shows as a collapsed header row (bg #f5ede5, border #e8d4c4). During 3:30–7:30pm IST shows "Around 4pm — anything?"; outside window shows "Preview 4pm snack nudge". Clicking the header expands to show multi-select chips + confirm button. "Not now" permanently dismisses during live window; "Close" just collapses during preview. `forceShow` prop removed entirely.
- **Drag-and-drop:** Meal cards in `MealTimeline` are draggable between slots. Drop target highlights with dashed orange border.
- **Time hint extraction:** "I had lunch at 1pm" → `time_hint: "13:00"` → `timestamp_meal` back-dated, `logged_late: true` if in the past. Meal type also inferred from time if not stated.
- **Editable timestamp:** In `MealDetailSheet`, tap the logged time to get an `<input type="time">` picker. Saves via `onUpdateTimestamp`.
- **Add missing food:** In both `ConfirmationCard` and `MealDetailSheet` (edit mode). Supports voice (hold-to-speak) + text. Calls `/api/parse-meal` and merges returned items.
- **Re-parse:** In `ConfirmationCard`, tap the raw input text → edit box → "Re-parse" re-calls `/api/parse-meal` with new text.
- **Move meal type:** In `MealDetailSheet`, tap any meal type pill to move the entry.
- **Week keyboard nav:** Arrow keys navigate between weeks on `/week/[week]`.
- **Period-over-period delta:** Coach completeness card shows `+N% vs prev period` badge.

## Behavior Rules
**Meal slots:** Breakfast 6–11am, Lunch 12–4pm, Dinner 7–11pm. Snacks via `+ add snack` button — never a mandatory empty slot. Slot tap sets `pendingMealType` before voice/text input.

**Calories:** Hidden in all Megha-facing views. Coach view only: calorie ranges chart (min–max band + point estimate dot per day). Labeled "Rough estimates — not clinical-grade."

**No streaks.** "X days logged this week" shown in week view. Coach: 4+ days minimum for full analysis. Re-entry: no gap ceremony. Language: "Tell me what you had" (not "Log your meal").

**Coach view states:**
- 0 days: "No meals logged yet. Patterns visible after 4 logged days."
- 1–3 days: partial view + "Check back in N more days."
- 4+ days: full dashboard with Groq summary auto-fetched.

**History nav:** `/day/YYYY-MM-DD` and `/week/YYYY-Www`. Future dates: input bar hidden. Past dates: `logged_late:true`. Back limit: 90 days.

## Seed Data (`lib/seedData.ts`)
April 1–16, 2026 (16 days). Covers: festival (Puthandu Apr 14), social occasion, restaurant, high-protein meals, approximate portions. Apr 15 has 3 full meals; Apr 16 has breakfast only (simulates today-in-progress). Seeded on first load of home page and coach page via `seedMockData()`. Current seed version: `v3` (key: `aara_seed_version`). Bumping the version constant forces a full re-seed on next load.

## Env Vars Required
```
GEMINI_API_KEY   # aistudio.google.com — free tier 1,500 req/day
GROQ_API_KEY     # console.groq.com — free tier
GEMINI_MODEL     # optional, defaults to "gemini-2.0-flash"
```

## Design Tokens
Bg `#FBF7F0` · Accent/CTA `#C4633A` · Positive `#2D5016` · Text `#3D3D3D`
Protein colors: high `#2D5016` · medium `#7c9a3d` · low `#d4a44c`
Voice button: large centered circle, radial pulse (`@keyframes`) while recording.
Confirmation card: bottom sheet slide-up (`.slide-up`). Inferred chips: `2px dashed #C4633A` border.

## Do Not Build
Calorie primary UI · Barcode scanning · Photo logging · Macro tracking · Streak counter · Recipe DB · Wearable integration · Water/weight tracking · Meal planning · Auth system · Push notifications · Settings UI (UserProfile already has the schema, no settings page built)
