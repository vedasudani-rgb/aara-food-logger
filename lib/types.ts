export type ItemCategory =
  | "grain"
  | "protein"
  | "vegetable"
  | "fat"
  | "dairy"
  | "beverage"
  | "snack"
  | "dessert";

export type ProteinLevel = "low" | "medium" | "high" | "unknown";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";

export type MealContext =
  | "home"
  | "restaurant"
  | "social_occasion"
  | "festival"
  | "travel"
  | "unknown";

export type CaloriesConfidence = "low" | "medium" | "high";

export type Completeness = "complete" | "approximate" | "partial";

export type QuantityCertainty =
  | "shared_bowl"
  | "self_reported"
  | "estimated";

export interface MealItem {
  name: string;
  quantity: string;
  confidence: number;
  inferred: boolean;
  category: ItemCategory;
  protein_level: ProteinLevel;
  calories_estimate: number;
  calories_range: [number, number];
  edited_by_user?: boolean;
}

export interface MealEntry {
  meal_id: string;
  timestamp_logged: string; // ISO8601 +05:30
  timestamp_meal: string;
  logged_late: boolean;
  raw_input: string;
  input_modality: "voice" | "text";
  meal_type: MealType;
  context: MealContext;
  items: MealItem[];
  meal_calories_estimate: number;
  meal_calories_range: [number, number];
  calories_confidence: CaloriesConfidence;
  completeness: Completeness;
  quantity_certainty: QuantityCertainty;
  edited_by_user: boolean;
}

export interface UserProfile {
  meal_slots: MealType[];
  slot_times: Record<string, { start: string; end: string }>;
  snack_prompt_enabled: boolean;
  snack_prompt_time: string;
}

export interface CoachProfile {
  password: string;
}

// Returned from /api/parse-meal before we wrap into a full MealEntry
export interface ParsedMeal {
  items: MealItem[];
  meal_type: MealType | "unknown";
  context: MealContext;
  completeness: Completeness;
  meal_calories_estimate: number;
  meal_calories_range: [number, number];
  calories_confidence: CaloriesConfidence;
  clarification_needed: string | null;
  time_hint?: string | null;     // "HH:MM" in 24h if a time was mentioned in the log, e.g. "09:00"
  behavioral_response?: string; // set when user asks "how am I doing?" type questions
  food_answer?: string;          // set when user asks a food/nutrition question
}
