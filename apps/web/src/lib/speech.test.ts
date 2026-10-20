import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSpeechRecognition } from './speech';

class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  continuous = false;
  interimResults = true;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() {
    FakeRecognition.last = this;
  }
}

describe('useSpeechRecognition', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is unsupported when the browser has no Speech API', () => {
    const { result } = renderHook(() => useSpeechRecognition('vi'));
    expect(result.current.supported).toBe(false);
  });

  it('listens in the UI language and passes on finished phrases', () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const onText = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition('vi'));
    expect(result.current.supported).toBe(true);

    act(() => result.current.toggle(onText));
    const recognition = FakeRecognition.last;
    expect(recognition).toMatchObject({ lang: 'vi-VN', continuous: true, interimResults: false });
    expect(result.current.listening).toBe(true);

    act(() =>
      recognition.onresult?.({
        resultIndex: 0,
        results: [
          { isFinal: true, 0: { transcript: ' xin chào ' } },
          { isFinal: false, 0: { transcript: 'đang nói' } },
        ],
      }),
    );
    expect(onText).toHaveBeenCalledExactlyOnceWith('xin chào');

    act(() => result.current.toggle(onText));
    expect(recognition.stop).toHaveBeenCalled();
    expect(result.current.listening).toBe(false);
  });

  it('reports a denied microphone but not a silent pause', () => {
    vi.stubGlobal('webkitSpeechRecognition', FakeRecognition);
    const { result } = renderHook(() => useSpeechRecognition('en'));
    act(() => result.current.toggle(vi.fn()));

    act(() => FakeRecognition.last.onerror?.({ error: 'no-speech' }));
    expect(result.current.error).toBe(false);
    act(() => FakeRecognition.last.onerror?.({ error: 'not-allowed' }));
    expect(result.current.error).toBe(true);
  });
});
