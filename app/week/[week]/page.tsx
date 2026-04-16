"use client";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MealEntry } from "@/lib/types";
import { getMealsForWeek } from "@/lib/storage";
import { WeekGrid } from "@/components/WeekGrid";
import { todayIST } from "@/hooks/useMealLog";
import { NutritionWizard } from "@/components/NutritionWizard";
import {
  dateToISOWeek,
  getWeekDates,
  shiftWeek,
  formatWeekRange,
  weekMonthLabel,
  oldestAllowedWeek,
  shortDayName,
  shortDateLabel,
} from "@/lib/dates";

export default function WeekPage() {
  const params = useParams();
  const router = useRouter();
  const weekStr = (params?.week as string) ?? "";
  const today = todayIST();
  const currentWeek = dateToISOWeek(today);

  const isValidWeek = /^\d{4}-W\d{2}$/.test(weekStr);
  const weekDates = isValidWeek ? getWeekDates(weekStr) : [];

  const [mealsByDate, setMealsByDate] = useState<Record<string, MealEntry[]>>({});

  const loadData = useCallback(() => {
    if (weekDates.length === 0) return;
    setMealsByDate(getMealsForWeek(weekDates));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!isValidWeek) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-screen gap-3"
        style={{ backgroundColor: "#FBF7F0" }}
      >
        <p className="text-sm" style={{ color: "#3D3D3D", opacity: 0.5 }}>
          Invalid week
        </p>
        <Link href="/" style={{ color: "#C4633A", fontSize: 14 }}>
          ← Back to today
        </Link>
      </div>
    );
  }

  const prevW = shiftWeek(weekStr, -1);
  const nextW = shiftWeek(weekStr, 1);
  // Disable next when already at or beyond current week
  const canGoForward = weekStr < currentWeek;
  const isTooFarBack = prevW < oldestAllowedWeek(today);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && !isTooFarBack) router.push(`/week/${prevW}`);
      if (e.key === "ArrowRight" && canGoForward) router.push(`/week/${nextW}`);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router, prevW, nextW, canGoForward, isTooFarBack]);

  const totalMeals = weekDates.reduce((sum, d) => sum + (mealsByDate[d]?.length ?? 0), 0);
  const loggedDays = weekDates.filter((d) => (mealsByDate[d]?.length ?? 0) >= 3).length;

  return (
    <div
      className="flex flex-col min-h-screen px-5 pt-8 pb-10"
      style={{ backgroundColor: "#FBF7F0" }}
    >
      {/* Floating Ask Aara wizard */}
      <NutritionWizard />

      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <p
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "#C4633A" }}
          >
            Aara · {weekStr === currentWeek ? "This week" : "Week"}
          </p>
          <h1 className="text-xl font-semibold mt-0.5" style={{ color: "#3D3D3D" }}>
            {formatWeekRange(weekStr)}
          </h1>
          <p className="text-xs mt-1" style={{ color: "#3D3D3D", opacity: 0.45 }}>
            {loggedDays > 0
              ? `${loggedDays} day${loggedDays !== 1 ? "s" : ""} logged this week`
              : totalMeals > 0
              ? `${totalMeals} meal${totalMeals !== 1 ? "s" : ""} logged`
              : "No meals logged yet"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Link
            href="/"
            className="text-xs rounded-full px-3 py-1.5 font-medium"
            style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}
          >
            Today
          </Link>
          <Link
            href="/coach"
            className="text-xs rounded-full px-3 py-1.5 font-medium"
            style={{ backgroundColor: "#fff", color: "#3D3D3D", border: "1.5px solid #e5e0d8" }}
          >
            Coach view
          </Link>
        </div>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        {isTooFarBack ? (
          <span
            className="rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: "#f0e8de", color: "#3D3D3D", opacity: 0.35, cursor: "not-allowed" }}
          >
            ← Prev
          </span>
        ) : (
          <Link
            href={`/week/${prevW}`}
            className="rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: "#fff", color: "#3D3D3D", border: "1.5px solid #e5e0d8" }}
          >
            ← Prev
          </Link>
        )}

        {/* Center label — "April 2026" */}
        <span className="text-sm font-medium" style={{ color: "#3D3D3D", opacity: 0.55 }}>
          {weekMonthLabel(weekStr)}
        </span>

        {canGoForward ? (
          <Link
            href={`/week/${nextW}`}
            className="rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: "#fff", color: "#3D3D3D", border: "1.5px solid #e5e0d8" }}
          >
            Next →
          </Link>
        ) : (
          <span
            className="rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: "#f0e8de", color: "#3D3D3D", opacity: 0.35, cursor: "not-allowed" }}
          >
            Next →
          </span>
        )}
      </div>

      {/* Week grid */}
      <WeekGrid weekDates={weekDates} mealsByDate={mealsByDate} today={today} />

      {/* Protein band legend */}
      <div className="flex gap-4 mt-3 px-1">
        {[
          { color: "#2D5016", label: "High protein" },
          { color: "#7c9a3d", label: "Some protein" },
          { color: "#d4a44c", label: "Low protein" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span
              className="inline-block rounded-full"
              style={{ width: 12, height: 4, backgroundColor: color }}
            />
            <span className="text-xs" style={{ color: "#3D3D3D", opacity: 0.45, fontSize: 10 }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      {/* Per-day summary cards */}
      {totalMeals > 0 && (
        <div className="flex flex-col gap-2 mt-5">
          <p className="text-xs font-semibold uppercase tracking-wide px-1" style={{ color: "#3D3D3D", opacity: 0.35 }}>
            Days
          </p>
          {weekDates
            .filter((d) => (mealsByDate[d]?.length ?? 0) > 0)
            .map((date) => {
              const meals = mealsByDate[date] ?? [];
              const isToday = date === today;
              const allItems = meals.flatMap((m) => m.items);
              const hasHigh = allItems.some((i) => i.protein_level === "high");
              const hasMedium = allItems.some((i) => i.protein_level === "medium");
              const pColor = hasHigh ? "#2D5016" : hasMedium ? "#7c9a3d" : "#d4a44c";
              const pLabel = hasHigh ? "high protein" : hasMedium ? "some protein" : "low protein";

              return (
                <Link
                  key={date}
                  href={`/day/${date}`}
                  className="rounded-2xl px-4 py-3 flex items-center justify-between"
                  style={{ backgroundColor: "#fff", border: "1px solid #f0e8de" }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: isToday ? "#C4633A" : "#3D3D3D" }}>
                      {isToday ? "Today" : `${shortDayName(date)}, ${shortDateLabel(date)}`}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs" style={{ color: "#3D3D3D", opacity: 0.5 }}>
                        {meals.length} meal{meals.length !== 1 ? "s" : ""}
                      </p>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pColor }} />
                      <p className="text-xs" style={{ color: "#3D3D3D", opacity: 0.5 }}>
                        {pLabel}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: "#C4633A", opacity: 0.6 }}>→</span>
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
