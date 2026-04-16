"use client";
import { useState, useRef, useCallback } from "react";
import { MealItem, MealType, ParsedMeal } from "@/lib/types";
import { ChipEditor } from "@/components/ChipEditor";

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

const COMPLETENESS_LABELS: Record<string, string> = {
  approximate: "portions estimated",
  partial: "description incomplete",
  complete: "",
};

interface ConfirmationCardProps {
  parsedMeal: ParsedMeal;
  rawInput: string;
  items: MealItem[];
  mealType: MealType;
  contextNote: string;
  onMealTypeChange: (type: MealType) => void;
  onItemChange: (idx: number, updated: MealItem) => void;
  onItemRemove: (idx: number) => void;
  onAddItems: (newItems: MealItem[]) => void;
  onConfirm: () => void;
  onDismiss: () => void;
  onReparse: (newInput: string) => void;
  onContextNoteChange: (note: string) => void;
}

export function ConfirmationCard({
  parsedMeal,
  rawInput,
  items,
  mealType,
  contextNote,
  onMealTypeChange,
  onItemChange,
  onItemRemove,
  onAddItems,
  onConfirm,
  onDismiss,
  onReparse,
  onContextNoteChange,
}: ConfirmationCardProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editingInput, setEditingInput] = useState(false);
  const [editText, setEditText] = useState(rawInput);
  const editRef = useRef<HTMLInputElement>(null);

  // Add food state
  const [showAddFood, setShowAddFood] = useState(false);
  const [addFoodText, setAddFoodText] = useState("");
  const [addFoodLoading, setAddFoodLoading] = useState(false);
  const [isAddRecording, setIsAddRecording] = useState(false);
  const addRecognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const addFinalTranscriptRef = useRef<string>("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const handleChipSelect = (idx: number) => {
    setSelectedIdx((prev) => (prev === idx ? null : idx));
  };

  const handleEditSubmit = () => {
    const trimmed = editText.trim();
    if (trimmed) {
      onReparse(trimmed);
    }
    setEditingInput(false);
  };

  const handleAddFood = useCallback(async (text?: string) => {
    const trimmed = (text ?? addFoodText).trim();
    if (!trimmed) return;
    setAddFoodLoading(true);
    try {
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        onAddItems(data.items);
      }
      setAddFoodText("");
      setShowAddFood(false);
    } catch {
      // silently fail
    } finally {
      setAddFoodLoading(false);
    }
  }, [addFoodText, onAddItems]);

  const startAddVoice = useCallback(() => {
    const SpeechRecognitionImpl =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!SpeechRecognitionImpl) return;
    addFinalTranscriptRef.current = "";
    const rec = new SpeechRecognitionImpl();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-IN";
    rec.onresult = (e: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          addFinalTranscriptRef.current += e.results[i][0].transcript + " ";
        }
      }
    };
    rec.onerror = () => { setIsAddRecording(false); };
    rec.onend = () => {
      setIsAddRecording(false);
      const transcript = addFinalTranscriptRef.current.trim();
      addFinalTranscriptRef.current = "";
      if (transcript) {
        setAddFoodText(transcript);
        handleAddFood(transcript);
      }
    };
    addRecognitionRef.current = rec;
    rec.start();
    setIsAddRecording(true);
  }, [handleAddFood]);

  const stopAddVoice = useCallback(() => {
    if (addRecognitionRef.current) addRecognitionRef.current.stop();
  }, []);

  const contextLabel =
    parsedMeal.context && parsedMeal.context !== "home" && parsedMeal.context !== "unknown"
      ? parsedMeal.context.replace("_", " ")
      : null;

  // Food/nutrition question answer
  if (parsedMeal.food_answer) {
    return (
      <BottomSheet onDismiss={onDismiss}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#C4633A" }}>
          Food info
        </p>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#3D3D3D" }}>
          {parsedMeal.food_answer}
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded-2xl py-3 text-sm font-medium"
          style={{ backgroundColor: "#C4633A", color: "#fff" }}
        >
          Got it
        </button>
      </BottomSheet>
    );
  }

  // Behavioral response — show warm message, no chip editor
  if (parsedMeal.behavioral_response) {
    return (
      <BottomSheet onDismiss={onDismiss}>
        <p className="text-sm leading-relaxed mb-5" style={{ color: "#3D3D3D" }}>
          {parsedMeal.behavioral_response}
        </p>
        <button
          onClick={onDismiss}
          className="w-full rounded-2xl py-3 text-sm font-medium"
          style={{ backgroundColor: "#C4633A", color: "#fff" }}
        >
          Got it
        </button>
      </BottomSheet>
    );
  }

  if (parsedMeal.clarification_needed) {
    return (
      <BottomSheet onDismiss={onDismiss}>
        <p className="text-base font-medium mb-3" style={{ color: "#3D3D3D" }}>
          {parsedMeal.clarification_needed}
        </p>
        <input
          autoFocus
          type="text"
          placeholder="Your answer…"
          className="w-full rounded-xl px-4 py-3 text-base outline-none border-2"
          style={{ borderColor: "#C4633A", color: "#3D3D3D", backgroundColor: "#fff" }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const val = (e.target as HTMLInputElement).value.trim();
              if (val) onReparse(`${rawInput}. ${val}`);
            }
          }}
        />
      </BottomSheet>
    );
  }

  const completenessLabel = parsedMeal.completeness && parsedMeal.completeness !== "complete"
    ? COMPLETENESS_LABELS[parsedMeal.completeness]
    : null;

  return (
    <BottomSheet onDismiss={onDismiss}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {contextLabel && (
            <span
              className="text-xs rounded-full px-2 py-0.5 font-medium capitalize"
              style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}
            >
              {contextLabel}
            </span>
          )}
          {completenessLabel && (
            <span
              className="text-xs rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#fef3c7", color: "#92400e" }}
            >
              {completenessLabel}
            </span>
          )}
        </div>
        <button
          onClick={onDismiss}
          className="text-xl leading-none ml-2 shrink-0"
          style={{ color: "#3D3D3D", opacity: 0.4 }}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {/* Meal type selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {MEAL_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => onMealTypeChange(type)}
            className="rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors"
            style={{
              backgroundColor: mealType === type ? "#3D3D3D" : "#fff",
              color: mealType === type ? "#fff" : "#3D3D3D",
              border: "1.5px solid #e5e0d8",
            }}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Original input — tap to re-describe */}
      <div className="mb-4">
        {editingInput ? (
          <div className="flex gap-2">
            <input
              ref={editRef}
              autoFocus
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border-2"
              style={{ borderColor: "#C4633A", color: "#3D3D3D", backgroundColor: "#fff" }}
              onKeyDown={(e) => e.key === "Enter" && handleEditSubmit()}
            />
            <button
              onClick={handleEditSubmit}
              className="text-sm font-semibold px-3 shrink-0"
              style={{ color: "#C4633A" }}
            >
              Re-parse
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditText(rawInput);
              setEditingInput(true);
            }}
            className="text-sm text-left w-full rounded-xl px-3 py-2"
            style={{ backgroundColor: "#f5ede5", color: "#3D3D3D", opacity: 0.75 }}
          >
            &ldquo;{rawInput}&rdquo;
            <span className="ml-2 text-xs" style={{ color: "#C4633A" }}>
              edit
            </span>
          </button>
        )}
      </div>

      {/* Item chips */}
      <div className="flex flex-col gap-2 mb-3">
        {items.length === 0 ? (
          <p className="text-sm text-center py-4" style={{ color: "#3D3D3D", opacity: 0.5 }}>
            No items — tap edit above to re-describe
          </p>
        ) : (
          items.map((item, idx) => (
            <ChipEditor
              key={`${item.name}-${idx}`}
              item={item}
              isSelected={selectedIdx === idx}
              onSelect={() => handleChipSelect(idx)}
              onChange={(updated) => onItemChange(idx, updated)}
              onRemove={() => {
                onItemRemove(idx);
                setSelectedIdx(null);
              }}
            />
          ))
        )}
      </div>

      {/* Add missing food */}
      <div className="mb-4">
        {showAddFood ? (
          <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ backgroundColor: "#f5ede5" }}>
            <p className="text-xs font-medium" style={{ color: "#3D3D3D", opacity: 0.6 }}>
              Add a missing food
            </p>
            <div className="flex gap-2">
              {/* Voice button */}
              <button
                onMouseDown={(e) => { e.preventDefault(); startAddVoice(); }}
                onMouseUp={stopAddVoice}
                onTouchStart={(e) => { e.preventDefault(); startAddVoice(); }}
                onTouchEnd={(e) => { e.preventDefault(); stopAddVoice(); }}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors"
                style={{
                  backgroundColor: isAddRecording ? "#a84f2f" : "#C4633A",
                  boxShadow: isAddRecording ? "0 0 0 3px rgba(196,99,58,0.3)" : "none",
                }}
                title={isAddRecording ? "Recording…" : "Hold to speak"}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                  <line x1="12" y1="19" x2="12" y2="23" />
                  <line x1="8" y1="23" x2="16" y2="23" />
                </svg>
              </button>
              {/* Text input */}
              <input
                ref={addInputRef}
                autoFocus
                type="text"
                value={addFoodText}
                onChange={(e) => setAddFoodText(e.target.value)}
                placeholder={isAddRecording ? "Listening…" : "e.g. a cup of curd"}
                className="flex-1 rounded-xl px-3 py-2 text-sm outline-none border-2"
                style={{ borderColor: "#C4633A", color: "#3D3D3D", backgroundColor: "#fff" }}
                onKeyDown={(e) => e.key === "Enter" && !addFoodLoading && handleAddFood()}
                disabled={isAddRecording || addFoodLoading}
              />
              <button
                onClick={() => handleAddFood()}
                disabled={addFoodLoading || (!addFoodText.trim() && !isAddRecording)}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-white shrink-0"
                style={{
                  backgroundColor: "#C4633A",
                  opacity: addFoodLoading || (!addFoodText.trim() && !isAddRecording) ? 0.4 : 1,
                }}
              >
                {addFoodLoading ? "…" : "Add"}
              </button>
              <button
                onClick={() => { setShowAddFood(false); setAddFoodText(""); }}
                className="text-sm px-1 shrink-0"
                style={{ color: "#3D3D3D", opacity: 0.4 }}
              >
                ×
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAddFood(true)}
            className="w-full rounded-xl py-2 text-sm font-medium flex items-center justify-center gap-1.5"
            style={{ border: "1.5px dashed #e5e0d8", color: "#C4633A", backgroundColor: "transparent" }}
          >
            + Add a missing food
          </button>
        )}
      </div>

      {/* Optional context note */}
      <div className="mb-4">
        <input
          type="text"
          value={contextNote}
          onChange={(e) => onContextNoteChange(e.target.value)}
          placeholder="Anything worth noting? (e.g. eating at a wedding, MIL cooking this week)"
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border-0"
          style={{
            backgroundColor: "#f5ede5",
            color: "#3D3D3D",
            caretColor: "#C4633A",
          }}
        />
      </div>

      {/* Confirm */}
      <button
        onClick={onConfirm}
        disabled={items.length === 0}
        className="w-full rounded-2xl py-4 font-semibold text-white text-base transition-opacity"
        style={{ backgroundColor: "#C4633A", opacity: items.length === 0 ? 0.5 : 1 }}
      >
        Confirm
      </button>
    </BottomSheet>
  );
}

function BottomSheet({
  children,
  onDismiss,
}: {
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
        onClick={onDismiss}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl p-6 slide-up"
        style={{
          backgroundColor: "#FBF7F0",
          maxWidth: 448,
          left: "50%",
          transform: "translateX(-50%)",
          maxHeight: "85vh",
          overflowY: "auto",
        }}
      >
        <div
          className="w-10 h-1 rounded-full mx-auto mb-5"
          style={{ backgroundColor: "#e5e0d8" }}
        />
        {children}
      </div>
    </>
  );
}
