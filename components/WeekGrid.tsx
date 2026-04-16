"use client";
import Link from "next/link";
import { MealEntry } from "@/lib/types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type ProteinLevel = "high" | "medium" | "low" | "none";

function getDayProteinLevel(meals: MealEntry[]): ProteinLevel {
  if (meals.length === 0) return "none";
  let hasHigh = false;
  let hasMedium = false;
  for (const meal of meals) {
    for (const item of meal.items) {
      if (item.protein_level === "high") hasHigh = true;
      else if (item.protein_level === "medium") hasMedium = true;
    }
  }
  if (hasHigh) return "high";
  if (hasMedium) return "medium";
  return "low";
}

function proteinColor(level: ProteinLevel): string {
  switch (level) {
    case "high":   return "#2D5016";
    case "medium": return "#7c9a3d";
    case "low":    return "#d4a44c";
    default:       return "transparent";
  }
}

interface WeekGridProps {
  weekDates: string[];                       // 7 YYYY-MM-DD strings, Mon→Sun
  mealsByDate: Record<string, MealEntry[]>;
  today: string;                             // YYYY-MM-DD
}

export function WeekGrid({ weekDates, mealsByDate, today }: WeekGridProps) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#fff", border: "1px solid #f0e8de" }}>
      <div className="grid grid-cols-7">
        {weekDates.map((date, i) => {
          const meals = mealsByDate[date] ?? [];
          const count = meals.length;
          const pLevel = getDayProteinLevel(meals);
          const pColor = proteinColor(pLevel);
          const isToday = date === today;
          const isFuture = date > today;
          const hasData = count > 0;
          const dayNum = new Date(date + "T00:00:00").getDate();

          const cell = (
            <div
              className="flex flex-col items-center pt-3 pb-4 relative select-none"
              style={{ borderRight: i < 6 ? "1px solid #f0e8de" : "none" }}
            >
              {/* Day label */}
              <span
                className="text-xs mb-1.5"
                style={{
                  color: isToday ? "#C4633A" : "#3D3D3D",
                  fontWeight: isToday ? 700 : 400,
                  opacity: hasData || isToday ? 1 : 0.35,
                  fontSize: 10,
                }}
              >
                {DAY_LABELS[i]}
              </span>

              {/* Day number circle */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{
                  backgroundColor: isToday ? "#C4633A" : hasData ? "#f5ede5" : "transparent",
                  color: isToday ? "#fff" : hasData ? "#C4633A" : "#3D3D3D",
                  opacity: hasData || isToday ? 1 : 0.25,
                }}
              >
                {dayNum}
              </div>

              {/* Meal count */}
              <span
                className="text-xs mt-0.5"
                style={{ color: "#3D3D3D", opacity: 0.4, fontSize: 9, minHeight: 12 }}
              >
                {count > 0 ? count : ""}
              </span>

              {/* Protein color band at bottom */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1"
                style={{ backgroundColor: pColor }}
              />
            </div>
          );

          if (isFuture) {
            return (
              <div key={date} style={{ opacity: 0.3, cursor: "default" }}>
                {cell}
              </div>
            );
          }

          return (
            <Link key={date} href={isToday ? "/" : `/day/${date}`} className="block hover:bg-orange-50 transition-colors">
              {cell}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
