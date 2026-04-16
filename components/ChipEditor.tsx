"use client";
import { MealItem } from "@/lib/types";

const COUNTABLE_KEYWORDS = [
  "idli", "dosa", "chapati", "roti", "murukku", "vadai", "vada",
  "puri", "paratha", "uttapam", "adai", "paniyaram", "poori", "laddoo",
  "naan", "poori", "bread", "samosa", "bondas", "bonda", "bajji",
  // piece-countable snacks & confections
  "chocolate", "biscuit", "cookie", "cracker", "date", "fig",
  "laddu", "mithai", "sweet", "barfi", "peda", "modak",
];

const BEVERAGE_KEYWORDS = [
  "coffee", "tea", "chai", "juice", "water", "milk", "lassi",
  "buttermilk", "mor", "sherbet", "soda",
];

const GRAIN_KEYWORDS = [
  "rice", "pongal", "upma", "oats", "rava", "semolina", "poha",
  "puli sadam", "tamarind rice", "curd rice", "lemon rice",
];

type EditorType = "countable" | "beverage" | "volumetric_grain" | "volumetric";

function getEditorType(item: MealItem): EditorType {
  const lower = item.name.toLowerCase();
  if (item.category === "beverage" || BEVERAGE_KEYWORDS.some((k) => lower.includes(k)))
    return "beverage";
  if (COUNTABLE_KEYWORDS.some((k) => lower.includes(k))) return "countable";
  if (item.category === "grain" || GRAIN_KEYWORDS.some((k) => lower.includes(k)))
    return "volumetric_grain";
  return "volumetric";
}

function getUnitWord(editorType: EditorType): string {
  switch (editorType) {
    case "beverage": return "cup";
    case "countable": return "piece";
    case "volumetric_grain": return "serving";
    default: return "bowl";
  }
}

type SizeOption = "small" | "medium" | "large";

function parseQuantityState(quantity: string): { count: number; size: SizeOption } {
  const lower = quantity.toLowerCase().replace(/~/g, "");
  const numMatch = lower.match(/(\d+\.?\d*)/);
  let raw = numMatch ? parseFloat(numMatch[1]) : 1;
  // Round to nearest 0.5 and clamp
  raw = Math.round(raw * 2) / 2;
  const count = Math.min(5, Math.max(0.5, raw));

  let size: SizeOption = "medium";
  if (lower.includes("small")) size = "small";
  else if (lower.includes("large") || lower.includes("big")) size = "large";

  return { count, size };
}

function formatCount(count: number): string {
  return count % 1 === 0 ? String(count) : count.toFixed(1);
}

function buildQuantityString(
  editorType: EditorType,
  count: number,
  size: SizeOption
): string {
  const unit = getUnitWord(editorType);
  const plural = count !== 1 ? `${unit}s` : unit;
  return `${formatCount(count)} ${size} ${plural}`;
}

interface ChipEditorProps {
  item: MealItem;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (updated: MealItem) => void;
  onRemove: () => void;
}

export function ChipEditor({
  item,
  isSelected,
  onSelect,
  onChange,
  onRemove,
}: ChipEditorProps) {
  const editorType = getEditorType(item);
  const { count, size } = parseQuantityState(item.quantity);

  const setCount = (n: number) => {
    const newCount = Math.min(5, Math.max(0.5, Math.round(n * 2) / 2));
    onChange({
      ...item,
      quantity: buildQuantityString(editorType, newCount, size),
      edited_by_user: true,
    });
  };

  const setSize = (s: SizeOption) => {
    onChange({
      ...item,
      quantity: buildQuantityString(editorType, count, s),
      edited_by_user: true,
    });
  };

  const unit = getUnitWord(editorType);
  const unitLabel = count !== 1 ? `${unit}s` : unit;

  return (
    <div className="flex flex-col gap-1">
      {/* Chip pill */}
      <button
        onClick={onSelect}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors text-left"
        style={{
          backgroundColor: isSelected ? "#C4633A" : "#fff",
          color: isSelected ? "#fff" : "#3D3D3D",
          border: item.inferred ? "2px dashed #C4633A" : "2px solid #e5e0d8",
        }}
      >
        <span>{item.name}</span>
        <span className="text-xs" style={{ opacity: isSelected ? 0.85 : 0.55 }}>
          {item.quantity}
        </span>
        {item.inferred && (
          <span
            className="text-xs rounded px-1"
            style={{
              backgroundColor: isSelected ? "rgba(255,255,255,0.2)" : "#f5ede5",
              color: isSelected ? "#fff" : "#C4633A",
            }}
          >
            inferred
          </span>
        )}
      </button>

      {/* Editor panel */}
      {isSelected && (
        <div
          className="rounded-2xl p-3 flex flex-col gap-3"
          style={{ backgroundColor: "#f5ede5" }}
        >
          {/* Quantity row — always shown */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium flex-1" style={{ color: "#3D3D3D" }}>
              {editorType === "beverage" ? "Cups" : editorType === "countable" ? "Pieces" : "How many?"}
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCount(count - 0.5)}
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: count <= 0.5 ? "#d4a090" : "#C4633A" }}
                disabled={count <= 0.5}
              >
                −
              </button>
              <span className="text-base font-semibold w-16 text-center" style={{ color: "#3D3D3D" }}>
                {formatCount(count)} {unitLabel}
              </span>
              <button
                onClick={() => setCount(count + 0.5)}
                className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white"
                style={{ backgroundColor: count >= 5 ? "#d4a090" : "#C4633A" }}
                disabled={count >= 5}
              >
                +
              </button>
            </div>
          </div>

          {/* Size row — shown for all items */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium" style={{ color: "#3D3D3D" }}>
              Size
            </span>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as SizeOption[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  className="rounded-full px-3 py-1 text-sm font-medium capitalize transition-colors"
                  style={{
                    backgroundColor: size === s ? "#C4633A" : "#fff",
                    color: size === s ? "#fff" : "#3D3D3D",
                    border: "1.5px solid #e5e0d8",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={onRemove}
            className="text-xs self-start"
            style={{ color: "#C4633A", opacity: 0.7 }}
          >
            Remove this item
          </button>
        </div>
      )}
    </div>
  );
}
