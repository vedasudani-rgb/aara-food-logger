import { MealEntry, UserProfile } from "@/lib/types";

const DEFAULT_USER_PROFILE: UserProfile = {
  meal_slots: ["breakfast", "lunch", "dinner"],
  slot_times: {
    breakfast: { start: "06:00", end: "10:00" },
    lunch: { start: "11:00", end: "15:00" },
    dinner: { start: "19:00", end: "22:00" },
  },
  snack_prompt_enabled: true,
  snack_prompt_time: "16:00",
};

function dateKey(date: string): string {
  return `logs:${date}`;
}

export function getMealsForDate(date: string): MealEntry[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(dateKey(date));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as MealEntry[];
  } catch {
    return [];
  }
}

export function getMealsForWeek(weekDates: string[]): Record<string, MealEntry[]> {
  const result: Record<string, MealEntry[]> = {};
  for (const date of weekDates) {
    result[date] = getMealsForDate(date);
  }
  return result;
}

export function saveMeal(date: string, entry: MealEntry): void {
  if (typeof window === "undefined") return;
  const existing = getMealsForDate(date);
  const idx = existing.findIndex((m) => m.meal_id === entry.meal_id);
  if (idx >= 0) {
    existing[idx] = entry;
  } else {
    existing.push(entry);
  }
  localStorage.setItem(dateKey(date), JSON.stringify(existing));
}

export function updateMeal(date: string, meal_id: string, patch: Partial<MealEntry>): void {
  if (typeof window === "undefined") return;
  const existing = getMealsForDate(date);
  const idx = existing.findIndex((m) => m.meal_id === meal_id);
  if (idx < 0) return;
  existing[idx] = { ...existing[idx], ...patch };
  localStorage.setItem(dateKey(date), JSON.stringify(existing));
}

export function deleteMeal(date: string, meal_id: string): void {
  if (typeof window === "undefined") return;
  const existing = getMealsForDate(date).filter((m) => m.meal_id !== meal_id);
  localStorage.setItem(dateKey(date), JSON.stringify(existing));
}

export function getUserProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_USER_PROFILE;
  const raw = localStorage.getItem("settings:user");
  if (!raw) return DEFAULT_USER_PROFILE;
  try {
    return { ...DEFAULT_USER_PROFILE, ...(JSON.parse(raw) as Partial<UserProfile>) };
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: Partial<UserProfile>): void {
  if (typeof window === "undefined") return;
  const current = getUserProfile();
  localStorage.setItem("settings:user", JSON.stringify({ ...current, ...profile }));
}

// Returns dates that have at least 1 meal logged, within the last N days
export function getLoggedDates(withinDays = 90): string[] {
  if (typeof window === "undefined") return [];
  const logged: string[] = [];
  for (let i = 0; i < withinDays; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const meals = getMealsForDate(dateStr);
    if (meals.length > 0) logged.push(dateStr);
  }
  return logged;
}

// How many days in the current Mon–Sun week have been logged (3+ meals = filled)
export function getWeekLoggedDays(weekDates: string[]): number {
  return weekDates.filter((d) => getMealsForDate(d).length >= 3).length;
}

// Gap in days since last logged meal (0 = today, -1 = never)
export function getDaysSinceLastLog(): number {
  const logged = getLoggedDates(180);
  if (logged.length === 0) return -1;
  const last = new Date(logged[0]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}
