'use client';

import type { Locale } from '@offerleap/shared';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/** The parts of the Web Speech API used here (not in TypeScript's DOM types yet). */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const SPEECH_LANG: Record<Locale, string> = { vi: 'vi-VN', en: 'en-US' };

function recognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as unknown as Record<string, SpeechRecognitionConstructor | undefined>;
  // Chrome and Safari still use the prefixed name.
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

const noop = () => () => {};

/**
 * @description Speech-to-text with the browser's Web Speech API (Chrome, Edge, Safari). Progressive
 * enhancement: `supported` is false on the server and in browsers without the API, so callers simply hide the
 * microphone button.
 * @param locale - Recognition language.
 * @returns `supported`, `listening`, `error`, and `toggle(onText)` — `onText` receives each finished phrase.
 */
export function useSpeechRecognition(locale: Locale) {
  // Server snapshot `false` avoids a hydration mismatch; the client re-renders with the real value.
  const supported = useSyncExternalStore(
    noop,
    () => Boolean(recognitionConstructor()),
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognition.current?.stop(), []);

  const toggle = useCallback(
    (onText: (text: string) => void) => {
      if (recognition.current) {
        recognition.current.stop();
        return;
      }
      const Recognition = recognitionConstructor();
      if (!Recognition) return;
      const instance = new Recognition();
      instance.lang = SPEECH_LANG[locale];
      instance.continuous = true;
      instance.interimResults = false;
      instance.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i]!;
          if (result.isFinal) onText(result[0].transcript.trim());
        }
      };
      instance.onerror = (event) => {
        // "no-speech" / "aborted" are normal ends; anything else (permission denied, no microphone) is shown.
        if (event.error !== 'no-speech' && event.error !== 'aborted') setError(true);
      };
      instance.onend = () => {
        recognition.current = null;
        setListening(false);
      };
      recognition.current = instance;
      setError(false);
      setListening(true);
      instance.start();
    },
    [locale],
  );

  return { supported, listening, error, toggle };
}
