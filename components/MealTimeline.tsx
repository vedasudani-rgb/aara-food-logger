"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { MealEntry, MealItem, MealType } from "@/lib/types";
import { ChipEditor } from "@/components/ChipEditor";

const SLOTS: { type: MealType; label: string; time: string }[] = [
  { type: "breakfast", label: "Breakfast", time: "6 – 11 am" },
  { type: "lunch", label: "Lunch", time: "12 – 4 pm" },
  { type: "dinner", label: "Dinner", time: "7 – 11 pm" },
];

const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

interface MealTimelineProps {
  meals: MealEntry[];
  onAddMeal: (mealType?: MealType) => void;
  onDeleteMeal: (meal_id: string) => void;
  onUpdateMeal: (meal_id: string, items: MealItem[]) => void;
  onMoveMealType: (meal_id: string, newType: MealType) => void;
  onUpdateMealTimestamp: (meal_id: string, newTimestamp: string) => void;
  onUpdateContextNote: (meal_id: string, note: string) => void;
}

export function MealTimeline({ meals, onAddMeal, onDeleteMeal, onUpdateMeal, onMoveMealType, onUpdateMealTimestamp, onUpdateContextNote }: MealTimelineProps) {
  const [detailMeal, setDetailMeal] = useState<MealEntry | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<MealType | null>(null);

  const byType = (type: MealType) => meals.filter((m) => m.meal_type === type);
  const snacks = meals.filter((m) => m.meal_type === "snack");

  // Sync detailMeal if meals update (e.g. after edit or move)
  const currentDetailMeal = detailMeal
    ? meals.find((m) => m.meal_id === detailMeal.meal_id) ?? null
    : null;

  const handleDrop = useCallback((e: React.DragEvent, slotType: MealType) => {
    e.preventDefault();
    const meal_id = e.dataTransfer.getData("meal_id");
    if (meal_id) {
      onMoveMealType(meal_id, slotType);
    }
    setDragOverSlot(null);
  }, [onMoveMealType]);

  return (
    <>
      <div className="flex flex-col gap-3 pb-4">
        {SLOTS.map((slot) => (
          <MealSlot
            key={slot.type}
            label={slot.label}
            time={slot.time}
            slotType={slot.type}
            entries={byType(slot.type)}
            isDragOver={dragOverSlot === slot.type}
            onAdd={() => onAddMeal(slot.type)}
            onSelect={setDetailMeal}
            onDragOver={(e) => { e.preventDefault(); setDragOverSlot(slot.type); }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => handleDrop(e, slot.type)}
          />
        ))}

        {snacks.length > 0 && (
          <div
            className="flex flex-col gap-2"
            onDragOver={(e) => { e.preventDefault(); setDragOverSlot("snack"); }}
            onDragLeave={() => setDragOverSlot(null)}
            onDrop={(e) => handleDrop(e, "snack")}
          >
            <span
              className="text-xs font-semibold uppercase tracking-wide px-1"
              style={{ color: "#3D3D3D", opacity: 0.4 }}
            >
              Snacks
            </span>
            {snacks.map((entry) => (
              <MealCard
                key={entry.meal_id}
                entry={entry}
                onSelect={() => setDetailMeal(entry)}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => onAddMeal("snack")}
          className="self-center flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium mt-1 transition-opacity hover:opacity-80"
          style={{ backgroundColor: "#fff", color: "#C4633A", border: "1.5px solid #e5e0d8" }}
        >
          <span className="text-base leading-none">+</span>
          add snack
        </button>
      </div>

      {/* Meal detail / edit sheet */}
      {currentDetailMeal && (
        <MealDetailSheet
          entry={currentDetailMeal}
          onDelete={() => {
            onDeleteMeal(currentDetailMeal.meal_id);
            setDetailMeal(null);
          }}
          onUpdate={(items) => onUpdateMeal(currentDetailMeal.meal_id, items)}
          onMoveMealType={(newType) => onMoveMealType(currentDetailMeal.meal_id, newType)}
          onUpdateTimestamp={(newTs) => onUpdateMealTimestamp(currentDetailMeal.meal_id, newTs)}
          onUpdateContextNote={(note) => onUpdateContextNote(currentDetailMeal.meal_id, note)}
          onDismiss={() => setDetailMeal(null)}
        />
      )}
    </>
  );
}

// ---- MealSlot ----

interface MealSlotProps {
  label: string;
  time: string;
  slotType: MealType;
  entries: MealEntry[];
  isDragOver: boolean;
  onAdd: () => void;
  onSelect: (entry: MealEntry) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}

function MealSlot({ label, time, entries, isDragOver, onAdd, onSelect, onDragOver, onDragLeave, onDrop }: MealSlotProps) {
  return (
    <div
      className="rounded-2xl p-4 transition-colors"
      style={{
        backgroundColor: isDragOver ? "#f5ede5" : "#fff",
        border: isDragOver ? "2px dashed #C4633A" : "1px solid #f0e8de",
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-sm" style={{ color: "#3D3D3D" }}>
            {label}
          </span>
          <span className="text-xs ml-2" style={{ color: "#3D3D3D", opacity: 0.4 }}>
            {time}
          </span>
        </div>
        <button
          onClick={onAdd}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold"
          style={{ backgroundColor: "#C4633A" }}
          aria-label={`Add ${label}`}
        >
          +
        </button>
      </div>

      {isDragOver && entries.length === 0 && (
        <div
          className="w-full rounded-xl py-3 text-sm text-center"
          style={{ backgroundColor: "#f5ede5", color: "#C4633A", opacity: 0.7, border: "1.5px dashed #C4633A" }}
        >
          Drop here to move
        </div>
      )}

      {!isDragOver && entries.length === 0 && (
        <button
          onClick={onAdd}
          className="w-full rounded-xl py-3 text-sm text-center"
          style={{
            backgroundColor: "#FBF7F0",
            color: "#3D3D3D",
            opacity: 0.45,
            border: "1.5px dashed #e5e0d8",
          }}
        >
          Tell me what you had
        </button>
      )}

      {entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <MealCard
              key={entry.meal_id}
              entry={entry}
              onSelect={() => onSelect(entry)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---- MealCard ----

function MealCard({ entry, onSelect }: { entry: MealEntry; onSelect: () => void }) {
  const time = formatTime(entry.timestamp_logged);
  const itemNames = entry.items.map((i) => i.name).join(" · ");
  const contextBadge =
    entry.context !== "home" && entry.context !== "unknown"
      ? entry.context.replace("_", " ")
      : null;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("meal_id", entry.meal_id);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className="rounded-xl px-3 py-2.5 text-left w-full cursor-grab active:cursor-grabbing"
      style={{ backgroundColor: "#FBF7F0" }}
    >
      <div className="flex items-center gap-2 mb-0.5">
        <span className="text-xs" style={{ color: "#3D3D3D", opacity: 0.45 }}>
          {time}
        </span>
        {entry.logged_late && (
          <span className="text-xs" style={{ color: "#3D3D3D", opacity: 0.35 }}>
            logged late
          </span>
        )}
        {contextBadge && (
          <span
            className="text-xs rounded-full px-2 py-0.5 capitalize"
            style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}
          >
            {contextBadge}
          </span>
        )}
        {/* Drag handle hint */}
        <span className="text-xs ml-auto select-none" style={{ color: "#3D3D3D", opacity: 0.2 }}>
          ⠿
        </span>
        <button
          onClick={onSelect}
          className="text-xs"
          style={{ color: "#C4633A", opacity: 0.6 }}
        >
          details →
        </button>
      </div>
      <button onClick={onSelect} className="w-full text-left">
        <p className="text-sm truncate" style={{ color: "#3D3D3D" }}>
          {itemNames || entry.raw_input}
        </p>
        <ProteinDots items={entry.items} />
      </button>
    </div>
  );
}

// ---- Meal Detail / Edit Sheet ----

function MealDetailSheet({
  entry,
  onDelete,
  onUpdate,
  onMoveMealType,
  onUpdateTimestamp,
  onUpdateContextNote,
  onDismiss,
}: {
  entry: MealEntry;
  onDelete: () => void;
  onUpdate: (items: MealItem[]) => void;
  onMoveMealType: (newType: MealType) => void;
  onUpdateTimestamp: (newTimestamp: string) => void;
  onUpdateContextNote: (note: string) => void;
  onDismiss: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<MealItem[]>([...entry.items]);
  const [contextNote, setContextNote] = useState(entry.context_note ?? "");

  // Keep contextNote in sync if entry.context_note changes externally
  useEffect(() => {
    setContextNote(entry.context_note ?? "");
  }, [entry.context_note]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [addingFood, setAddingFood] = useState(false);
  const [addFoodText, setAddFoodText] = useState("");
  const [isParsingAdd, setIsParsingAdd] = useState(false);
  const [isAddRecording, setIsAddRecording] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
  const [editedTime, setEditedTime] = useState(() => extractTimeHHMM(entry.timestamp_logged));
  const addRecognitionRef = useRef<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
  const addFinalTranscriptRef = useRef<string>("");

  const handleSave = () => {
    onUpdate(editedItems);
    setEditing(false);
    setSelectedIdx(null);
    setAddingFood(false);
    setAddFoodText("");
  };

  const handleCancelEdit = () => {
    setEditedItems([...entry.items]);
    setEditing(false);
    setSelectedIdx(null);
    setAddingFood(false);
    setAddFoodText("");
  };

  const handleAddFood = async (text?: string) => {
    const trimmed = (text ?? addFoodText).trim();
    if (!trimmed) return;
    setIsParsingAdd(true);
    try {
      const res = await fetch("/api/parse-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: trimmed }),
      });
      if (!res.ok) throw new Error("parse failed");
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        // Merge with current editedItems and auto-save immediately so the
        // food appears in the log without needing a separate "Save changes" click.
        const merged = [...editedItems, ...data.items];
        setEditedItems(merged);
        onUpdate(merged);
      }
      setAddFoodText("");
      setAddingFood(false);
    } catch {
      // silently fail
    } finally {
      setIsParsingAdd(false);
    }
  };

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopAddVoice = useCallback(() => {
    if (addRecognitionRef.current) addRecognitionRef.current.stop();
  }, []);

  const contextLabel =
    entry.context !== "home" && entry.context !== "unknown"
      ? entry.context.replace("_", " ")
      : null;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
        onClick={editing ? undefined : onDismiss}
      />
      <div
        className="fixed bottom-0 z-50 rounded-t-3xl p-6 slide-up"
        style={{
          backgroundColor: "#FBF7F0",
          maxWidth: 448,
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
      >
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ backgroundColor: "#e5e0d8" }} />

        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-base" style={{ color: "#3D3D3D" }}>
              {editing ? "Edit entry" : "Meal details"}
            </h3>
            {contextLabel && (
              <span
                className="text-xs rounded-full px-2 py-0.5 capitalize"
                style={{ backgroundColor: "#f5ede5", color: "#C4633A" }}
              >
                {contextLabel}
              </span>
            )}
          </div>
          {!editing && (
            <button onClick={onDismiss} style={{ color: "#3D3D3D", opacity: 0.4, fontSize: 20 }}>
              ×
            </button>
          )}
        </div>

        {/* Editable timestamp */}
        <div className="flex items-center gap-2 mb-3">
          {editingTime ? (
            <>
              <input
                type="time"
                value={editedTime}
                onChange={(e) => setEditedTime(e.target.value)}
                className="rounded-lg px-2 py-1 text-xs outline-none border-2"
                style={{ borderColor: "#C4633A", color: "#3D3D3D", backgroundColor: "#fff" }}
              />
              <button
                onClick={() => {
                  onUpdateTimestamp(replaceTimeInISO(entry.timestamp_logged, editedTime));
                  setEditingTime(false);
                }}
                className="text-xs font-semibold"
                style={{ color: "#C4633A" }}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditedTime(extractTimeHHMM(entry.timestamp_logged));
                  setEditingTime(false);
                }}
                className="text-xs"
                style={{ color: "#3D3D3D", opacity: 0.4 }}
              >
                ×
              </button>
            </>
          ) : (
            <button
              onClick={() => { setEditedTime(extractTimeHHMM(entry.timestamp_logged)); setEditingTime(true); }}
              className="flex items-center gap-1.5 group"
            >
              <span className="text-xs" style={{ color: "#3D3D3D", opacity: 0.4 }}>
                {formatTime(entry.timestamp_logged)}
              </span>
              <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#C4633A" }}>
                edit time
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#C4633A" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0.5 }}>
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
        </div>

        {/* Meal type selector — always visible, current type auto-selected */}
        <div className="mb-4">
          <p className="text-xs mb-2" style={{ color: "#3D3D3D", opacity: 0.45 }}>Move to meal</p>
          <div className="flex gap-2 flex-wrap">
            {MEAL_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => onMoveMealType(type)}
                className="rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors"
                style={{
                  backgroundColor: entry.meal_type === type ? "#3D3D3D" : "#fff",
                  color: entry.meal_type === type ? "#fff" : "#3D3D3D",
                  border: "1.5px solid #e5e0d8",
                }}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Item list */}
        {editing ? (
          <div className="flex flex-col gap-2 mb-4">
            {editedItems.length === 0 ? (
              <p className="text-sm text-center py-3" style={{ color: "#3D3D3D", opacity: 0.5 }}>
                All items removed
              </p>
            ) : (
              editedItems.map((item, i) => (
                <ChipEditor
                  key={`${item.name}-${i}`}
                  item={item}
                  isSelected={selectedIdx === i}
                  onSelect={() => setSelectedIdx((prev) => (prev === i ? null : i))}
                  onChange={(updated) =>
                    setEditedItems((prev) => prev.map((it, idx) => (idx === i ? updated : it)))
                  }
                  onRemove={() => {
                    setEditedItems((prev) => prev.filter((_, idx) => idx !== i));
                    setSelectedIdx(null);
                  }}
                />
              ))
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2 mb-4">
            {entry.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl px-3 py-2.5"
                style={{ backgroundColor: "#fff" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "#3D3D3D" }}>
                    {item.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#3D3D3D", opacity: 0.5 }}>
                    {item.quantity}
                  </p>
                </div>
                {item.protein_level === "high" && (
                  <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: "#e8f0de", color: "#2D5016" }}>
                    high protein
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add food input — visible in edit mode */}
        {editing && (
          <div className="mb-3">
            {addingFood ? (
              <div className="flex gap-2">
                {/* Voice button */}
                <button
                  onMouseDown={(e) => { e.preventDefault(); startAddVoice(); }}
                  onMouseUp={stopAddVoice}
                  onTouchStart={(e) => { e.preventDefault(); startAddVoice(); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopAddVoice(); }}
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
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
                <input
                  autoFocus
                  type="text"
                  value={addFoodText}
                  onChange={(e) => setAddFoodText(e.target.value)}
                  placeholder={isAddRecording ? "Listening…" : "e.g. a cup of curd"}
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none border-2"
                  style={{ borderColor: "#C4633A", color: "#3D3D3D", backgroundColor: "#fff" }}
                  onKeyDown={(e) => e.key === "Enter" && handleAddFood()}
                  disabled={isParsingAdd || isAddRecording}
                />
                <button
                  onClick={() => handleAddFood()}
                  disabled={isParsingAdd || !addFoodText.trim()}
                  className="rounded-xl px-3 py-2.5 text-sm font-semibold text-white shrink-0 transition-opacity"
                  style={{ backgroundColor: "#C4633A", opacity: isParsingAdd || !addFoodText.trim() ? 0.5 : 1 }}
                >
                  {isParsingAdd ? "…" : "Add"}
                </button>
                <button
                  onClick={() => { setAddingFood(false); setAddFoodText(""); }}
                  className="text-sm shrink-0 px-2"
                  style={{ color: "#3D3D3D", opacity: 0.4 }}
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAddingFood(true)}
                className="w-full rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
                style={{ border: "1.5px dashed #e5e0d8", color: "#C4633A", backgroundColor: "transparent" }}
              >
                + Add a missed food
              </button>
            )}
          </div>
        )}

        {/* Context note — always editable, saves on blur */}
        <div className="mb-4">
          <input
            type="text"
            value={contextNote}
            onChange={(e) => setContextNote(e.target.value)}
            onBlur={() => onUpdateContextNote(contextNote.trim())}
            placeholder="Anything worth noting? (e.g. eating at a wedding, MIL cooking this week)"
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none border-0"
            style={{
              backgroundColor: "#f5ede5",
              color: "#3D3D3D",
              caretColor: "#C4633A",
            }}
          />
        </div>

        {/* Action buttons */}
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={handleCancelEdit}
              className="flex-1 rounded-2xl py-3 text-sm font-medium"
              style={{ border: "1.5px solid #e5e0d8", color: "#3D3D3D", backgroundColor: "transparent" }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-2xl py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: "#C4633A" }}
            >
              Save changes
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setEditedItems([...entry.items]);
                setEditing(true);
              }}
              className="w-full rounded-2xl py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: "#C4633A" }}
            >
              Edit items
            </button>
            <button
              onClick={onDelete}
              className="w-full rounded-2xl py-3 text-sm font-medium"
              style={{ border: "1.5px solid #e5e0d8", color: "#C4633A", backgroundColor: "transparent" }}
            >
              Delete entry
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ---- Helpers ----

function ProteinDots({ items }: { items: MealEntry["items"] }) {
  const hasHigh = items.some((i) => i.protein_level === "high");
  const hasMedium = items.some((i) => i.protein_level === "medium");
  const allLow = items.every(
    (i) => i.protein_level === "low" || i.protein_level === "unknown"
  );
  const color = hasHigh ? "#2D5016" : hasMedium ? "#7c9a3d" : allLow ? "#d4a44c" : "transparent";
  const label = hasHigh ? "high protein" : hasMedium ? "some protein" : "low protein";
  if (color === "transparent") return null;
  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs" style={{ color, opacity: 0.8 }}>
        {label}
      </span>
    </div>
  );
}

function formatTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleTimeString("en-IN", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return "";
  }
}

/** Extract "HH:MM" from an ISO timestamp (e.g. "2026-04-16T08:30:00+05:30" → "08:30") */
function extractTimeHHMM(isoString: string): string {
  const match = isoString.match(/T(\d{2}):(\d{2})/);
  if (!match) return "00:00";
  return `${match[1]}:${match[2]}`;
}

/** Replace the time portion in an ISO timestamp, preserving the date and IST offset */
function replaceTimeInISO(isoString: string, newHHMM: string): string {
  const datePart = isoString.split("T")[0]; // "2026-04-16"
  return `${datePart}T${newHHMM}:00+05:30`;
}
