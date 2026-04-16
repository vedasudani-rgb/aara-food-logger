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

export function SnackNudge({ meals, onQuickAdd }: SnackNudgeProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedSnacks, setSelectedSnacks] = useState<string[]>([]);

  const hasSnacks = meals.some((m) => m.meal_type === "snack");
  const inWindow = isSnackNudgeTime();

  // Never show if snacks already logged
  if (hasSnacks) return null;
  // During the real window, hide after permanent dismiss
  if (inWindow && dismissed) return null;

  // Outside window: only show as a preview pill (always visible for demo)
  // Inside window: always show the collapsed pill
  const isPreview = !inWindow;

  const toggleSnack = (snack: string) => {
    setSelectedSnacks((prev) =>
      prev.includes(snack) ? prev.filter((s) => s !== snack) : [...prev, snack]
    );
  };

  const handleConfirm = () => {
    if (selectedSnacks.length === 0) return;
    onQuickAdd(selectedSnacks.join(" and "));
    setSelectedSnacks([]);
    setExpanded(false);
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (inWindow) setDismissed(true);
    setExpanded(false);
    setSelectedSnacks([]);
  };

  return (
    <div
      className="mx-4 mb-3 rounded-2xl overflow-hidden"
      style={{ backgroundColor: "#f5ede5", border: "1px solid #e8d4c4" }}
    >
      {/* Collapsed header — always visible, click to expand */}
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-2.5"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium" style={{ color: "#C4633A" }}>
          {isPreview ? "Preview 4pm snack nudge" : "Around 4pm — anything?"}
        </span>
        <span className="text-xs font-bold" style={{ color: "#C4633A", opacity: 0.6 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-3.5">
          <p className="text-xs mb-2.5" style={{ color: "#3D3D3D", opacity: 0.5 }}>
            Tea, coffee, a bite? Tap to select.
          </p>

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
                    backgroundColor: isSelected ? "#C4633A" : "#fff",
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
              onClick={() => { onQuickAdd("snack"); setExpanded(false); }}
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

          {/* Dismiss / close row */}
          <div className="mt-2 flex justify-end">
            <button
              onClick={handleDismiss}
              className="text-xs"
              style={{ color: "#3D3D3D", opacity: 0.4 }}
            >
              {inWindow ? "Not now" : "Close"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
