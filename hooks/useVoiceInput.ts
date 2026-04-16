"use client";
import { useState, useRef, useCallback } from "react";

export type InputMode = "voice" | "text";

// Minimal Web Speech API types — not in TypeScript's default lib
interface SpeechRecognitionResult {
  isFinal: boolean;
  [index: number]: { transcript: string; confidence: number };
}
interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  timeoutMs?: number;
}

// Minimum hold duration before we consider it an intentional voice attempt
const MIN_HOLD_MS = 300;

export function useVoiceInput({ onTranscript, timeoutMs = 30000 }: UseVoiceInputOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startTimeRef = useRef<number>(0);
  const finalTranscriptRef = useRef<string>("");

  const switchToText = useCallback(() => {
    setInputMode("text");
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(() => {
    const SpeechRecognitionImpl =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionImpl) {
      switchToText();
      return;
    }

    finalTranscriptRef.current = "";
    startTimeRef.current = Date.now();

    const recognition: SpeechRecognitionInstance = new SpeechRecognitionImpl();
    // continuous = true so speech recognition doesn't stop mid-sentence on natural pauses
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      // Accumulate final results across multiple speech segments
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += event.results[i][0].transcript + " ";
        }
      }
    };

    recognition.onerror = (event) => {
      setIsRecording(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      // Only fall back to text if mic was denied
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        switchToText();
      } else if (event.error !== "no-speech") {
        setError(event.error);
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      const transcript = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = "";
      if (transcript) {
        setError(null);
        onTranscript(transcript);
      }
      // Never switch to text on normal end — stay in voice mode
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsRecording(true);
      setError(null);

      // Safety timeout: just stop recording, don't switch to text
      timeoutRef.current = setTimeout(() => {
        recognition.stop();
      }, timeoutMs);
    } catch {
      switchToText();
    }
  }, [onTranscript, timeoutMs, switchToText]);

  const stopRecording = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (recognitionRef.current) {
      // stop() triggers onend which dispatches the transcript
      recognitionRef.current.stop();
    }
    // Don't set isRecording = false here — onend handles it
  }, []);

  return {
    isRecording,
    inputMode,
    error,
    startRecording,
    stopRecording,
    switchToText,
    setInputMode,
  };
}
