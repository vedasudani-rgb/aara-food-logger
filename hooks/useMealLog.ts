"use client";
import { useState, useEffect, useCallback } from "react";
import { MealEntry } from "@/lib/types";
import * as storage from "@/lib/storage";

export function useMealLog(date: string) {
  const [meals, setMeals] = useState<MealEntry[]>([]);

  const refresh = useCallback(() => {
    setMeals(storage.getMealsForDate(date));
  }, [date]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveMeal = useCallback(
    (entry: MealEntry) => {
      storage.saveMeal(date, entry);
      refresh();
    },
    [date, refresh]
  );

  const updateMeal = useCallback(
    (meal_id: string, patch: Partial<MealEntry>) => {
      storage.updateMeal(date, meal_id, patch);
      refresh();
    },
    [date, refresh]
  );

  const deleteMeal = useCallback(
    (meal_id: string) => {
      storage.deleteMeal(date, meal_id);
      refresh();
    },
    [date, refresh]
  );

  return { meals, saveMeal, updateMeal, deleteMeal };
}

// Returns the ISO date string for today in IST (+05:30)
export function todayIST(): string {
  const now = new Date();
  // Offset to IST
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split("T")[0];
}

// Returns an ISO8601 timestamp string with +05:30 suffix
export function nowIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().replace("Z", "+05:30");
}
