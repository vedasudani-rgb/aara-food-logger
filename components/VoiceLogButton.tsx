"use client";
import { useRef, useCallback, useEffect } from "react";
import { InputMode } from "@/hooks/useVoiceInput";

interface VoiceLogButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  inputMode: InputMode;
  onPressStart: () => void;
  onPressEnd: () => void;
  onTextSubmit: (text: string) => void;
  onSwitchToVoice: () => void;
  onSwitchToText: () => void;
}

export function VoiceLogButton({
  isRecording,
  isLoading,
  inputMode,
  onPressStart,
  onPressEnd,
  onTextSubmit,
  onSwitchToVoice,
  onSwitchToText,
}: VoiceLogButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pressedRef = useRef(false);

  // Auto-focus text input when switching to text mode
  useEffect(() => {
    if (inputMode === "text" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputMode]);

  // Spacebar / Enter to start and stop recording (voice mode only)
  useEffect(() => {
    if (inputMode !== "voice") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      if (e.repeat) return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      if (!pressedRef.current) {
        pressedRef.current = true;
        onPressStart();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key !== " " && e.key !== "Enter") return;
      if (pressedRef.current) {
        pressedRef.current = false;
        onPressEnd();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [inputMode, onPressStart, onPressEnd]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    pressedRef.current = true;
    onPressStart();
  }, [onPressStart]);

  const handleMouseUp = useCallback(() => {
    if (pressedRef.current) {
      pressedRef.current = false;
      onPressEnd();
    }
  }, [onPressEnd]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    pressedRef.current = true;
    onPressStart();
  }, [onPressStart]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    if (pressedRef.current) {
      pressedRef.current = false;
      onPressEnd();
    }
  }, [onPressEnd]);

  const handleTextKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = inputRef.current?.value.trim();
      if (val) {
        onTextSubmit(val);
        if (inputRef.current) inputRef.current.value = "";
      }
    }
  };

  const handleTextSubmitClick = () => {
    const val = inputRef.current?.value.trim();
    if (val) {
      onTextSubmit(val);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (inputMode === "text") {
    return (
      <div className="flex flex-col items-center gap-3 w-full px-4">
        <div className="flex w-full gap-2">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type what you had…"
            className="flex-1 rounded-2xl px-4 py-3 text-base outline-none border-2"
            style={{
              backgroundColor: "#fff",
              borderColor: "#C4633A",
              color: "#3D3D3D",
            }}
            onKeyDown={handleTextKeyDown}
          />
          <button
            onClick={handleTextSubmitClick}
            disabled={isLoading}
            className="rounded-2xl px-5 py-3 font-semibold text-white text-sm transition-opacity"
            style={{ backgroundColor: "#C4633A", opacity: isLoading ? 0.6 : 1 }}
          >
            {isLoading ? "…" : "Log"}
          </button>
        </div>
        <button
          onClick={onSwitchToVoice}
          className="text-sm"
          style={{ color: "#C4633A" }}
        >
          Use voice instead
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm" style={{ color: "#3D3D3D", opacity: 0.5 }}>
        {isRecording ? "Listening…" : isLoading ? "Parsing…" : "Hold or press Space to speak"}
      </p>

      {/* Pulse rings */}
      <div className="relative flex items-center justify-center">
        {isRecording && (
          <>
            <span
              className="absolute rounded-full pulse-ring"
              style={{
                width: 80,
                height: 80,
                backgroundColor: "#C4633A",
                opacity: 0.3,
              }}
            />
            <span
              className="absolute rounded-full pulse-ring"
              style={{
                width: 80,
                height: 80,
                backgroundColor: "#C4633A",
                opacity: 0.15,
                animationDelay: "0.4s",
              }}
            />
          </>
        )}

        {/* Main button */}
        <button
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          disabled={isLoading}
          className="relative z-10 rounded-full flex items-center justify-center select-none transition-transform active:scale-95"
          style={{
            width: 80,
            height: 80,
            backgroundColor: isRecording ? "#a84f2f" : "#C4633A",
            boxShadow: isRecording
              ? "0 0 0 4px rgba(196,99,58,0.3)"
              : "0 4px 20px rgba(196,99,58,0.35)",
            opacity: isLoading ? 0.7 : 1,
          }}
          aria-label={isRecording ? "Recording — release to send" : "Hold to record meal"}
        >
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <MicIcon recording={isRecording} />
          )}
        </button>
      </div>

      {!isRecording && !isLoading && (
        <button
          onClick={onSwitchToText}
          className="text-sm"
          style={{ color: "#C4633A", opacity: 0.55 }}
        >
          Use text instead
        </button>
      )}
    </div>
  );
}

function MicIcon({ recording }: { recording: boolean }) {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={recording ? 2.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}
