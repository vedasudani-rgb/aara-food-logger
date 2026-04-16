# AI Food Logger — Full Execution Plan
**Assignment:** 10x better food logging prototype for Healthify (Bangalore)
**Persona:** Megha Iyer, 29, Chennai | Coach: Kavitha R.
**Date:** 2026-04-15 | Stack: Next.js 14 + Gemini Flash (free) + Web Speech API

---

## Context

Food logging fails for Megha not because she lacks motivation or nutrition knowledge, but because the interaction model was designed for calorie-counting gym-goers, not for someone eating shared South Indian home meals across a chaotic week. The core failure modes are: effort per log (2.5 min is 3–4x too long), guilt-driven avoidance (she skips logging bad meals entirely), and category blindness (apps treat "rice with kootu and rasam" as one entry requiring manual lookup of 4 dishes). The result: 38% meal coverage, streaks collapsing into silence.

This plan builds a working browser prototype that tests one thesis: that the logging moment can be made so frictionless and non-judgmental that completeness becomes the natural default rather than the exception.

---

## 1. PRODUCT THESIS

### One-sentence thesis
**"Food logging fails because the moment to log passes in 40 seconds and guilt makes people skip instead of catch up — so the system must capture anything, forgive everything, and surface pattern not precision."**

### Why this angle
Megha's data reveals two compounding failure modes:
1. **Effort barrier**: 2.5 min/log × 21 meals/week = 52 min/week. This is a negotiable cost for someone whose goal is active; it's non-negotiable for someone with morning routines, shared household, and a job.
2. **Guilt barrier**: Streak data [5,3,1,7,2,0,4] shows she can sustain logging — the drops happen after gaps, not after difficulty. She guilt-quits, not effort-quits.

Kavitha doesn't need calorie precision. She needs behavioral signal: protein adequacy, meal timing, weekend collapse pattern, completeness rate. This means the system can sacrifice precision for coverage and still be maximally useful to the coach.

The 10x angle is **10x completeness through near-zero friction + amnesty design**, not accuracy improvement.

### Behavioral science support
1. **Fogg's Behavior Model (Motivation × Ability × Prompt)**: Megha's motivation is moderate-high (active goal). The system must radically increase ability (make logging easier) and place prompts at the right moment. Current apps require high ability (lookup, measure, confirm) — flip this by dropping effort to near zero (one voice sentence, one tap confirm).
2. **Self-Compassion Theory (Kristin Neff) / Identity Framing (James Clear)**: Guilt and self-criticism reliably suppress health behavior — not amplify it. Systems that use streaks as failure markers train users to abandon when imperfect. The alternative: "I'm someone who notices what I eat" as identity, not "I'm someone with a 7-day streak." Every re-entry is framed as continuation, not recovery.

### What this thesis rules out
- **Calorie precision as a primary output** — rough estimates are fine as an opt-in detail, but not the headline
- Barcode scanning (irrelevant for home-cooked Indian food)
- Gamification mechanics (badges, leaderboards — they increase guilt when broken)
- Macro tracking dashboards (adds complexity Kavitha doesn't need and Megha will game)
- AI meal photography as primary modality (bad for mixed dishes, shared bowls, low-light)

### Where AI becomes load-bearing
A rule-based system can parse "idli sambar" from a dropdown. It cannot:
- Infer that "lunch at home" in a South Indian household means rice + sambar + 1-2 sides + curd
- Understand that "puli sadam" ≠ "tamarind rice" in a lookup table — it needs contextual knowledge
- Generate a warm, non-guilt recovery message that reads like a friend, not a system
- Distinguish "had some biryani" (weekend, approximate, emotional context) from a precise entry and handle each appropriately
- Surface behavioral pattern from partial data ("you tend to under-eat protein on days you log fewer than 3 meals")

The AI is load-bearing specifically in: meal parsing from natural language, inference under uncertainty, re-engagement tone, and pattern synthesis for the coach view.

---

## 2. AI MODALITY DECISION

### Scoring Matrix (1–5)

| Modality | Indian Food Accuracy | Latency | UX Friction | Offline Viability | Emotional Feel | Total |
|---|---|---|---|---|---|---|
| Image (vision model) | 2 | 4 | 4 | 1 | 3 | 14 |
| Voice (STT → LLM) | 4 | 4 | 5 | 3 | 5 | 21 |
| Conversational text | 4 | 5 | 3 | 3 | 3 | 18 |
| Hybrid (voice + text + LLM) | 5 | 4 | 5 | 3 | 5 | 22 |

**Score justifications:**
- **Image accuracy (2/5)**: Vision models are poor at distinguishing kootu from sambar from rasam in a thali, can't handle shared bowls, fail on partial plates. Portion estimation from photos is ±40–60% error for Indian dishes. Not load-bearing enough to be primary.
- **Voice accuracy (4/5)**: STT handles code-switching (Tamil-English) reasonably well. LLM parsing of "had idli with thengai chutney and a little sambar" is highly accurate. Fails on noisy environments and unusual dish names not in STT vocabulary.
- **Voice latency (4/5)**: Web Speech API is near-instant (<500ms for STT). LLM parse adds 1–2s. Total: ~2.5s to confirmation. Acceptable for 40-second window.
- **Voice UX friction (5/5)**: Zero typing, hands-free, works while putting dishes away. One button press + one sentence + one tap confirm.
- **Voice emotional feel (5/5)**: Feels like talking to someone, not filling a form. This is the most important differentiator — it removes the form-filling association that triggers avoidance.

### Final recommendation: **Hybrid with voice-first, text fallback**
- **Primary**: Hold-to-speak → Web Speech API → LLM parse → confirmation card
- **Fallback**: Text input (auto-focus if voice denied or times out after 5s)
- **Image**: Not in MVP. Phase 2 as supplementary confirmation.

**Tradeoffs accepted:**
- Web Speech API requires microphone permission (one-time friction)
- STT may misparse unusual dish names → LLM gets to correct from context, but there's a failure surface
- No offline logging in v1 (API call required for parse) → mitigated by text fallback with offline queue

### South Indian food handling

**Regional dish names**: The LLM system prompt contains an explicit South Indian dish glossary (50+ terms). Dishes like "puli sadam," "mor kuzhambu," "vazhaipoo kootu" are in few-shot examples and system context. STT may transcribe incorrectly ("more kuzhambu" as "more cuzhamboo") — the LLM handles fuzzy matching.

**Mixed dishes/thalis**: "Lunch at home" triggers inference mode — LLM returns a standard South Indian rice meal template (rice + sambar/rasam + kootu/poriyal + curd) with all items flagged as `inferred: true`. User sees these as chips they can tap-remove, not form fields to fill.

**Shared bowls**: System never asks "how many grams?" — it accepts "some," "a bit," "small portion," and returns a range estimate (150–200g). Logged with `quantity_certainty: "approximate"`. No precision theater.

**AI fragility surfaces:**
1. Very rare South Indian dishes (hyperlocal recipes) → fallback: LLM asks one clarifying question
2. Ambiguous entries ("had some stuff") → LLM generates best-guess with explicit "I assumed" label
3. API failure → entry saved as raw text, parsed on next connection

---

## 3. INDIAN FOOD CONTEXT — HANDLING SPEC

### 3.1 Mixed dishes/thalis

**Input:** "had lunch at home," "rice meal," "full meals," "ate at amma's"

**AI behavior:** Recognizes "lunch at home" + South Indian context → generates inferred thali:
- Rice (1 cup, inferred)
- Sambar (1 bowl, inferred)
- One dry vegetable side (inferred, asks to specify if time allows)
- Curd rice (optional, marked as unknown)

**UX output:** Confirmation card shows a chip row: [rice] [sambar] [rasam?] [kootu/poriyal?] [curd]. Tapping a chip removes it. Tapping "?" chips resolves them. User can confirm the full inference with one tap.

**Fallback:** If user in a hurry, one tap confirms "typical rice meal" as a tagged entry. Coach view treats this as 1 entry representing a full meal, not as incomplete data.

---

### 3.2 Shared bowls (quantity uncertainty)

**Input:** "had kootu and rice," "ate from common bowls at home," "some dal rice"

**AI behavior:** Returns `quantity: "medium portion (estimated 150–200g)"` with `confidence: 0.6`. Never asks for weight. For repeated shared bowl context, remembers that Megha eats at home from shared dishes and pre-labels all home entries as shared-bowl context.

**UX output:** Entry shows a soft visual indicator (dotted border, "~estimate") rather than a precise number. User is never asked to resolve this.

**Fallback:** If user explicitly says "I don't know how much," logs "unknown portion" and marks with a flag. Coach sees completeness signal, not calorie data.

---

### 3.3 Regional dish names

**Input:** "puli sadam," "mor kuzhambu," "vazhaipoo kootu," "kozhukattai," "adai avial"

**AI behavior:** System prompt contains 50+ South Indian dish definitions. LLM maps to canonical entries with protein/carb/fat category tags. No external lookup required.

**UX output:** Dish appears with its regional name (not "tamarind rice" — preserves cultural identity). Shown with category tag [grain] [vegetable] [protein] etc.

**Fallback for unknown names:** LLM asks: "I don't know [dish name] — is it a rice dish, curry, or snack?" One tap picks category. That's the full fallback interaction.

---

### 3.4 Invisible meals (tea, biscuits, snacks)

**This is the most important category for Megha.** She forgets these entirely.

**Input:** Passive — these don't get logged at all currently.

**System behavior:**
- Smart time-based prompt at 4pm (configurable): "Anything between lunch and now? Tea? Something small?"
- Framed as "quick catch-up" not "you forgot to log"
- Pre-populated suggestions based on historical patterns: [filter coffee] [tea with sugar] [biscuits] [murukku] — one tap adds
- Suggestibility: If she logged tea before at 4pm on 3+ occasions, system proactively shows "Afternoon tea?" as a ghost entry for one-tap confirmation

**UX output:** Snack entries appear in a separate "between meals" section with no calorie emphasis. They show as [tea ☕] [murukku 🍟] with soft visual weight — they matter for completeness, not guilt.

**Fallback:** If notification dismissed 3x, reduce to weekly gentle mention. Never nag.

---

### 3.5 Weekend chaos

**Input:** "some biryani and raita," "went to a restaurant," "birthday party, had a lot"

**AI behavior:**
- "some biryani and raita" → parses as approximate meal, marks `context: "restaurant"`, estimates standard restaurant biryani portion
- "birthday party, had a lot" → logs as `meal_type: "social_occasion"`, returns: "Sounds like a celebration! Logged as 'birthday party meal.' Want to add anything specific?" — no follow-up required
- Restaurant names → doesn't lookup menus, estimates based on category (biryani = rice + protein meal, standard portion)

**UX output:** Weekend entries have a visual tint/badge [weekend] and appear in coach view as weekend pattern data, not individual calorie entries.

**Fallback:** User can always log as "weekend meal" with one tap — catches the day in completeness tracking even without specifics.

---

### 3.6 Code-switching

**Input:** "had idli with thengai chutney and little sambar," "ate poriyal rice," "drank buttermilk after lunch"

**AI behavior:** Claude Sonnet handles Tamil-English mixing natively. No special handling required — LLM understands "thengai chutney" (coconut chutney), "poriyal rice" (rice with stir-fry), "buttermilk" (mor/chaas).

**UX output:** Entry displays in whatever language/mixing the user used. System never corrects to English.

---

## 4. MEGHA'S MONDAY JOURNEY

### 7:30am — "Finishes idli-sambar, 40 seconds before leaving"

**Input modality:** Hold-to-speak button. Megha says: "idli sambar, had like 3 idlis, coconut chutney"

**AI behavior:** STT transcribes → LLM returns:
```
Items: [idli × 3] [sambar, small bowl] [coconut chutney]
Meal type: breakfast
Confidence: 0.95
Clarification needed: null
```

**UX shown:** Confirmation card pops up in <2s. Three chips: [idli × 3] [sambar] [coconut chutney]. Green confirm button. One tap.

**Emotional tone:** Fast, effortless, done before she reaches her keys. No judgment. Small animation: "Breakfast logged ✓"

---

### 1:15pm — "Lunch from shared bowls, not sure what she had"

**Input modality:** Text (she's at the table, comfortable). Types: "rice meals at home, had kootu and rasam"

**AI behavior:** Recognizes home rice meal context. Returns:
```
Items: [rice, medium portion] [kootu, medium portion, inferred type: vegetable] [rasam, 1 bowl]
Inferred additions: [curd rice?] [sambar?] — shown as optional chips
Confidence: 0.85
```

**UX shown:** Confirmation card with confirmed items + "Did you also have?" chips (curd, sambar) she can tap-add. She adds [curd]. Confirms.

**Emotional tone:** System treats "not sure exactly how much" as completely normal. No asterisks or warnings. Entry logged with soft dotted visual indicating "approximate."

---

### 4pm — "Tea and two biscuits, doesn't think to log"

**System behavior:** Smart notification fires at 4:05pm: "Afternoon snack?" with chips [tea with sugar] [coffee] [biscuits] [something else]. Based on her history, [tea with sugar] is pre-selected.

**UX shown:** She sees the notification, taps [tea with sugar] + [biscuits], confirms. 8 seconds total.

**Emotional tone:** The notification has zero judgment language. Not "Don't forget to log!" — just "Afternoon snack?" with quick options. Feels like a friendly nudge, not surveillance.

---

### 8:30pm — "Skips dinner, just milk and banana, feels guilty"

**Input modality:** She doesn't open the app. System doesn't push a dinner reminder (dinner reminders at night trigger the most guilt-avoidance).

**Night behavior (10pm):** When she opens app before bed, system surfaces the day summary. It does NOT show "Dinner: not logged." It shows the day as: Breakfast ✓ | Lunch ✓ | Afternoon ✓ | Evening: [+add]. The evening slot has a ghost: "Had something light?" with [milk] [banana] [fruit] options.

**If she taps:** Logs milk + banana in 5 seconds with one tap confirm. No guilt about "light dinner."

**If she doesn't:** Day shows 3/4 meals logged. No shame indicator. Completeness is 75%.

---

### 10pm — "Opens app before bed — what does she see and feel?"

**UX shown:**
```
Monday
───────────────────────────────
🌅 Breakfast    idli × 3, sambar, coconut chutney
☀️ Lunch        rice, kootu, rasam, curd
🌤️ Afternoon    tea with sugar, marie biscuits
🌙 Evening      [+ Had something before bed?]
───────────────────────────────
Day feel: Vegetarian ✓ | Light protein today
Protein: ●●○○○ (low — rice-heavy day)
Hydration: unknown

Week so far: 3 good days this week 🌱
```

**What she does NOT see:**
- Calorie count for the day
- A "you need X more calories" bar
- Comparison to yesterday
- Guilt language about missed dinner

**Emotional tone:** The screen feels like a journal reflection, not a health report. The protein signal is factual (low), not judgmental. She adds milk + banana as evening entry. Feels complete. Sleeps without food guilt.

---

### Kavitha's End-of-Week Coach View

**What's shown:**

```
MEGHA IYER — Week of April 14
─────────────────────────────────────────────
Logging completeness: 14/21 meals (67%) ↑ from last week (38%)
Logged days: 5/7

MEAL TIMING
• Breakfast: Consistent 7–8am on weekdays ✓
• Lunch: 1–2pm on logged days ✓  
• Dinner gap: 3 evenings with no dinner log / light meal (Mon, Wed, Fri)
• Late eating: None flagged

PROTEIN SIGNAL (estimated, not precise)
• Low protein meals: 9/14 (rice-heavy pattern, minimal dal/legume)
• Protein-adequate meals: 5/14 (idli days, sundal snack)
• Trend: Protein lowest on evenings, highest on days with legume-based dishes

WEEKEND PATTERN
• Sat: Restaurant meal logged (biryani) — approximate
• Sun: 0 meals logged
• Note: 4th consecutive weekend with Sunday gap

BEHAVIORAL FLAGS
⚑ Consistent dinner underreporting on weekday evenings — may indicate light eating or avoidance
⚑ Sunday gap is a recurring pattern — worth asking about weekend routine

COMPLETENESS CONTEXT
Data is sufficient for pattern analysis. Calorie precision is not available or needed.
```

**What's deliberately excluded from coach view:**
- Individual calorie counts (data quality too low, not Kavitha's ask)
- Food quality judgments ("Megha ate poorly this week")
- Micronutrients other than protein signal
- Suggestions (Kavitha forms her own — she's the coach)
- Mood/emotional tags (privacy)

---

## 5. STRESS TEST SCENARIOS

### [PROVIDED 1] Megha starts semaglutide. Appetite drops. Eating ~800 cal some days.

**What system detects:** Pattern of very short entries: "small portion," "couldn't finish," "not hungry," logged across 5+ consecutive days. Meals logged but portions described as small.

**What system infers:** Low intake pattern — does NOT calculate calories or flag "you're under 1200 cal." Instead, surfaces to Kavitha: "Meals logged as notably small for 5+ consecutive days. Portions described as partial."

**UX shown to Megha:** No change to her experience. System notices she's eating less but does NOT comment on it. No "are you eating enough?" notification — this is a clinical question, not an app question.

**What AI does differently:** Detects behavioral language patterns ("not hungry," "just a little") rather than calorie math. Rule-based system would only flag if a calorie threshold was crossed — which requires precision this app doesn't have.

**What it deliberately avoids:** Any UI that suggests her eating is problematic. This is a medical situation. The app's job is to log accurately, not to diagnose.

---

### [PROVIDED 2] MIL visits for a month. All meals cooked by MIL. Zero control over food.

**What system detects:** Logging pattern shifts — entries like "whatever MIL made," "had what was cooked," "MIL's cooking." Variety increases, portions are less predictable.

**What AI does:** Accepts "had what MIL cooked — rice and three sides" and infers a typical South Indian home meal. Adds tag `context: "family_meal"`. No judgment about not knowing exactly what was in each dish.

**UX shown:** Logging works exactly the same. System notices the "MIL" mentions and shows Megha: "It looks like someone else is cooking this month — logging approximate meals is totally fine." One-time, non-repeated acknowledgment.

**Coach view update:** Kavitha sees note: "Meal composition less predictable this month (family meals, user not cooking). Protein estimates less reliable."

**What it deliberately avoids:** Pushing Megha to log more precisely when she has no information to give.

---

### [PROVIDED 3] Megha stops logging for 9 days. Opens app again.

**What system shows:** No streak counter. No "you had a 7-day streak and broke it." 

**Re-engagement screen:**
```
[Aara avatar, warm illustration]

"Hey Megha. What did you have today?"

[Hold to speak]  [Type instead]
```

That's it. No recap of what she missed. No count of days absent. No motivational quote.

**What AI does:** The re-engagement message is LLM-generated based on the time gap:
- 1–3 days: No special message at all, just normal logging screen
- 4–9 days: "Hey Megha. What did you have today?" — nothing about the gap
- 10+ days: "Good to see you. Just tell me about today — that's enough."

**What it deliberately avoids:** Any mention of the gap. Any streak reset ceremony. Any encouragement that implicitly acknowledges the failure ("it's okay that you stopped!"). Silence about the absence is the best UX here.

**Coach view:** Kavitha sees a 9-day gap in the data. No app-generated explanation. Kavitha can ask Megha directly.

---

### [GENERATED 1] Diwali — heavy eating, multiple days, sweets

**User state:** Megha eats at 3 family gatherings, has ladoo, murukku, chakli, biryani, desserts across 3 days. Feels she's "ruined" her progress.

**What system detects:** Logging entries with heavy social meal tags, sweets items appearing multiple times, possible logging gap as she avoids it.

**UX shown:** System detects Diwali proximity (date + meal content + keywords). On Diwali day, app shows a gentle seasonal acknowledgment: "Happy Diwali! Log what you can — festival meals count too." Sweets and festival foods appear in a pre-populated chip menu.

**What AI does differently:** Recognizes festival context and does not apply the same logging encouragement as normal days. Logging friction is reduced (big pre-populated options for festival foods), and the day is tagged as `context: "festival"` in coach view.

**What it deliberately avoids:** Any calorie alarm, any comparison to non-festival days, any comment about sweets being "treats."

**Coach view:** Kavitha sees "3 festival days" tagged. Behavioral insight: "Logging was maintained during festival period — notable."

---

### [GENERATED 2] Social situation — logging feels embarrassing (lunch meeting with colleagues)

**User state:** Megha is at a restaurant work lunch. Doesn't want to be seen opening a food tracking app.

**What system offers:** The app has a "log later" mode. Megha taps the widget/home screen shortcut once — it logs a placeholder "lunch out" with timestamp. She logs the details at 3pm from her desk.

**UX shown:** Later log shows: "You tapped 'log later' at 1:12pm — what did you have at lunch?" — contextual, not nagging.

**What AI does differently:** Decouples the capture moment from the logging moment. A rule-based system would just show a blank form. This one pre-populates time and context from the deferred tap.

**What it deliberately avoids:** Any UX that requires the phone out at the table for more than one tap.

---

### [GENERATED 3] Logging error — implausible calorie entry

**User state:** Megha types "had pasta, maybe 800 calories" (she's estimating). System parses this as an explicit calorie mention.

**What system does:** The app doesn't expose calorie numbers in its primary UI. If a calorie number appears in input, the LLM strips it from the structured output and logs the food items only. It does NOT confirm or deny whether the estimate was accurate.

**What AI does differently:** Does not gamify calorie accuracy. A rule-based system would store the 800 cal as logged data. This system stores "pasta, ~1 serving" and ignores the user's self-estimate.

**What it deliberately avoids:** Correcting her calorie guess. Showing her the "real" calorie count. Both create calorie fixation.

---

### [GENERATED 4] She logs a bad meal and immediately closes the app

**User state:** Megha logs a late-night binge (chips, ice cream, mithai). Logs it, sees it in her day view, feels shame, closes app.

**What system does:** Entry is logged and saved. No popup, no reaction, no "that's okay!" message (the unsolicited reassurance is itself a judgment). The item appears in her log exactly like any other entry.

**Next open:** System doesn't reference the late-night entry. Day view shows it flatly without visual emphasis.

**What AI does differently:** The system produces no behavioral signal about the item to Megha. Kavitha sees it as a late-night entry in her coach view (10pm, high-carb snacks) — but Megha experiences zero feedback loop around it.

**What it deliberately avoids:** Any response that treats the entry differently from other entries. The non-reaction is the design.

---

### [GENERATED 5] She asks "am I doing okay?"

**User state:** Megha opens app and types or speaks "am I doing okay?"

**AI behavior (LLM-generated response):**

Based on what she's logged, the system generates a contextual behavioral summary in warm language:

```
"You've logged 14 meals this week, which is more than last week. Your breakfasts have been really consistent — same time, good variety. Protein has been a bit low most days (rice-heavy). Evenings are your toughest meal to log.

Overall: you're building the habit. That's what matters this week."
```

**What AI does differently:** This is not a rule-based calculation. The LLM synthesizes behavioral signal across the week into a coherent narrative that acknowledges both strengths and gaps without shame.

**What it deliberately avoids:**
- "You're doing great!" (vacuous)
- Any calorie/macro number
- Comparison to a target
- Anything that implies she should be doing more

---

### [GENERATED 6] Traveling, eating unfamiliar food (Mumbai work trip)

**User state:** Megha is at a work conference in Mumbai. Eating North Indian food, dhaba meals, things she doesn't recognize.

**Input:** "Had some dal makhani and naan, maybe paneer too"

**AI behavior:** LLM handles North Indian dishes natively. No South Indian inference. Returns: [dal makhani] [naan × 1–2] [paneer (possible)]. Tags as `context: "travel"`.

**UX shown:** Entry logs normally. Travel tag appears in coach view without Megha needing to do anything.

**What AI does differently:** Context-aware inference switches from South Indian defaults to more generic Indian when travel context detected (location + unfamiliar food terms). 

**What it deliberately avoids:** Asking Megha to categorize or specify food she doesn't know well.

---

### [GENERATED 7] 2 missed days then a perfect day — streak/recovery logic

**User state:** Megha logs Mon–Wed, misses Thu–Fri, logs Sat perfectly (5 entries, all detailed).

**What system shows on Saturday night:**
```
Saturday
─────────────────────────────
Breakfast ✓   Lunch ✓   Snack ✓   Dinner ✓
─────────────────────────────
Good day. You logged everything.
Week: 5 days with at least one log.
```

**What it does NOT show:** A streak count (it would show "1-day streak" which feels deflating). No mention of Thursday/Friday gap. No "welcome back" — she never left.

**Coach view:** Kavitha sees the gap as data (Thu–Fri: no entries). No app commentary.

**System logic:** The app tracks "logged days this week" not "current streak." This is a deliberate design decision — weekly completeness is more behaviorally stable than streak-based counting, which has a cliff effect.

---

### [GENERATED 8] Coach flags protein concern — how does this reach Megha without feeling clinical?

**User state:** Kavitha notices low protein trend over 3 weeks and wants to send a nudge.

**Coach-initiated message (in v2):** For MVP, Kavitha sends a manual message. The app surfaces it as:

```
[Kavitha's avatar]
"I noticed your meals have been mostly rice-based this week. 
Try adding one dal, egg, or legume per day this week — 
even sundal counts. Let me know how it goes."
```

**What AI does:** In the MVP, this is a manually crafted coach message delivered via the app's notification system. In v2, the AI helps Kavitha draft it based on behavioral data.

**What it deliberately avoids:** The app itself never messages Megha about protein. Only Kavitha does. The AI provides coach with the signal; coach provides Megha with the message. This preserves the coach-client relationship and avoids the app feeling like it's criticizing food choices.

---

### [GENERATED 9] Pongal — traditional food, cultural pride

**User state:** Megha is celebrating Pongal. Eats sweet pongal, ven pongal, vadai, payasam at family gathering.

**Input:** "Pongal celebration, had sweet pongal and ven pongal and vadai and payasam"

**AI behavior:** Recognizes Pongal dishes. Returns structured entry with Tamil dish names preserved. Tags `context: "festival"`.

**What AI does differently:** The confirmation card shows:
```
[sweet pongal] [ven pongal] [medhu vadai] [payasam]
Pongal celebration 🌾
```

The festival tag creates a warm, culturally-aware moment rather than a clinical log entry.

**What it deliberately avoids:** Any calorie estimate for payasam or sweet pongal. No "high sugar" flag.

---

## 6. HABIT REINFORCEMENT DESIGN

### Minimum logging threshold for system utility
**Product decision: 4 complete-day logs per week** (any 3+ meals logged in a day = "complete day"). Below this, coach view shows "Insufficient data for behavioral pattern this week" — not "no data." At 4/7 days, Kavitha has enough to see timing, protein signal, and weekend pattern.

### How behavior adapts by maturity

**Day 1–14 (Onboarding phase):**
- System is maximally forgiving — any entry counts
- No streak pressure, no comparisons
- Voice tutorial shown once, never again
- Celebration of first log: "First entry logged. That's the whole habit right there."
- Proactive suggestions (afternoon snack prompt, dinner check-in) are active
- Coach view IS shown to Kavitha from day 1, but with an explicit "Insufficient data" state (see Section 10)

**Day 14–45 (Pattern phase):**
- System starts surfacing behavioral patterns to Megha: "You tend to log breakfast most consistently"
- Proactive suggestions shift to known patterns only (system learned her schedule)
- Weekly summary becomes available: "Your most logged day this week: Thursday"
- Coach view activates with 2-week baseline
- System begins lightweight protein signal surfacing: "Your last 3 dinners have been light — any legumes today?"

**Day 45+ (Identity phase):**
- App behavior becomes minimal — Megha knows the flow, needs less scaffolding
- Summary view becomes more insightful: monthly patterns, seasonal eating shifts
- Coach view shows trends, not just snapshots
- System stops proactive suggestions unless logging drops below threshold
- "You've logged X meals this month" — stated factually, as identity data, not achievement

### Recovery UX when streak breaks

**The app has no streak counter.** This is a deliberate product decision. Instead:

- Daily view: Shows meals logged today. No reference to yesterday.
- Weekly view: Shows "X days logged this week" as a progress bar (Mon–Sun circles, filled if 3+ meals logged)
- When returning after a gap: No ceremony. Landing screen is just the log input, same as always.
- Re-engagement copy (LLM-generated based on gap length):
  - 1–3 days: No message
  - 4–7 days: "What did you have today?"
  - 8–14 days: "Good to see you. Just today is enough."
  - 15+ days: "Welcome back. Start whenever you're ready."

**What the recovery screen NEVER shows:**
- Gap day count
- "You had a X-day streak"
- "It's okay to start over"
- Any visual indicator of the missed days
- A motivational quote

### Variable reward mechanism
**Used sparingly and behaviorally grounded:**

The only variable reward is the weekly behavioral insight — it appears when Megha opens the app on Sunday or Monday. It's variable because the insight changes based on her actual data:

- "Your most consistent meal this week was breakfast — 6/7 days"
- "You logged every day this week — your data is complete enough for Kavitha to see a clear pattern"
- "This was your most varied week — you had 12 different dishes"

This is variable reward because the content is unpredictable (depends on behavior) and meaningful (behavioral insight, not a star). Evidence base: variable ratio reinforcement (Skinner) amplifies behavior maintenance; the key is making the reward informational, not evaluative.

**What's excluded:** Badges, points, streaks, leaderboards, "achievements." These have been shown to increase short-term engagement and long-term abandonment.

### Identity reinforcement
The app's language consistently frames logging as self-knowledge, not compliance:
- "Tell me what you had" not "Log your meal"
- "You've logged 4 days this week" not "4-day streak"
- "Your breakfast pattern is very consistent" not "Great job on breakfasts!"
- Coach view language: "Megha's data" not "Megha's compliance"

The app never calls itself a "food tracker" or "calorie counter" in UI text. It calls itself a food journal.

---

## 7. MVP SCOPE

### Core loop (must ship — proves the thesis)
**The single interaction that proves the 10x thesis:**
1. Hold-to-speak button on home screen
2. Say what you ate (15 seconds)
3. See confirmation card with parsed items
4. One tap confirm
5. Entry appears in day view

This interaction, working correctly for South Indian food, for mixed dishes, for approximate quantities, with sub-3-second end-to-end latency — that is the entire product demonstration.

### Megha view (must ship)
- **Home screen**: Hold-to-speak button + text input fallback + today's meals timeline
- **Day view**: Meals by time slot (morning/afternoon/evening) with chip-style entries
- **Quick log suggestions**: Time-aware chips (morning → idli/dosa/upma; afternoon → rice meal; evening → snack options)
- **Weekly completeness bar**: Mon–Sun dots, filled on logged days. No calorie/streak language.

### Kavitha view (must ship — can be mocked)
- **Separate `/coach` route** (password: "kavitha" for demo)
- Weekly behavioral summary (LLM-generated from Megha's log data)
- Protein signal table (low/medium/high per meal, weekly trend)
- Meal timing chart (simple dot plot: time of day for each logged meal)
- Logging completeness bar
- Weekend vs weekday pattern
- Behavioral flags section (generated by LLM from data)

### Intentionally excluded
| Feature | Rationale |
|---|---|
| Calorie tracking | Undermines thesis, requires precision we can't deliver for Indian food |
| Barcode scanning | Useless for home-cooked meals which are 80% of Megha's diet |
| Photo logging | Too slow, too imprecise for mixed dishes; Phase 2 only |
| Social features | No evidence Megha wants them; adds complexity without behavioral benefit |
| Macro tracking (fat/carbs) | Kavitha doesn't need it; Megha doesn't want it |
| Reminders with precise timing UI | Over-engineered; smart time-based prompts are sufficient |
| Recipe database | Overkill for South Indian home cooking; LLM handles implicit knowledge |
| Wearable integration | Phase 2; requires backend infrastructure and user consent flow |
| Water tracking | Separate behavior loop; don't dilute the core habit |
| Weight tracking | Medically sensitive; out of scope for food logger |
| Meal planning | Future state; logging habit must form before planning is useful |

### Known limitations (be honest in walkthrough)
- **Indian food nutrient data is approximate**: LLM protein estimates for "vazhaipoo kootu" are educated guesses, not verified database values. The system is calibrated for behavioral signal, not clinical precision.
- **STT quality on South Indian dish names**: Web Speech API may misparse "mor kuzhambu" or "vazhaipoo" — LLM corrects from context but there's a failure surface. Should demo with text fallback ready.
- **No authentication in MVP**: localStorage only, single user, no accounts. This is fine for demo; not production-ready.
- **Coach view is semi-mocked**: Weekly summaries are LLM-generated from actual log data, but the coaching relationship (Kavitha sending messages to Megha) is simulated in demo.
- **No offline support**: API call required for parsing. If network drops mid-log, entry queues as raw text. Full offline parse is Phase 2.
- **Portion estimates are illustrative**: Medium portion / small portion estimates are LLM guesses based on common serving sizes, not validated against Indian food databases.

### Week 2 roadmap (5 more days)
1. **Photo logging as confirmation** (Day 1–2): Add camera option that supplements voice log with image — helps with unfamiliar meals, not as primary modality
2. **Persistent backend** (Day 2): Replace localStorage with Supabase (free tier) — enables cross-device, enables real coach view
3. **Kavitha messaging** (Day 3): Simple in-app message from coach to user (one-directional for now)
4. **Monthly pattern view** (Day 4): Expand weekly view to monthly, surface longer behavioral trends
5. **Onboarding flow** (Day 5): 3-screen onboarding that sets meal patterns, South Indian food preferences, coach relationship — improves inference accuracy from day 1

---

## 8. TECHNICAL ARCHITECTURE

### Frontend: Next.js 14 (App Router)
**Justification:** App Router enables per-route server components (coach summary can be server-rendered for performance), easy API routes for proxying Anthropic calls (keeps API key server-side), excellent Vercel deployment story. No separate backend needed for MVP. React 18 concurrent features handle the voice → parse → confirm latency gracefully.

Alternatives rejected:
- Vite + React SPA: No server-side API routes, API key would be client-exposed
- Remix: Overkill for MVP, less Next.js ecosystem tooling
- Vue/Svelte: Team preference and LLM code generation is better for React

### Styling: Tailwind CSS + shadcn/ui
**Justification:** shadcn/ui components (Dialog, Card, Badge, Button) are accessible, unstyled enough to customize, and available in the project without a npm registry lock-in. Tailwind enables rapid iteration without CSS file management.

**Design direction:**
- Color palette: Warm cream (`#FBF7F0`), terracotta accent (`#C4633A`), deep forest green (`#2D5016`), soft charcoal (`#3D3D3D`)
- Typography: Geist Sans (Next.js default), 16px base, generous line height
- Voice button: Large, centered, hold-to-speak with pulse animation while recording
- Confirmation card: Slides up from bottom, chip-style items, large green confirm button
- Day timeline: Vertical rail with meal time markers, entries as cards
- No calorie numbers anywhere in primary UI

### LLM: Google Gemini 2.0 Flash via Google AI SDK (FREE)
**Justification:** Google AI Studio provides a completely free API tier — 1,500 requests/day, 1M tokens/minute, 0 cost. Gemini 2.0 Flash has strong multilingual and cultural knowledge for South Indian food, fast response times (~1s), and native JSON mode for structured output. For a prototype that must not incur API costs, this is the only viable production-quality choice.

**Free tier limits in context:** 1,500 requests/day is ~70 meals/day. For demo usage this is unlimited in practice.

**Model choice rationale:**
- Claude Sonnet: Best quality, but every request costs money — ruled out for zero-cost requirement
- GPT-4o: Also paid, no free tier with useful limits
- Gemini 1.5 Flash: Also free tier, slightly older — Gemini 2.0 Flash is faster and better
- Groq + Llama 3.3 70B: Also free, fast, but weaker cultural food knowledge than Gemini
- Ollama (local): Would require user to run local model — not viable for a hosted demo

**Acknowledged tradeoff:** Gemini 2.0 Flash is slightly weaker than Claude Sonnet at nuanced reasoning, but for structured meal parsing with a well-engineered system prompt, the quality difference is negligible. If quality gaps appear on edge cases, the fallback is Groq (also free).

**SDK:** `@google/generative-ai` npm package. API key from aistudio.google.com (free, no credit card required).

### Voice: Web Speech API (browser-native)
**Justification:** Zero cost, zero latency overhead, no API key, works on Chrome/Edge/Safari (covers Megha's likely browser). The tradeoff is lower STT accuracy on South Indian dish names — mitigated by LLM fuzzy correction in parsing step.

Alternatives rejected:
- Whisper API (OpenAI): Better accuracy but adds 500–1000ms latency and API cost
- Deepgram: More accurate, overkill for MVP, additional API key
- AssemblyAI: Same reasoning as Deepgram

### Storage: localStorage + IndexedDB (MVP)
Key-value structure:
```
logs:YYYY-MM-DD → MealEntry[]
settings:user → UserProfile
settings:coach → CoachProfile
```
IndexedDB for larger datasets. No backend, no auth, no data leakage risk. Migration to Supabase in Week 2.

---

### Prompt Architecture

#### System Prompt: Core Meal Parsing
```
You are Aara, a food logging assistant built for Indian users, specializing in South Indian home cooking.

Your job: parse the user's natural language meal description into structured JSON. 

SOUTH INDIAN DISH GLOSSARY (partial — use your training knowledge for unlisted dishes):
- Idli: steamed rice-lentil cakes, usually 2–4 per serving
- Dosa: thin rice-lentil crepe, usually 1–2 per serving
- Sambar: lentil-vegetable soup, usually 1 bowl/katori
- Rasam: thin tamarind/tomato broth, 1 small bowl
- Kootu: vegetable curry with coconut-lentil base, 2–4 tbsp typical
- Poriyal: dry vegetable stir fry, 2–4 tbsp typical
- Mor kuzhambu: buttermilk-based curry
- Puli sadam: tamarind rice (also called puliogare, pulikachal rice)
- Vazhaipoo kootu: banana flower curry
- Kuzhambu: tamarind/tomato-based thick curry
- Sundal: boiled legume stir fry (protein-rich, important to flag)
- Filter coffee/tea: typically with 50ml milk, 1–2 tsp sugar
- Murukku, chakli, mixture: fried snacks, ~30–50g portion = "small handful"
- Payasam, kheer: dessert

PARSING RULES:
1. Accept vague quantities. "some kootu" → quantity: "medium portion". "a little" → quantity: "small portion". "2-3 idlis" → quantity: "2-3 pieces".
2. If user says "lunch at home" or "rice meals" with South Indian context, infer: [rice, sambar or rasam, one kootu or poriyal, optional curd] — mark all as inferred: true.
3. Accept Tamil-English code-switching naturally. Do not translate dish names to English.
4. For shared bowls: use "~portion" prefix on quantity. Do NOT ask for weights.
5. Never comment on meal healthiness, calorie content, or nutritional quality.
6. If a dish is completely unknown to you, ask ONE short clarifying question: "Is [dish] a rice dish, curry, or snack?"
7. For festival/celebration mentions (Diwali, Pongal, birthday, party): tag context accordingly and do not estimate portions precisely.
8. Never strip or modify dish names the user provides — preserve "thengai chutney" not "coconut chutney".

OUTPUT FORMAT (strict JSON):
{
  "items": [
    {
      "name": "string (user's term, not translated)",
      "quantity": "string (vague is fine)",
      "confidence": 0.0-1.0,
      "inferred": true|false,
      "category": "grain|protein|vegetable|fat|dairy|beverage|snack|dessert",
      "protein_level": "low|medium|high|unknown"
    }
  ],
  "meal_type": "breakfast|lunch|dinner|snack|unknown",
  "context": "home|restaurant|social_occasion|festival|travel|unknown",
  "completeness": "complete|approximate|partial",
  "clarification_needed": null | "one short question string if truly necessary"
}

If clarification is needed, return ONLY the clarification_needed field populated. Do not return partial items.
```

#### System Prompt: Coach Summary Generation
```
You are generating a weekly behavioral summary for Kavitha R., a nutrition coach.
Her client is Megha Iyer, 29, Chennai. Goals: lose 8kg, consistent eating, reduce sugar. Vegetarian, South Indian home cooking, eats out 2-3x weekends.

You will receive a structured JSON log of Megha's meals for the week.

WHAT TO INCLUDE in the summary:
- Logging completeness (meals logged / estimated total)
- Meal timing patterns (consistency, large gaps, late eating after 9pm)
- Protein signal: count low/medium/high protein meals from item categories (grains = low, legumes/dairy/tofu = medium-high)
- Weekend vs weekday pattern (completeness and meal composition differences)
- Notable patterns: consecutive skipped meals, consistent meal types, any behavioral flags
- One to two behavioral observations worth a coaching conversation

TONE AND FORMAT:
- Clinical and factual. Like a nurse's intake notes.
- No qualitative judgments about food quality ("good" or "bad" meals)
- No suggestions — Kavitha will form her own
- No calorie numbers — data quality does not support it
- Use the category tags from the meal data, not calorie estimates
- Flag uncertainty clearly: "estimated," "based on partial data"

WHAT TO EXCLUDE:
- Individual calorie counts
- Micronutrients beyond protein signal
- Comparison to recommended daily intake
- Any language about whether Megha is "doing well" or "needs improvement"
- Private/emotional context that Megha shared with the app (mood flags etc.)

Output: A structured markdown summary with sections for Completeness, Meal Timing, Protein Signal, Weekend Pattern, Behavioral Flags.
```

#### System Prompt: Recovery / Re-engagement Message
```
Generate a re-engagement message for a user who hasn't opened a food logging app in {gap_days} days.

User context: Young woman, Chennai, vegetarian South Indian diet, trying to lose weight and build consistent eating habits. Has been using the app intermittently.

MESSAGE RULES (strict):
- NEVER mention the number of days she was absent
- NEVER use the word "missed," "forgot," "should," "need to," "back," or "streak"
- Do NOT start with "It's okay" or any implicit acknowledgment of absence — this draws attention to the gap
- Keep to 1–2 sentences maximum
- End with an open invitation to log (not a command)
- Warm, personal, casual tone — like a friend checking in, not an app

Gap length guidance:
- 4–7 days: Just a warm simple prompt. No reference to gap.
- 8–14 days: Slightly warmer, acknowledge the present moment, not the past.
- 15+ days: Minimal, just an open door. No urgency.

Output: Just the message text. No explanation, no alternatives.
```

---

### Indian Food Context Injection Method
**Few-shot examples in system prompt** (not RAG — the dish vocabulary is small enough for few-shot, and RAG adds latency without benefit at this scale).

The system prompt includes:
1. South Indian dish glossary (~50 dishes with descriptions)
2. 6 few-shot examples of input → expected JSON output:
   - "had idli sambar" → standard breakfast parse
   - "rice meals at home" → inferred thali expansion
   - "puli sadam and mor kuzhambu" → regional dish handling
   - "had some stuff at a party" → social occasion handling
   - "tea and 2 biscuits" → snack parse
   - "lunch at MIL's place, had what she made" → shared meal handling

This entire system prompt (~2500 tokens) is cached via Anthropic's prompt caching — cache prefix on every request. Cost per request after cache: ~150 tokens input.

---

### Log Entry Data Schema (JSON)
```json
{
  "meal_id": "uuid-v4",
  "timestamp_logged": "2026-04-14T13:15:00+05:30",
  "timestamp_meal": "2026-04-14T13:00:00+05:30",
  "logged_late": false,
  "raw_input": "rice meals at home, had kootu and rasam",
  "input_modality": "voice|text",
  "meal_type": "breakfast|lunch|dinner|snack",
  "context": "home|restaurant|social_occasion|festival|travel|unknown",
  "items": [
    {
      "name": "rice",
      "quantity": "medium portion (~1 cup)",
      "confidence": 0.85,
      "inferred": false,
      "category": "grain",
      "protein_level": "low",
      "calories_estimate": 180,
      "calories_range": [150, 220]
    },
    {
      "name": "kootu",
      "quantity": "medium portion (~3 tbsp)",
      "confidence": 0.80,
      "inferred": false,
      "category": "vegetable",
      "protein_level": "low",
      "calories_estimate": 60,
      "calories_range": [40, 80]
    }
  ],
  "meal_calories_estimate": 240,
  "meal_calories_range": [190, 300],
  "calories_confidence": "low|medium|high",
  "completeness": "approximate",
  "quantity_certainty": "shared_bowl|self_reported|estimated",
  "parse_version": "1.0",
  "edited_by_user": false
}
```

**Calorie estimate notes:**
- LLM provides per-item and total estimates based on standard Indian food references (per 100g values for common dishes)
- All calorie values are tagged with `calories_confidence` — "low" for shared bowls/approximate entries, "medium" for self-reported portions, "high" only if user explicitly states quantity
- Displayed to Megha only on tap/expand ("See nutrition details") — not shown in primary view
- Always shown in Kavitha's coach view as a weekly range trend (not per-meal precision)
- Calorie estimates for festival/social meals are tagged "low confidence" and shown as a range — no false precision

---

### Coach View Generation: Hybrid (rule-based extraction + LLM synthesis)
**Data extraction**: Rule-based. Count meals, categorize protein levels, extract time slots, compute weekend vs weekday completeness. This is deterministic and fast.

**Narrative synthesis**: LLM (Claude Sonnet with coach summary prompt). The LLM receives the structured extract (not raw logs) and generates the readable summary. This allows coaching language to be nuanced without exposing private raw text to Kavitha.

**Why not pure LLM?** Rule-based extraction ensures numerical accuracy (LLMs hallucinate counts). Why not pure rule-based? Pattern interpretation ("consecutive dinner skips may indicate evening appetite suppression") requires LLM judgment.

**Updated for free-tier:** Coach summary LLM call uses Gemini 2.0 Flash — same free tier as meal parsing. No extra cost.

---

### Expected Round-Trip Latency for Primary Logging Interaction

| Step | Latency |
|---|---|
| Hold-to-speak button press | 0ms |
| Web Speech API transcription (5–10 word input) | 300–500ms |
| API route invocation (Next.js server) | 50ms |
| Gemini 2.0 Flash API | 600–900ms |
| Response parse + state update | 50ms |
| Confirmation card animation | 200ms |
| **Total: user presses button → sees confirmation** | **~1.5–2.0 seconds** |

This is acceptable. The 40-second window Megha has before leaving means 2 seconds of latency leaves 35+ seconds for confirmation tap. Voice feedback (subtle audio on transcription complete) bridges the perceived wait.

---

### Failure Handling

| Failure scenario | System behavior |
|---|---|
| API call fails mid-log | Raw text saved locally as `status: "pending_parse"`. On next successful connection, system offers "We saved your entry — want to finish logging it?" with the raw text pre-filled. |
| STT fails (mic denied, noise) | Auto-falls back to text input with the partial transcription (if any) pre-filled. No error message shown — just text input appears. |
| Partial API response | Retry once automatically. If second attempt fails, save raw input with manual entry fallback. |
| Network completely offline | Logging UI works for entry creation. Entries queue locally. Parse runs when online. Visual indicator: soft banner "Parsing when online." |
| STT misparses dish name | LLM fuzzy-corrects. If LLM returns `clarification_needed`, confirmation card shows the question before completing the entry. |

---

## 9. EVALUATION CRITERIA MAPPING

| Criterion | How prototype addresses it | Weakness | Mitigation |
|---|---|---|---|
| **1. Strength of thesis** | Single clear angle: completeness through amnesty + near-zero friction. One sentence, no hedging, every design decision traceable to it. | Could be seen as "just faster logging" not truly 10x. | Demo the specific moment: 40-second morning window, voice log, one-tap confirm. Show the streak recovery flow. Make the absence of guilt-language visceral. |
| **2. Build quality** | Working Next.js app with real Anthropic API integration. Voice input, LLM parse, structured output, day view, coach view. Not a mockup. | localStorage only (no auth, no backend). Coach view has limited real interactivity. | Be explicit in walkthrough: "This is a working prototype, not production. Here's exactly what's real and what's simulated." |
| **3. AI product instinct** | AI does: infer thali structure from "lunch at home", handle Tamil-English mixing, generate non-guilt recovery messages, synthesize behavioral pattern for coach. None of these are achievable with rule-based systems. | South Indian food parsing may have gaps in uncommon dish names. | Prepare 5 demo inputs that show AI doing things a lookup table cannot. Have text fallback for any voice failures during demo. |
| **4. User empathy** | System design is built from Megha's specific failure modes: guilt avoidance, shared bowls, 40-second morning window, weekend chaos. No streak counter by design. | Prototype may not capture full emotional texture — the non-reaction to bad meal entries is hard to demonstrate. | Walk through the "logs bad meal" stress test explicitly. Show the coach view has that entry — but Megha's view doesn't react. |
| **5. Habit thinking** | Week-based completeness (not streaks), identity-framing language, three-phase behavior adaptation (Day 1 vs Day 45), re-entry UX with zero gap acknowledgment. | Hard to demonstrate Day 45 behavior in a prototype. | Pre-seed app with 6 weeks of mock data. Show the "your breakfast pattern is consistent" insight that only emerges with history. |
| **6. Coach awareness** | Kavitha view surfaces behavioral signal (protein, timing, weekend pattern) not calories. Explicitly excludes calorie data because it's imprecise. LLM synthesis separates data extraction from narrative. | Coach interaction is one-directional in MVP (Kavitha sees data but can't respond in-app). | Frame this as explicit: "Kavitha's messaging is Week 2. This prototype proves what signal she'd receive." |
| **7. Taste and conviction** | Design is warm, specific to South Indian culture, non-clinical. Chips preserve Tamil dish names. No calorie numbers in UI. Explicit cuts list (11 features) with rationale. | "Warm" design is subjective — evaluators may want more visual polish. | Use the 30-minute frontend-design time to get the color palette, typography, and voice button animation right. First impression of the UI is load-bearing. |

---

## FILE STRUCTURE

```
/
├── app/
│   ├── layout.tsx          # Root layout, fonts, globals
│   ├── page.tsx            # Megha's home / logging screen
│   ├── day/[date]/         # Day view for a specific date
│   ├── coach/              # Kavitha's coach view (password gated)
│   └── api/
│       ├── parse-meal/     # POST: raw text → structured JSON (Claude)
│       └── coach-summary/  # POST: log data → coach narrative (Claude)
├── components/
│   ├── VoiceLogButton.tsx  # Hold-to-speak with Web Speech API
│   ├── ConfirmationCard.tsx # Slide-up confirmation with chips
│   ├── MealTimeline.tsx    # Day view timeline
│   ├── WeekBar.tsx         # Mon–Sun completeness dots
│   └── CoachSummary.tsx    # Coach view weekly panel
├── lib/
│   ├── gemini.ts           # Google Generative AI client
│   ├── prompts.ts          # System prompts (exported constants)
│   ├── storage.ts          # localStorage/IndexedDB operations
│   └── types.ts            # MealEntry, CoachSummary TypeScript types
├── hooks/
│   ├── useVoiceInput.ts    # Web Speech API hook
│   └── useMealLog.ts       # Log CRUD operations
└── public/
    └── mock-data.json      # Pre-seeded 6 weeks of Megha's logs for demo
```

---

## DEMO SCRIPT (for walkthrough)

1. **Open app** — show warm home screen, today empty, no intimidating dashboard
2. **Morning log** (voice) — say "idli sambar, 3 idlis, coconut chutney" — show 2-second parse → confirmation → one tap
3. **Lunch log** (text) — type "rice meals at home" — show thali inference with chips, remove one, confirm
4. **Afternoon snack** — show time-based prompt "Afternoon snack?" with pre-populated chips, one tap
5. **Bad meal** — type "had chips and ice cream late night" — show flat entry, no reaction
6. **"Am I doing okay?"** — show LLM-generated behavioral summary response
7. **Gap recovery** — pre-seed a 9-day gap in mock data — show re-entry with zero gap acknowledgment
8. **Coach view** — switch to `/coach` — walk through behavioral signal panel, protein trend, weekend pattern
9. **History navigation** — show week view, tap a past day, show that day's meals
10. **Close with thesis** — "The only thing this does is remove effort and remove guilt. Everything else is cut."

---

## 10. DESIGN AMENDMENTS (v2 feedback incorporated)

### 10.1 API Cost — Zero Cost Architecture
**Decision:** Use Google Gemini 2.0 Flash exclusively. Free tier: 1,500 requests/day, no credit card required.
**Setup:** Get API key at aistudio.google.com → set `GEMINI_API_KEY` in `.env.local`
**SDK:** `npm install @google/generative-ai`
**Fallback if Gemini quota exceeded:** Groq free tier (`npm install groq-sdk`) with `llama-3.3-70b-versatile`. Both free, both sufficient for prototype.

---

### 10.2 Calorie Estimates — Opt-in, Not Primary

**User view (Megha):**
- Calories are NOT shown in the default meal view
- A collapsed "Nutrition details" section at the bottom of each logged meal
- On tap/expand: shows per-item calorie range and meal total range with a soft disclaimer: "Rough estimate — home cooking varies"
- Low-confidence entries (shared bowls, festival meals) show only a wide range (e.g., "300–600 kcal") not a number

**Coach view (Kavitha):**
- Weekly calorie trend shown as a band chart (min–max range per day, not a single number)
- Explicitly labeled: "Estimated ranges — not clinical-grade"
- Useful for identifying days of very low intake (appetite suppression signal) or very high intake (social meal days)
- Not used for target comparison (no "should be 1500 kcal/day" bar)

**Calorie database source:** All reference values are sourced from the **Indian Food Composition Tables 2017 (IFCT 2017)**, published by the National Institute of Nutrition (NIN), Indian Council of Medical Research (ICMR), Hyderabad. This is the peer-reviewed gold standard for Indian food nutrition data. Key values embedded in the LLM system prompt:

| Dish | Serving | kcal (IFCT 2017) |
|---|---|---|
| Idli (steamed) | 1 piece (~30g) | 58 |
| Dosa (plain) | 1 piece (~50g) | 112 |
| Rice (cooked) | 1 cup (~150g) | 195 |
| Sambar | 1 katori (~100ml) | 35 |
| Rasam | 1 small bowl (~80ml) | 16 |
| Kootu (average) | 3 tbsp (~60g) | 48 |
| Poriyal (average) | 3 tbsp (~60g) | 55 |
| Curd (dahi) | 1 katori (~100g) | 60 |
| Sundal (chickpea) | 1 katori (~80g) | 131 |
| Filter coffee with milk | 1 cup (~150ml) | 42 |
| Murukku | 1 small handful (~25g) | 117 |
| Chapati (wheat) | 1 piece (~30g) | 71 |

These values are injected into the system prompt as a reference table. LLM scales by stated portion (small/medium/large multipliers: 0.6×/1.0×/1.5×). Estimates for non-IFCT items (e.g. restaurant dishes) fall back to category averages and are tagged `calories_confidence: "low"`.

**LLM instruction:** The meal parsing prompt includes per-item calorie estimates using the IFCT 2017 reference table above. All estimates tagged with confidence level. Wide ranges shown when portions are uncertain.

---

### 10.3 Chip Editing — Portion Quantity Override

**UX behavior on confirmation card:**
- Each chip is tappable after initial parse
- Tapping a chip opens an inline quantity editor:
  - For countable items (idli, dosa, chapati): stepper +/- (1, 2, 3...)
  - For volumetric items (sambar, kootu, rice): radio selector — [small] [medium] [large] [2 bowls] [skip]
  - For inferred items (marked with dotted border): same options + [remove] button
- User changes "1 bowl sambar" → "2 bowls" → chip updates to show "sambar × 2" with recalculated calorie range
- Edited items set `edited_by_user: true` and `quantity_certainty: "self_reported"`, raising calorie confidence to "medium"

**This applies on the confirmation card only.** Post-confirmation editing is available via tapping the meal entry in the day view (same inline editor).

---

### 10.4 Meal Slots — 3 Default, Configurable

**Default meal structure (3 slots):**
- Breakfast (6am–10am)
- Lunch (11am–3pm)
- Dinner (7pm–10pm)
- Snacks/Other: always available as a floating "+ add snack" button between any slots — not a forced 4th slot

**Rationale:** A mandatory "Afternoon" slot creates a visual gap that feels like failure if empty. Snacks should be available but never create an obligation. This is a deliberate behavior design decision.

**Configurability:**
- In `settings:user` → `meal_slots: ["breakfast", "lunch", "dinner"]` (default)
- User can add a "Tea/Snack" slot in settings → appears as a 4th time window
- Slot times are configurable (e.g., early riser shifts breakfast to 5:30–8am)
- Coach can see slot configuration to contextualize timing data

**UserProfile schema update:**
```json
{
  "meal_slots": ["breakfast", "lunch", "dinner"],
  "slot_times": {
    "breakfast": {"start": "06:00", "end": "10:00"},
    "lunch": {"start": "11:00", "end": "15:00"},
    "dinner": {"start": "19:00", "end": "22:00"}
  },
  "snack_prompt_enabled": true,
  "snack_prompt_time": "16:00"
}
```

---

### 10.5 Top 5 Stress Test Scenarios for v1 Build

Only these 5 will have explicit UI/logic built. Others are noted in documentation but not implemented.

**Priority rationale:** Selected by frequency (how often will this happen for Megha), behavioral impact (does getting this wrong break trust), and demo value (shows thesis clearly).

| # | Scenario | Why build in v1 |
|---|---|---|
| 1 | **Gap recovery (9+ days, re-entry with zero acknowledgment)** | Most common retention risk; directly tests the amnesty design thesis; high demo impact |
| 2 | **Mixed dish / thali inference ("rice meals at home")** | Core product feature — if this fails, the 10x thesis fails; must work correctly |
| 3 | **"Am I doing okay?" query** | Highest-impact AI-over-rule-based demonstration; shows LLM synthesizing behavioral pattern |
| 4 | **Guilt-log (bad meal logged, no app reaction)** | Directly demonstrates the non-judgment design; easy to demo; high evaluator impact |
| 5 | **Festival eating (Pongal/Diwali context detection)** | Culturally specific — shows product knows India; demonstrates contextual AI behavior |

**Deferred to v2 (not built):**
- Semaglutide / low appetite detection
- MIL visit / shared cooking context
- Social embarrassment / deferred logging
- Travel / unfamiliar food
- Coach protein concern nudge flow

---

### 10.6 Coach View — Day 1 Availability + Data States

**The coach view is accessible from day 1.** No gating. Kavitha should not be locked out while waiting for data.

**Three data states in coach view:**

**State 1: No data yet (0 days logged)**
```
[Kavitha view]
─────────────────────────────
Megha Iyer — Week of April 14

No meals logged yet this week.

The dashboard will populate as Megha logs meals.
Patterns become visible after 4 days of data.
─────────────────────────────
```

**State 2: Insufficient data (1–3 days logged)**
```
[Kavitha view]
─────────────────────────────
Megha Iyer — Week of April 14
Logged: 2/7 days so far

⟳ Collecting data — behavioral patterns need 4+ logged days per week
  to be meaningful. Check back later this week.

What's available so far:
• Meal timing: 2 data points (not enough to assess pattern)
• Protein signal: visible in 2+ more days
─────────────────────────────
```

**State 3: Sufficient data (4+ days logged)**
→ Full coach dashboard with all panels (as defined in Section 4)

**No historical comparison in v1:** The weekly summary shows current week only. No "vs last week" comparisons. This requires multi-week data that a new user won't have. Adding this to week 2 roadmap.

**Coach view auto-refreshes** when Megha logs a new meal (polling every 60s on the coach view page, or manual refresh button).

---

### 10.7 History Navigation — Day and Week Toggle

**Navigation pattern:**

```
[← Previous]  [Monday, April 14]  [Next →]   [Today]
[Day view]  [Week view]  ← toggle tabs
```

**Day view (default):**
- Shows meal timeline for selected date
- Tap any entry to expand with chips + nutrition detail
- "+" button to add a missed entry for past dates (logged late — sets `logged_late: true`)
- Navigation: swipe left/right or arrow buttons. Disabled future dates.

**Week view:**
- Mon–Sun grid of meal slot circles (filled = logged, empty = not logged)
- Tapping a day navigates to that day's detail view
- Week shown: current week by default; arrow navigation to go back week by week
- Shows weekly completeness bar + protein trend (low/medium/high per day as a color band)
- No calorie numbers in week view either

**Technical implementation:**
- URL-based navigation: `/day/2026-04-14` and `/week/2026-W16`
- Browser back/forward works correctly
- `useMealLog` hook exposes `getMealsForDate(date)` and `getMealsForWeek(weekStart)` — both read from localStorage keyed by date

**History depth:** localStorage holds 90 days of data for MVP. Older data is not deleted but may be archived. Week navigation disabled beyond 90 days.
