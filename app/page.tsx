"use client";
import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { MealEntry, MealItem, MealType, ParsedMeal } from "@/lib/types";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useMealLog, todayIST, nowIST } from "@/hooks/useMealLog";
import { getDaysSinceLastLog } from "@/lib/storage";
import { seedMockData } from "@/lib/seedData";
import { VoiceLogButton } from "@/components/VoiceLogButton";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { MealTimeline } from "@/components/MealTimeline";
import { NutritionWizard } from "@/components/NutritionWizard";
import { SnackNudge } from "@/components/SnackNudge";
import { dateToISOWeek } from "@/lib/dates";

function inferMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 12 && hour < 16) return "lunch";
  if (hour >= 19 && hour < 23) return "dinner";
  return "snack";
}

// Infer meal type from a "HH:MM" time string (24h)
function inferMealTypeFromTime(hhmm: string): MealType {
  const hour = parseInt(hhmm.split(":")[0], 10);
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 16) return "lunch";
  if (hour >= 19 && hour < 23) return "dinner";
  return "snack";
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function HomePage() {
  const date = todayIST();
  const weekStr = dateToISOWeek(date);
  const { meals, saveMeal, updateMeal, deleteMeal } = useMealLog(date);

  const [isLoading, setIsLoading] = useState(false);
  const [parsedMeal, setParsedMeal] = useState<ParsedMeal | null>(null);
  const [editedItems, setEditedItems] = useState<MealItem[]>([]);
  const [rawInput, setRawInput] = useState("");
  const [pendingMealType, setPendingMealType] = useState<MealType>(inferMealType);
  const [slotTapped, setSlotTapped] = useState(false);
  const [reengagementMsg, setReengagementMsg] = useState<string | null>(null);

  // Seed mock data on first load
  useEffect(() => {
    seedMockData();
  }, []);

  useEffect(() => {
    const gap = getDaysSinceLastLog();
    if (gap >= 4) {
      fetch("/api/reengagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gap_days: gap }),
      })
        .then((r) => r.json())
        .then((d) => setReengagementMsg(d.message ?? null))
        .catch(() => null);
    }
  }, []);

  const handleTranscript = useCallback(async (text: string) => {
    setRawInput(text);
    setIsLoading(true);
    setParsedMeal(null);

    try {
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data: ParsedMeal = await res.json();

      // Food/behavioral answers belong in the Ask Aara wizard, not the log flow
      if (data.food_answer || data.behavioral_response) return;

      // Use the parsed meal type from the API if the user didn't tap a specific slot
      // e.g. "for lunch I had..." → meal_type: "lunch"
      // Also infer from time_hint if meal_type isn't explicit
      if (!slotTapped) {
        if (data.meal_type && data.meal_type !== "unknown") {
          setPendingMealType(data.meal_type as MealType);
        } else if (data.time_hint) {
          setPendingMealType(inferMealTypeFromTime(data.time_hint));
        }
      }

      setParsedMeal(data);
      setEditedItems(Array.isArray(data.items) ? [...data.items] : []);
      setSlotTapped(false);
    } catch {
      // silently fail — user can retype
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { isRecording, inputMode, startRecording, stopRecording, switchToText, setInputMode } =
    useVoiceInput({ onTranscript: handleTranscript });

  // Slot tap: set target meal type — stay in voice mode, just show indicator
  const handleAddMeal = useCallback(
    (mealType?: MealType) => {
      setPendingMealType(mealType ?? inferMealType());
      setSlotTapped(true);
    },
    []
  );

  const handleItemChange = (idx: number, updated: MealItem) => {
    setEditedItems((prev) => prev.map((item, i) => (i === idx ? updated : item)));
  };

  const handleItemRemove = (idx: number) => {
    setEditedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (!parsedMeal) return;
    const ts = nowIST();

    // If the log mentioned a specific time, back-date timestamp_meal to that time today
    let mealTimestamp = ts;
    if (parsedMeal.time_hint) {
      mealTimestamp = `${date}T${parsedMeal.time_hint}:00+05:30`;
    }

    const entry: MealEntry = {
      meal_id: uuidv4(),
      timestamp_logged: ts,
      timestamp_meal: mealTimestamp,
      logged_late: parsedMeal.time_hint != null && mealTimestamp < ts,
      raw_input: rawInput,
      input_modality: inputMode === "voice" ? "voice" : "text",
      meal_type: pendingMealType,
      context: parsedMeal.context,
      items: editedItems,
      meal_calories_estimate: editedItems.reduce((s, i) => s + i.calories_estimate, 0),
      meal_calories_range: [
        editedItems.reduce((s, i) => s + i.calories_range[0], 0),
        editedItems.reduce((s, i) => s + i.calories_range[1], 0),
      ],
      calories_confidence: parsedMeal.calories_confidence,
      completeness: parsedMeal.completeness,
      quantity_certainty: editedItems.some((i) => i.edited_by_user)
        ? "self_reported"
        : "estimated",
      edited_by_user: editedItems.some((i) => i.edited_by_user),
    };

    saveMeal(entry);
    setParsedMeal(null);
    setEditedItems([]);
    setRawInput("");
    setReengagementMsg(null);
    setSlotTapped(false);
    setPendingMealType(inferMealType());
  };

  const handleDismiss = () => {
    setParsedMeal(null);
    setEditedItems([]);
    setSlotTapped(false);
    setPendingMealType(inferMealType());
  };

  const handleReparse = useCallback(async (newInput: string) => {
    setParsedMeal(null);
    setRawInput(newInput);
    setIsLoading(true);

    try {
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: newInput }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data: ParsedMeal = await res.json();
      setParsedMeal(data);
      setEditedItems([...data.items]);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleUpdateMeal = useCallback(
    (meal_id: string, items: MealItem[]) => {
      updateMeal(meal_id, {
        items,
        meal_calories_estimate: items.reduce((s, i) => s + i.calories_estimate, 0),
        meal_calories_range: [
          items.reduce((s, i) => s + i.calories_range[0], 0),
          items.reduce((s, i) => s + i.calories_range[1], 0),
        ],
        edited_by_user: true,
        quantity_certainty: "self_reported",
      });
    },
    [updateMeal]
  );

  const handleMoveMealType = useCallback(
    (meal_id: string, newType: MealType) => {
      const now = nowIST();
      updateMeal(meal_id, { meal_type: newType, timestamp_logged: now, timestamp_meal: now });
    },
    [updateMeal]
  );

  const handleAddItems = useCallback((newItems: MealItem[]) => {
    setEditedItems((prev) => [...prev, ...newItems]);
  }, []);

  const handleUpdateMealTimestamp = useCallback(
    (meal_id: string, newTimestamp: string) => {
      updateMeal(meal_id, { timestamp_logged: newTimestamp, timestamp_meal: newTimestamp });
    },
    [updateMeal]
  );

  // Snack nudge: quick-add a named snack through the normal confirm flow
  const handleSnackQuickAdd = useCallback(async (foodName: string) => {
    setPendingMealType("snack");
    setIsLoading(true);
    setParsedMeal(null);
    try {
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: foodName }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data = await res.json();
      if (data.food_answer || data.behavioral_response) return;
      setRawInput(foodName);
      setParsedMeal({ ...data, meal_type: "snack" });
      setEditedItems([...data.items]);
    } catch {
      // silently fail
    } finally {
      setIsLoading(false);
    }
  }, []);

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FBF7F0" }}>
      {/* Header */}
      <header className="px-5 pt-8 pb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest" style={{ color: "#C4633A" }}>
            Aara · Megha&apos;s journal
          </p>
          <h1 className="text-xl font-semibold mt-0.5" style={{ color: "#3D3D3D" }}>
            {formatDate(date)}
          </h1>
          <p className="text-xs mt-1" style={{ color: "#3D3D3D", opacity: 0.45 }}>
            {meals.length > 0
              ? `${meals.length} meal${meals.length !== 1 ? "s" : ""} logged today`
              : "What are you having today?"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <a
            href="/coach"
            className="text-xs rounded-full px-3 py-1.5 font-medium"
            style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}
          >
            Coach view
          </a>
          <a
            href={`/week/${weekStr}`}
            className="text-xs rounded-full px-3 py-1.5 font-medium"
            style={{ backgroundColor: "#fff", color: "#3D3D3D", border: "1.5px solid #e5e0d8" }}
          >
            Week view
          </a>
        </div>
      </header>

      {/* Re-engagement message */}
      {reengagementMsg && (
        <div
          className="mx-5 mb-2 px-4 py-3 rounded-2xl text-sm"
          style={{ backgroundColor: "#f5ede5", color: "#3D3D3D" }}
        >
          {reengagementMsg}
        </div>
      )}

      {/* Slot indicator — shown when user tapped a slot */}
      {slotTapped && (
        <div
          className="mx-5 mb-1 px-3 py-2 rounded-xl text-xs font-medium capitalize flex items-center gap-2"
          style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}
        >
          <span>Adding to: {pendingMealType}</span>
          <button
            onClick={() => {
              setSlotTapped(false);
              setPendingMealType(inferMealType());
            }}
            className="ml-auto opacity-60 hover:opacity-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Snack nudge — appears ~4pm if no snacks logged */}
      <SnackNudge meals={meals} onQuickAdd={handleSnackQuickAdd} />

      {/* Timeline */}
      <div className="flex-1 px-4 overflow-y-auto">
        <MealTimeline
          meals={meals}
          onAddMeal={handleAddMeal}
          onDeleteMeal={deleteMeal}
          onUpdateMeal={handleUpdateMeal}
          onMoveMealType={handleMoveMealType}
          onUpdateMealTimestamp={handleUpdateMealTimestamp}
        />
      </div>

      {/* Sticky input bar */}
      <div
        className="sticky bottom-0 py-6 flex flex-col items-center gap-2"
        style={{ backgroundColor: "#FBF7F0", borderTop: "1px solid #f0e8de" }}
      >
        <VoiceLogButton
          isRecording={isRecording}
          isLoading={isLoading}
          inputMode={inputMode}
          onPressStart={startRecording}
          onPressEnd={stopRecording}
          onTextSubmit={handleTranscript}
          onSwitchToVoice={() => {
            setInputMode("voice");
            // Only reset meal type if the user hasn't tapped a specific slot
            if (!slotTapped) setPendingMealType(inferMealType());
          }}
          onSwitchToText={() => setInputMode("text")}
        />
      </div>

      {/* Confirmation card */}
      {parsedMeal && (
        <ConfirmationCard
          parsedMeal={parsedMeal}
          rawInput={rawInput}
          items={editedItems}
          mealType={pendingMealType}
          onMealTypeChange={setPendingMealType}
          onItemChange={handleItemChange}
          onItemRemove={handleItemRemove}
          onAddItems={handleAddItems}
          onConfirm={handleConfirm}
          onDismiss={handleDismiss}
          onReparse={handleReparse}
        />
      )}

      {/* Floating Ask Aara wizard */}
      <NutritionWizard />
    </div>
  );
}
