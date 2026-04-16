"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { seedMockData } from "@/lib/seedData";
import { getMealsForDate } from "@/lib/storage";
import { MealEntry } from "@/lib/types";
import { CoachSummaryInput } from "@/lib/prompts";
import { NutritionWizard } from "@/components/NutritionWizard";
import {
  extractISTMinutes,
  minutesToTimeStr,
  shortDayName,
  shortDateLabel,
} from "@/lib/dates";

// ── Helpers ──────────────────────────────────────────────────────────────────

function getLastNDates(n: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates.reverse();
}

function getPrevNDates(n: number, offset: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i - offset);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates.reverse();
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

type ProteinLabel = "high" | "medium" | "low";

function getMealProteinLevel(meal: MealEntry): ProteinLabel {
  if (meal.items.some((i) => i.protein_level === "high")) return "high";
  if (meal.items.some((i) => i.protein_level === "medium")) return "medium";
  return "low";
}

interface DayData {
  date: string;
  meals: MealEntry[];
}

// ── Timing computation (single source of truth) ───────────────────────────────

interface TimingDetail {
  date: string;
  meal: MealEntry;
  minutes: number;
}

interface TimingDetails {
  avgBreakfastStr: string | null;
  avgLunchStr: string | null;
  avgDinnerStr: string | null;
  avgBreakfastMin: number | null;
  avgLunchMin: number | null;
  avgDinnerMin: number | null;
  lateMeals: TimingDetail[];
  outliers: (TimingDetail & { diff: number; direction: "later" | "earlier" })[];
}

function computeTimingDetails(loggedDays: DayData[]): TimingDetails {
  const slots: Record<"breakfast" | "lunch" | "dinner", number[]> = {
    breakfast: [], lunch: [], dinner: [],
  };
  const mealTimestamps: TimingDetail[] = [];

  for (const d of loggedDays) {
    for (const m of d.meals) {
      const min = extractISTMinutes(m.timestamp_meal);
      if (min !== null) {
        mealTimestamps.push({ date: d.date, meal: m, minutes: min });
        if (m.meal_type === "breakfast" || m.meal_type === "lunch" || m.meal_type === "dinner") {
          slots[m.meal_type].push(min);
        }
      }
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

  const avgB = avg(slots.breakfast);
  const avgL = avg(slots.lunch);
  const avgD = avg(slots.dinner);

  const lateMeals = mealTimestamps.filter(({ minutes }) => minutes >= 23 * 60);

  const outliers = mealTimestamps
    .filter(({ meal, minutes }) => {
      if (meal.meal_type !== "breakfast" && meal.meal_type !== "lunch" && meal.meal_type !== "dinner")
        return false;
      const slotAvg = meal.meal_type === "breakfast" ? avgB : meal.meal_type === "lunch" ? avgL : avgD;
      return slotAvg !== null && Math.abs(minutes - slotAvg) > 90;
    })
    .map(({ date, meal, minutes }) => {
      const slotAvg =
        meal.meal_type === "breakfast" ? avgB! : meal.meal_type === "lunch" ? avgL! : avgD!;
      return {
        date, meal, minutes,
        diff: Math.abs(minutes - slotAvg),
        direction: minutes > slotAvg ? ("later" as const) : ("earlier" as const),
      };
    });

  return {
    avgBreakfastStr: avgB !== null ? minutesToTimeStr(avgB) : null,
    avgLunchStr: avgL !== null ? minutesToTimeStr(avgL) : null,
    avgDinnerStr: avgD !== null ? minutesToTimeStr(avgD) : null,
    avgBreakfastMin: avgB,
    avgLunchMin: avgL,
    avgDinnerMin: avgD,
    lateMeals,
    outliers,
  };
}

// ── Metrics computation (uses timing details for consistency) ─────────────────

function computeMetrics(
  days: DayData[],
  timeframe: number,
  timing: TimingDetails
): CoachSummaryInput {
  const loggedDays = days.filter((d) => d.meals.length > 0);
  const allMeals = loggedDays.flatMap((d) => d.meals);

  const dayLog = days.map((d) => ({
    date: d.date,
    dayName: shortDayName(d.date),
    mealCount: d.meals.length,
    mealTypes: d.meals.map((m) => m.meal_type),
  }));

  const proteinCounts = { high: 0, medium: 0, low: 0 };
  for (const meal of allMeals) proteinCounts[getMealProteinLevel(meal)]++;

  let weekdayMealCount = 0;
  let weekendMealCount = 0;
  for (const d of loggedDays) {
    if (isWeekend(d.date)) weekendMealCount += d.meals.length;
    else weekdayMealCount += d.meals.length;
  }

  return {
    timeframeDays: timeframe,
    loggedDays: loggedDays.length,
    totalMeals: allMeals.length,
    expectedMeals: timeframe * 3,
    dayLog,
    proteinCounts,
    avgTimings: {
      breakfast: timing.avgBreakfastStr,
      lunch: timing.avgLunchStr,
      dinner: timing.avgDinnerStr,
    },
    lateMeals: timing.lateMeals.map(({ date, meal, minutes }) => ({
      date,
      dayName: shortDayName(date),
      mealType: meal.meal_type,
      time: minutesToTimeStr(minutes),
    })),
    timingOutliers: timing.outliers.map(({ date, meal, minutes, diff, direction }) => ({
      date,
      dayName: shortDayName(date),
      mealType: meal.meal_type,
      time: minutesToTimeStr(minutes),
      note: `${Math.round(diff / 6) / 10}h ${direction} than avg`,
    })),
    weekdayMealCount,
    weekendMealCount,
  };
}

// ── Auth gate ─────────────────────────────────────────────────────────────────

export default function CoachPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === "kavitha") { setAuthed(true); setError(false); }
    else setError(true);
  };

  if (!authed) {
    return (
      <div className="flex flex-col min-h-screen items-center justify-center px-6" style={{ backgroundColor: "#FBF7F0" }}>
        <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#C4633A" }}>Aara</p>
        <h1 className="text-xl font-semibold mb-8" style={{ color: "#3D3D3D" }}>Coach view</h1>
        <form onSubmit={handleSubmit} className="w-full max-w-xs flex flex-col gap-3">
          <input
            type="password" autoFocus placeholder="Password"
            value={pw} onChange={(e) => { setPw(e.target.value); setError(false); }}
            className="w-full rounded-2xl px-4 py-3 text-base outline-none border-2"
            style={{ borderColor: error ? "#ef4444" : "#C4633A", color: "#3D3D3D", backgroundColor: "#fff" }}
          />
          {error && <p className="text-xs text-center" style={{ color: "#ef4444" }}>Wrong password</p>}
          <button type="submit" className="w-full rounded-2xl py-3 font-semibold text-white" style={{ backgroundColor: "#C4633A" }}>
            Enter
          </button>
        </form>
        <Link href="/" className="mt-6 text-sm" style={{ color: "#3D3D3D", opacity: 0.4 }}>← Back</Link>
      </div>
    );
  }

  return <CoachDashboard />;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function CoachDashboard() {
  const [timeframe, setTimeframe] = useState<7 | 14>(7);
  const [days, setDays] = useState<DayData[]>([]);
  const [prevDays, setPrevDays] = useState<DayData[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(0);

  const loadData = useCallback(() => {
    seedMockData();
    const curr = getLastNDates(timeframe).map((d) => ({ date: d, meals: getMealsForDate(d) }));
    const prev = getPrevNDates(timeframe, timeframe).map((d) => ({ date: d, meals: getMealsForDate(d) }));
    setDays(curr);
    setPrevDays(prev);
    setSummary(null);
    setSummaryError(false);
    setLastRefresh(Date.now());
  }, [timeframe]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      const curr = getLastNDates(timeframe).map((d) => ({ date: d, meals: getMealsForDate(d) }));
      const prev = getPrevNDates(timeframe, timeframe).map((d) => ({ date: d, meals: getMealsForDate(d) }));
      setDays(curr);
      setPrevDays(prev);
      setLastRefresh(Date.now());
    }, 60_000);
    return () => clearInterval(interval);
  }, [loadData, timeframe]);

  const loggedDays = useMemo(() => days.filter((d) => d.meals.length > 0), [days]);
  const loggedCount = loggedDays.length;

  // Single source of truth for timing — used by both display and API
  const timingDetails = useMemo(
    () => computeTimingDetails(loggedDays),
    [loggedDays]
  );

  const metrics = useMemo(
    () => (days.length > 0 ? computeMetrics(days, timeframe, timingDetails) : null),
    [days, timeframe, timingDetails]
  );

  const fetchSummary = useCallback(async () => {
    if (!metrics) return;
    setSummaryLoading(true);
    setSummaryError(false);
    try {
      const res = await fetch("/api/coach-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metrics),
      });
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setSummary(data.summary ?? null);
    } catch {
      setSummaryError(true);
    } finally {
      setSummaryLoading(false);
    }
  }, [metrics]);

  useEffect(() => {
    if (loggedCount >= 4 && !summary && !summaryLoading && !summaryError) {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastRefresh, loggedCount]);

  return (
    <div className="flex flex-col min-h-screen px-5 pt-8 pb-10" style={{ backgroundColor: "#FBF7F0" }}>
      {/* Floating Ask Aara wizard */}
      <NutritionWizard />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#C4633A" }}>Aara · Coach</p>
          <h1 className="text-xl font-semibold mt-0.5" style={{ color: "#3D3D3D" }}>Megha&rsquo;s patterns</h1>
        </div>
        <Link href="/" className="text-xs rounded-full px-3 py-1.5 font-medium" style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}>
          ← Log view
        </Link>
      </div>

      {/* Timeframe toggle */}
      <div className="flex rounded-2xl p-1 mb-5 self-start" style={{ backgroundColor: "#f0e8de" }}>
        {([7, 14] as const).map((tf) => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className="rounded-xl px-4 py-1.5 text-sm font-medium transition-colors"
            style={{
              backgroundColor: timeframe === tf ? "#C4633A" : "transparent",
              color: timeframe === tf ? "#fff" : "#3D3D3D",
            }}
          >
            Last {tf} days
          </button>
        ))}
      </div>

      {loggedCount === 0 ? (
        <ZeroDayState />
      ) : loggedCount < 4 ? (
        <PartialDataState loggedCount={loggedCount} days={days} />
      ) : (
        <FullDashboard
          days={days}
          loggedDays={loggedDays}
          prevDays={prevDays}
          timeframe={timeframe}
          timingDetails={timingDetails}
          summary={summary}
          summaryLoading={summaryLoading}
          summaryError={summaryError}
          onRetry={() => { setSummary(null); setSummaryError(false); fetchSummary(); }}
        />
      )}
    </div>
  );
}

// ── Zero / partial states ─────────────────────────────────────────────────────

function ZeroDayState() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 py-16 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f5ede5" }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#C4633A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      </div>
      <div className="max-w-xs">
        <p className="font-semibold text-base mb-2" style={{ color: "#3D3D3D" }}>No meals logged yet</p>
        <p className="text-sm leading-relaxed" style={{ color: "#3D3D3D", opacity: 0.55 }}>
          Patterns visible after 4 logged days.
        </p>
      </div>
    </div>
  );
}

function PartialDataState({ loggedCount, days }: { loggedCount: number; days: DayData[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl px-4 py-4 text-sm" style={{ backgroundColor: "#fff", border: "1px solid #f0e8de", color: "#3D3D3D" }}>
        <p className="font-semibold mb-1" style={{ color: "#C4633A" }}>{loggedCount} day{loggedCount > 1 ? "s" : ""} logged</p>
        <p style={{ opacity: 0.6 }}>Check back in {4 - loggedCount} more day{4 - loggedCount > 1 ? "s" : ""} for full analysis.</p>
      </div>
      <DayBreakdown days={days} />
    </div>
  );
}

// ── Full dashboard ────────────────────────────────────────────────────────────

interface FullDashboardProps {
  days: DayData[];
  loggedDays: DayData[];
  prevDays: DayData[];
  timeframe: number;
  timingDetails: TimingDetails;
  summary: string | null;
  summaryLoading: boolean;
  summaryError: boolean;
  onRetry: () => void;
}

function FullDashboard({
  days, loggedDays, prevDays, timeframe, timingDetails,
  summary, summaryLoading, summaryError, onRetry,
}: FullDashboardProps) {
  const allMeals = useMemo(() => loggedDays.flatMap((d) => d.meals), [loggedDays]);
  const totalMeals = allMeals.length;
  const expectedMeals = timeframe * 3;
  const completenessPercent = Math.min(100, Math.round((totalMeals / expectedMeals) * 100));

  // Previous period completeness
  const prevAllMeals = useMemo(() => prevDays.flatMap((d) => d.meals), [prevDays]);
  const prevCompleteness = Math.min(100, Math.round((prevAllMeals.length / expectedMeals) * 100));
  const completnessDelta = completenessPercent - prevCompleteness;

  // Protein distribution with meal refs
  const proteinMeals = useMemo(() => {
    const high: { date: string; meal: MealEntry }[] = [];
    const medium: { date: string; meal: MealEntry }[] = [];
    const low: { date: string; meal: MealEntry }[] = [];
    for (const d of loggedDays) {
      for (const m of d.meals) {
        const level = getMealProteinLevel(m);
        if (level === "high") high.push({ date: d.date, meal: m });
        else if (level === "medium") medium.push({ date: d.date, meal: m });
        else low.push({ date: d.date, meal: m });
      }
    }
    return { high, medium, low };
  }, [loggedDays]);

  const proteinCounts = {
    high: proteinMeals.high.length,
    medium: proteinMeals.medium.length,
    low: proteinMeals.low.length,
  };

  // Calorie bands
  const calorieBands = useMemo(
    () =>
      loggedDays.map((d) => ({
        date: d.date,
        min: d.meals.reduce((s, m) => s + m.meal_calories_range[0], 0),
        max: d.meals.reduce((s, m) => s + m.meal_calories_range[1], 0),
        est: d.meals.reduce((s, m) => s + m.meal_calories_estimate, 0),
      })),
    [loggedDays]
  );

  const maxCalRaw = Math.max(...calorieBands.map((b) => b.max), 1);
  const yMax = Math.ceil(maxCalRaw / 500) * 500;
  const yMid = Math.round(yMax / 2);
  const yQuarter = Math.round(yMax / 4);

  return (
    <div className="flex flex-col gap-4">
      <DayBreakdown days={days} />

      {/* Completeness */}
      <CompletenessCard
        totalMeals={totalMeals}
        expectedMeals={expectedMeals}
        completenessPercent={completenessPercent}
        delta={prevAllMeals.length > 0 ? completnessDelta : null}
        timeframe={timeframe}
      />

      {/* Protein signal */}
      <ProteinSignalCard
        proteinCounts={proteinCounts}
        proteinMeals={proteinMeals}
        totalMeals={totalMeals}
      />

      {/* Calorie ranges */}
      {calorieBands.length > 0 && (
        <CalorieRangesCard
          calorieBands={calorieBands}
          yMax={yMax}
          yMid={yMid}
          yQuarter={yQuarter}
        />
      )}

      {/* Meal timing — uses the same timingDetails computed in parent */}
      <MealTimingCard timingDetails={timingDetails} />

      {/* Behavioral summary */}
      <Card title="Behavioral Summary">
        {summaryLoading && <p className="text-sm" style={{ color: "#3D3D3D", opacity: 0.5 }}>Generating…</p>}
        {summaryError && (
          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: "#3D3D3D", opacity: 0.5 }}>Could not generate summary.</p>
            <button onClick={onRetry} className="text-sm font-semibold self-start rounded-xl px-3 py-1.5" style={{ color: "#fff", backgroundColor: "#C4633A" }}>Retry</button>
          </div>
        )}
        {summary && <MarkdownSummary text={summary} />}
        {!summary && !summaryLoading && !summaryError && (
          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: "#3D3D3D", opacity: 0.4 }}>Summary not yet generated.</p>
            <button onClick={onRetry} className="text-sm font-semibold self-start rounded-xl px-3 py-1.5" style={{ color: "#fff", backgroundColor: "#C4633A" }}>Generate summary</button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Completeness card ─────────────────────────────────────────────────────────

function CompletenessCard({
  totalMeals, expectedMeals, completenessPercent, delta, timeframe,
}: {
  totalMeals: number;
  expectedMeals: number;
  completenessPercent: number;
  delta: number | null;
  timeframe: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "#fff", border: "1px solid #f0e8de" }}>
      {/* Title row */}
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#3D3D3D", opacity: 0.4 }}>
          Completeness
        </p>
        {/* Info tooltip trigger — hover */}
        <div
          className="relative"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <span
            className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold leading-none shrink-0 cursor-default select-none"
            style={{ backgroundColor: "#f0e8de", color: "#C4633A" }}
            aria-label="Completeness info"
          >
            i
          </span>
          {showTooltip && (
            <div
              className="absolute left-0 top-6 z-20 rounded-xl px-3 py-2 text-xs shadow-lg"
              style={{ backgroundColor: "#3D3D3D", color: "#fff", whiteSpace: "nowrap" }}
            >
              3 meals logged per day = complete day.
              <br />
              Target: {expectedMeals} meals over {timeframe} days.
            </div>
          )}
        </div>
        {/* Period-over-period delta */}
        {delta !== null && delta !== 0 && (
          <span
            className="ml-auto text-xs font-semibold rounded-full px-2 py-0.5"
            style={{
              backgroundColor: delta > 0 ? "#e8f0de" : "#fef3c7",
              color: delta > 0 ? "#2D5016" : "#92400e",
            }}
          >
            {delta > 0 ? "+" : ""}{delta}% vs prev period
          </span>
        )}
        {delta === 0 && (
          <span className="ml-auto text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: "#f0e8de", color: "#3D3D3D", opacity: 0.6 }}>
            Same as prev period
          </span>
        )}
      </div>

      <div className="flex items-end gap-3">
        <span className="text-3xl font-bold" style={{ color: "#3D3D3D" }}>{totalMeals}</span>
        <span className="text-sm pb-1" style={{ color: "#3D3D3D", opacity: 0.5 }}>
          of ~{expectedMeals} meals ({timeframe} days)
        </span>
      </div>
      <div className="mt-2 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f0e8de" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${completenessPercent}%`, backgroundColor: "#C4633A" }}
        />
      </div>
      <p className="text-xs mt-1" style={{ color: "#3D3D3D", opacity: 0.45 }}>
        {completenessPercent}% completeness
      </p>
    </div>
  );
}

// ── Calorie ranges card ───────────────────────────────────────────────────────

function CalorieRangesCard({
  calorieBands, yMax, yMid, yQuarter,
}: {
  calorieBands: { date: string; min: number; max: number; est: number }[];
  yMax: number;
  yMid: number;
  yQuarter: number;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const CHART_H = 140;   // total container height
  const BAR_H = 120;     // usable bar area height

  return (
    <Card title="Estimated Calorie Ranges (kcal)">
      <p className="text-xs mb-3" style={{ color: "#3D3D3D", opacity: 0.4 }}>
        Rough estimates — not clinical-grade. Home cooking varies.
      </p>

      <div className="flex gap-2">
        {/* Y-axis */}
        <div className="flex flex-col justify-between text-right shrink-0" style={{ height: CHART_H, width: 38 }}>
          <span style={{ color: "#3D3D3D", opacity: 0.65, fontSize: 10, fontWeight: 600 }}>{yMax}</span>
          <span style={{ color: "#3D3D3D", opacity: 0.65, fontSize: 10, fontWeight: 600 }}>{yMid}</span>
          <span style={{ color: "#3D3D3D", opacity: 0.65, fontSize: 10, fontWeight: 600 }}>{yQuarter}</span>
          <span style={{ color: "#3D3D3D", opacity: 0.65, fontSize: 10, fontWeight: 600 }}>0</span>
        </div>

        {/* Bars */}
        <div className="flex flex-1 items-end gap-1.5" style={{ height: CHART_H }}>
          {calorieBands.map((b) => {
            const barH = Math.max(2, Math.round((b.est / yMax) * BAR_H));
            const minH = Math.round((b.min / yMax) * BAR_H);
            const maxH = Math.round((b.max / yMax) * BAR_H);
            const dayLabel = new Date(b.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short" });
            const isHovered = hoveredDate === b.date;

            return (
              <div
                key={b.date}
                className="flex-1 flex flex-col items-center gap-0.5 relative cursor-pointer"
                onMouseEnter={() => setHoveredDate(b.date)}
                onMouseLeave={() => setHoveredDate(null)}
                onClick={() => setHoveredDate((p) => (p === b.date ? null : b.date))}
              >
                {/* Tooltip */}
                {isHovered && (
                  <div
                    className="absolute z-20 rounded-xl px-2.5 py-2 text-xs shadow-lg pointer-events-none"
                    style={{
                      bottom: "100%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      marginBottom: 6,
                      backgroundColor: "#3D3D3D",
                      color: "#fff",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <p className="font-semibold">~{b.est} kcal est.</p>
                    <p style={{ opacity: 0.65 }}>Range: {b.min}–{b.max} kcal</p>
                  </div>
                )}

                <div className="relative w-full flex justify-center" style={{ height: BAR_H }}>
                  {/* Range band (lighter box) */}
                  <div
                    className="absolute rounded w-full transition-colors"
                    style={{
                      bottom: minH,
                      height: Math.max(3, maxH - minH),
                      backgroundColor: isHovered ? "#e8d5c8" : "#f5ede5",
                    }}
                  />
                  {/* Point estimate dot */}
                  <div
                    className="absolute rounded-full transition-colors"
                    style={{
                      bottom: barH - 5,
                      width: isHovered ? 12 : 8,
                      height: isHovered ? 12 : 8,
                      backgroundColor: "#C4633A",
                      left: "50%",
                      transform: "translateX(-50%)",
                    }}
                  />
                </div>
                <span style={{ color: "#3D3D3D", opacity: 0.65, fontSize: 10, fontWeight: 600 }}>{dayLabel}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: "#f5ede5", border: "1px solid #e5ddd4" }} />
          <span style={{ color: "#3D3D3D", opacity: 0.5, fontSize: 10 }}>Possible range</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#C4633A" }} />
          <span style={{ color: "#3D3D3D", opacity: 0.5, fontSize: 10 }}>Point estimate</span>
        </div>
      </div>
    </Card>
  );
}

// ── Meal timing card ──────────────────────────────────────────────────────────

function MealTimingCard({ timingDetails }: { timingDetails: TimingDetails }) {
  const { avgBreakfastStr, avgLunchStr, avgDinnerStr, lateMeals, outliers } = timingDetails;
  const hasFlags = lateMeals.length > 0 || outliers.length > 0;

  return (
    <Card title="Meal Timing">
      {/* Average timing chips */}
      <p className="text-xs mb-2" style={{ color: "#3D3D3D", opacity: 0.4 }}>
        Avg. over selected period
      </p>
      <div className="flex gap-2 flex-wrap mb-3">
        {[
          { label: "Breakfast", time: avgBreakfastStr },
          { label: "Lunch", time: avgLunchStr },
          { label: "Dinner", time: avgDinnerStr },
        ].map(({ label, time }) => (
          <div
            key={label}
            className="rounded-xl px-3 py-1.5"
            style={{ backgroundColor: "#f5ede5" }}
          >
            <p className="text-xs" style={{ color: "#3D3D3D", opacity: 0.5 }}>{label}</p>
            <p className="text-sm font-semibold" style={{ color: "#3D3D3D" }}>{time ?? "—"}</p>
          </div>
        ))}
      </div>

      {/* Flags */}
      {!hasFlags && (
        <p className="text-xs" style={{ color: "#3D3D3D", opacity: 0.35 }}>No timing flags this period.</p>
      )}

      {lateMeals.length > 0 && (
        <div className="rounded-xl px-3 py-2 mb-2" style={{ backgroundColor: "#fef3c7" }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "#92400e" }}>
            {lateMeals.length} meal{lateMeals.length > 1 ? "s" : ""} after 11 pm
          </p>
          <div className="flex flex-col gap-0.5">
            {lateMeals.map(({ date, meal, minutes }, i) => (
              <p key={i} className="text-xs" style={{ color: "#92400e", opacity: 0.85 }}>
                {shortDayName(date)} {shortDateLabel(date)}
                <span style={{ opacity: 0.6 }}> · {meal.meal_type}</span>
                {" "}{minutesToTimeStr(minutes)}
              </p>
            ))}
          </div>
        </div>
      )}

      {outliers.length > 0 && (
        <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#f5ede5" }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: "#3D3D3D", opacity: 0.6 }}>
            {outliers.length} timing outlier{outliers.length > 1 ? "s" : ""} (&gt;90 min from avg)
          </p>
          <div className="flex flex-col gap-0.5">
            {outliers.map(({ date, meal, minutes, diff, direction }, i) => (
              <p key={i} className="text-xs" style={{ color: "#3D3D3D", opacity: 0.7 }}>
                {shortDayName(date)} {shortDateLabel(date)}
                <span style={{ opacity: 0.6 }}> · {meal.meal_type}</span>
                {" "}{minutesToTimeStr(minutes)}
                <span style={{ opacity: 0.45 }}> ({Math.round(diff / 6) / 10}h {direction})</span>
              </p>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Day breakdown ─────────────────────────────────────────────────────────────

function DayBreakdown({ days }: { days: DayData[] }) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "#fff", border: "1px solid #f0e8de" }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#3D3D3D", opacity: 0.4 }}>
        Day-by-day
      </p>
      <div className="flex flex-col gap-1.5">
        {days.map((d) => {
          const count = d.meals.length;
          const isFull = count >= 3;
          const hasAny = count > 0;
          return (
            <Link key={d.date} href={`/day/${d.date}`} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{
                  backgroundColor: isFull ? "#C4633A" : hasAny ? "#f5ede5" : "#f0e8de",
                  color: isFull ? "#fff" : hasAny ? "#C4633A" : "#3D3D3D",
                  opacity: hasAny ? 1 : 0.4,
                }}
              >
                {count > 0 ? count : "·"}
              </div>
              <span className="text-sm w-8 shrink-0" style={{ color: "#3D3D3D", opacity: hasAny ? 0.7 : 0.35 }}>
                {shortDayName(d.date)}
              </span>
              <span className="text-sm flex-1" style={{ color: "#3D3D3D", opacity: hasAny ? 0.9 : 0.35 }}>
                {shortDateLabel(d.date)}
              </span>
              <span className="text-xs" style={{ color: hasAny ? "#C4633A" : "#3D3D3D", opacity: hasAny ? 0.7 : 0.3 }}>
                {count > 0 ? `${count} meal${count !== 1 ? "s" : ""}` : "—"}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Protein signal ────────────────────────────────────────────────────────────

interface ProteinMealRef { date: string; meal: MealEntry; }

function ProteinSignalCard({
  proteinCounts, proteinMeals, totalMeals,
}: {
  proteinCounts: { high: number; medium: number; low: number };
  proteinMeals: { high: ProteinMealRef[]; medium: ProteinMealRef[]; low: ProteinMealRef[] };
  totalMeals: number;
}) {
  const [selected, setSelected] = useState<ProteinLabel | null>(null);
  const toggle = (level: ProteinLabel) => setSelected((prev) => (prev === level ? null : level));

  const BARS: { level: ProteinLabel; label: string; color: string }[] = [
    { level: "high", label: "High", color: "#2D5016" },
    { level: "medium", label: "Medium", color: "#7c9a3d" },
    { level: "low", label: "Low", color: "#d4a44c" },
  ];

  const selectedMeals = selected ? proteinMeals[selected] : [];

  return (
    <Card title="Protein Signal">
      <div className="flex gap-3">
        {/* Bars */}
        <div className="flex flex-col gap-2.5" style={{ flex: 1 }}>
          {BARS.map(({ level, label, color }) => {
            const count = proteinCounts[level];
            const pct = totalMeals > 0 ? Math.round((count / totalMeals) * 100) : 0;
            const isActive = selected === level;
            return (
              <button key={level} onClick={() => toggle(level)} className="flex flex-col gap-1 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium" style={{ color: isActive ? color : "#3D3D3D", opacity: isActive ? 1 : 0.6 }}>
                    {label} · {count}
                  </span>
                  {isActive && <span className="text-xs" style={{ color }}>▾</span>}
                </div>
                <div
                  className="h-2 rounded-full overflow-hidden"
                  style={{ backgroundColor: "#f0e8de", outline: isActive ? `2px solid ${color}` : "none", outlineOffset: 1 }}
                >
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                </div>
              </button>
            );
          })}
          {proteinCounts.high + proteinCounts.medium < proteinCounts.low && (
            <p className="text-xs mt-1 rounded-xl px-2 py-1.5" style={{ backgroundColor: "#fef3c7", color: "#92400e" }}>
              Mostly low-protein — worth a conversation
            </p>
          )}
        </div>

        {/* Detail panel */}
        <div
          className="rounded-xl overflow-y-auto"
          style={{ width: "44%", maxHeight: 160, minHeight: 72, backgroundColor: selected ? "#f5ede5" : "#f9f6f2" }}
        >
          {selected ? (
            <div className="px-2.5 py-2">
              <p className="text-xs font-semibold mb-1.5 capitalize" style={{ color: BARS.find((b) => b.level === selected)!.color }}>
                {selected} · {selectedMeals.length} meal{selectedMeals.length !== 1 ? "s" : ""}
              </p>
              {selectedMeals.length === 0 ? (
                <p className="text-xs" style={{ color: "#3D3D3D", opacity: 0.45 }}>None</p>
              ) : (
                selectedMeals.map(({ date, meal }, i) => (
                  <div key={i} className="mb-2">
                    <p className="text-xs font-medium" style={{ color: "#3D3D3D" }}>
                      {shortDayName(date)} {shortDateLabel(date)} · {meal.meal_type}
                    </p>
                    <p className="text-xs leading-snug" style={{ color: "#3D3D3D", opacity: 0.6 }}>
                      {meal.items
                        .filter((item) =>
                          selected === "high" ? item.protein_level === "high"
                          : selected === "medium" ? item.protein_level === "medium"
                          : item.protein_level === "low" || item.protein_level === "unknown"
                        )
                        .map((item) => item.name)
                        .join(", ") || meal.items.map((i) => i.name).join(", ")}
                    </p>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full px-2 py-4">
              <p className="text-xs text-center" style={{ color: "#3D3D3D", opacity: 0.35 }}>Tap a bar to see meals</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ backgroundColor: "#fff", border: "1px solid #f0e8de" }}>
      <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#3D3D3D", opacity: 0.4 }}>
        {title}
      </p>
      {children}
    </div>
  );
}

function MarkdownSummary({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <p key={i} className="text-xs font-semibold uppercase tracking-wide mt-3 first:mt-0" style={{ color: "#C4633A" }}>
              {line.replace(/^##\s*/, "")}
            </p>
          );
        }
        if (line.startsWith("# ")) {
          return <p key={i} className="text-sm font-semibold" style={{ color: "#3D3D3D" }}>{line.replace(/^#\s*/, "")}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="text-sm leading-relaxed pl-1 flex gap-2" style={{ color: "#3D3D3D", opacity: 0.85 }}>
              <span className="font-bold shrink-0" style={{ color: "#C4633A", fontSize: 16, lineHeight: "1.4" }}>•</span>
              <span>{line.replace(/^[-*]\s*/, "")}</span>
            </p>
          );
        }
        if (line.trim() === "") return null;
        return <p key={i} className="text-sm leading-relaxed" style={{ color: "#3D3D3D", opacity: 0.75 }}>{line}</p>;
      })}
    </div>
  );
}
