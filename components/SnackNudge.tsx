"use client";
import { useState } from "react";
import { MealEntry } from "@/lib/types";

// Common South Indian afternoon snacks for quick-add chips
const QUICK_SNACKS = [
  "filter coffee",
  "tea",
  "murukku",
  "biscuits",
  "bajji",
  "vada",
  "sundal",
  "banana",
];

interface SnackNudgeProps {
  meals: MealEntry[];
  onQuickAdd: (foodName: string) => void;
  /** Force show for demo purposes regardless of time */
  forceShow?: boolean;
}

function isSnackNudgeTime(): boolean {
  // IST hour: show nudge between 3:30pm and 7:30pm
  const now = new Date();
  const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
  const istDate = new Date(istMs);
  const hour = istDate.getUTCHours();
  const minute = istDate.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= 15 * 60 + 30 && totalMinutes < 19 * 60 + 30; // 3:30pm – 7:30pm
}

export function SnackNudge({ meals, onQuickAdd, forceShow = false }: SnackNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [selectedSnacks, setSelectedSnacks] = useState<string[]>([]);

  const hasSnacks = meals.some((m) => m.meal_type === "snack");
  const inWindow = isSnackNudgeTime();
  const shouldShow = !dismissed && !hasSnacks && (inWindow || forceShow || demoOpen);

  // Outside the nudge window: show a small demo trigger link
  if (!shouldShow) {
    if (hasSnacks || dismissed) return null;
    if (!inWindow) {
      return (
        <div className="flex justify-center mt-1 mb-2">
          <button
            onClick={() => { setDemoOpen(true); setSelectedSnacks([]); }}
            className="text-xs rounded-full px-3 py-1.5 font-medium"
            style={{ color: "#C4633A", backgroundColor: "#f5ede5", border: "1px solid #e8d4c4" }}
          >
            Preview 4pm snack nudge
          </button>
        </div>
      );
    }
    return null;
  }

  const toggleSnack = (snack: string) => {
    setSelectedSnacks((prev) =>
      prev.includes(snack) ? prev.filter((s) => s !== snack) : [...prev, snack]
    );
  };

  const handleConfirm = () => {
    if (selectedSnacks.length === 0) return;
    onQuickAdd(selectedSnacks.join(" and "));
    setSelectedSnacks([]);
    if (!inWindow) setDemoOpen(false);
  };

  const handleDismiss = () => {
    // Only permanently dismiss during the real nudge window; just close the preview otherwise
    if (inWindow) setDismissed(true);
    setDemoOpen(false);
    setSelectedSnacks([]);
  };

  return (
    <div
      className="mx-4 mb-3 rounded-2xl px-4 py-3.5"
      style={{ backgroundColor: "#fff", border: "1.5px solid #f0e8de" }}
    >
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <p className="text-sm font-semibold" style={{ color: "#3D3D3D" }}>
            Around 4pm — anything?
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#3D3D3D", opacity: 0.5 }}>
            Tea, coffee, a bite? Tap to select.
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="text-lg leading-none ml-2 shrink-0"
          style={{ color: "#3D3D3D", opacity: 0.3 }}
          aria-label="Dismiss snack nudge"
        >
          ×
        </button>
      </div>

      {/* Multi-select chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_SNACKS.map((snack) => {
          const isSelected = selectedSnacks.includes(snack);
          return (
            <button
              key={snack}
              onClick={() => toggleSnack(snack)}
              className="rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors"
              style={{
                backgroundColor: isSelected ? "#C4633A" : "#f5ede5",
                color: isSelected ? "#fff" : "#C4633A",
                border: isSelected ? "1.5px solid #C4633A" : "1.5px solid #e8d4c4",
              }}
            >
              {snack}
            </button>
          );
        })}
        {/* Escape hatch for something not listed */}
        <button
          onClick={() => onQuickAdd("snack")}
          className="rounded-full px-3 py-1.5 text-sm font-medium"
          style={{
            backgroundColor: "#FBF7F0",
            color: "#3D3D3D",
            border: "1.5px dashed #e5e0d8",
            opacity: 0.7,
          }}
        >
          other…
        </button>
      </div>

      {/* Confirm button — appears once at least one snack is selected */}
      {selectedSnacks.length > 0 && (
        <div className="mt-3">
          <button
            onClick={handleConfirm}
            className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-opacity"
            style={{ backgroundColor: "#C4633A" }}
          >
            Log{" "}
            {selectedSnacks.length === 1
              ? selectedSnacks[0]
              : `${selectedSnacks.length} items`}
          </button>
        </div>
      )}
    </div>
  );
}
