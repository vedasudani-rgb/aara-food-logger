"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { v4 as uuidv4 } from "uuid";
import { MealEntry, MealItem, MealType, ParsedMeal } from "@/lib/types";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useMealLog, todayIST, nowIST } from "@/hooks/useMealLog";
import { VoiceLogButton } from "@/components/VoiceLogButton";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { MealTimeline } from "@/components/MealTimeline";
import { NutritionWizard } from "@/components/NutritionWizard";
import { dateToISOWeek } from "@/lib/dates";

function inferMealType(): MealType {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return "breakfast";
  if (hour >= 12 && hour < 16) return "lunch";
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

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function prevDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

function nextDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

// ── Page entry point ─────────────────────────────────────────────────────────

export default function DayPage() {
  const params = useParams();
  const dateParam = params?.date as string;
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(dateParam ?? "");

  if (!isValidDate) return <RedirectHome />;
  return <DayView date={dateParam} />;
}

function RedirectHome() {
  const router = useRouter();
  useEffect(() => { router.replace("/"); }, [router]);
  return null;
}

// ── Day view ─────────────────────────────────────────────────────────────────

function DayView({ date }: { date: string }) {
  const today = todayIST();
  const isToday = date === today;
  const isFuture = date > today;
  const isPast = date < today;

  const { meals, saveMeal, updateMeal, deleteMeal } = useMealLog(date);

  const [isLoading, setIsLoading] = useState(false);
  const [parsedMeal, setParsedMeal] = useState<ParsedMeal | null>(null);
  const [editedItems, setEditedItems] = useState<MealItem[]>([]);
  const [rawInput, setRawInput] = useState("");
  const [pendingMealType, setPendingMealType] = useState<MealType>(inferMealType);

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
      setParsedMeal(data);
      setEditedItems(Array.isArray(data.items) ? [...data.items] : []);
      // Use the parsed meal type from the API (e.g. "for lunch I had...")
      if (data.meal_type && data.meal_type !== "unknown") {
        setPendingMealType(data.meal_type as MealType);
      }
    } catch {
      // silently fail — user can retype
    } finally {
      setIsLoading(false);
    }
  }, []);

  const { isRecording, inputMode, startRecording, stopRecording, setInputMode } =
    useVoiceInput({ onTranscript: handleTranscript });

  const handleAddMeal = useCallback((mealType?: MealType) => {
    setPendingMealType(mealType ?? inferMealType());
  }, []);

  const handleItemChange = (idx: number, updated: MealItem) => {
    setEditedItems((prev) => prev.map((item, i) => (i === idx ? updated : item)));
  };

  const handleItemRemove = (idx: number) => {
    setEditedItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    if (!parsedMeal) return;
    const ts = nowIST();
    const entry: MealEntry = {
      meal_id: uuidv4(),
      timestamp_logged: ts,
      timestamp_meal: ts,
      logged_late: isPast,
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
    setPendingMealType(inferMealType());
  };

  const handleDismiss = () => {
    setParsedMeal(null);
    setEditedItems([]);
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
      if (data.food_answer || data.behavioral_response) return;
      setParsedMeal(data);
      setEditedItems(Array.isArray(data.items) ? [...data.items] : []);
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

  const weekStr = dateToISOWeek(date);
  const nextDay = nextDate(date);
  const canGoForward = nextDay <= today;

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "#FBF7F0" }}>
      {/* Header */}
      <header className="px-5 pt-8 pb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "#C4633A" }}
            >
              Aara ·{" "}
              {isToday ? "Today" : isPast ? "Past entry" : "Future"}
            </p>
            <h1 className="text-xl font-semibold mt-0.5" style={{ color: "#3D3D3D" }}>
              {formatDate(date)}
            </h1>
            <p className="text-xs mt-1" style={{ color: "#3D3D3D", opacity: 0.45 }}>
              {meals.length > 0
                ? `${meals.length} meal${meals.length !== 1 ? "s" : ""} logged`
                : isFuture
                ? "No meals yet"
                : "Nothing logged"}
            </p>
          </div>
          {/* Top-right shortcuts */}
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

        {/* Date navigation */}
        <div className="flex items-center justify-between">
          <Link
            href={`/day/${prevDate(date)}`}
            className="rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ backgroundColor: "#fff", color: "#3D3D3D", border: "1.5px solid #e5e0d8" }}
          >
            ←
          </Link>

          <Link
            href={`/week/${weekStr}`}
            className="text-xs font-medium"
            style={{ color: "#C4633A", opacity: 0.65 }}
          >
            Week view
          </Link>

          {canGoForward ? (
            <Link
              href={`/day/${nextDay}`}
              className="rounded-full px-3 py-1.5 text-sm font-medium"
              style={{ backgroundColor: "#fff", color: "#3D3D3D", border: "1.5px solid #e5e0d8" }}
            >
              →
            </Link>
          ) : (
            <span
              className="rounded-full px-3 py-1.5 text-sm"
              style={{
                backgroundColor: "#f0e8de",
                color: "#3D3D3D",
                opacity: 0.35,
                cursor: "not-allowed",
              }}
            >
              →
            </span>
          )}
        </div>
      </header>

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

      {/* Input bar — hidden for future dates */}
      {!isFuture && (
        <div
          className="sticky bottom-0 py-6 flex flex-col items-center gap-2"
          style={{ backgroundColor: "#FBF7F0", borderTop: "1px solid #f0e8de" }}
        >
          {isPast && (
            <p className="text-xs" style={{ color: "#3D3D3D", opacity: 0.4 }}>
              Adding to {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
            </p>
          )}
          <VoiceLogButton
            isRecording={isRecording}
            isLoading={isLoading}
            inputMode={inputMode}
            onPressStart={startRecording}
            onPressEnd={stopRecording}
            onTextSubmit={handleTranscript}
            onSwitchToVoice={() => setInputMode("voice")}
            onSwitchToText={() => setInputMode("text")}
          />
        </div>
      )}

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
