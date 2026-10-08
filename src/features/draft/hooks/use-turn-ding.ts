"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "starcoins.draft-ding";

let audio: AudioContext | undefined;

/** Two short rising notes. Silent where the browser has no audio or has not allowed it yet. */
export function playDing(): void {
  if (typeof AudioContext === "undefined") return;
  try {
    audio ??= new AudioContext();
    const ctx = audio;
    void ctx.resume();
    for (const [i, frequency] of [880, 1320].entries()) {
      const start = ctx.currentTime + i * 0.16;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.4);
    }
  } catch {
    // A sound is a nicety; a browser that refuses it must not break the draft.
  }
}

function readSetting(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

/**
 * Dings each time a pick becomes the reader's, including back to back picks at the turn of
 * a snake round. On by default; the choice is remembered in this browser.
 */
export function useTurnDing(
  myTurn: boolean,
  pickNo: number,
): { enabled: boolean; setEnabled: (on: boolean) => void } {
  const [enabled, setEnabledState] = useState(true);
  const enabledRef = useRef(true);

  useEffect(() => {
    const stored = readSetting();
    enabledRef.current = stored;
    setEnabledState(stored);
  }, []);

  useEffect(() => {
    if (myTurn && enabledRef.current) playDing();
  }, [myTurn, pickNo]);

  function setEnabled(on: boolean): void {
    enabledRef.current = on;
    setEnabledState(on);
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
    } catch {
      // Private windows may refuse storage; the setting then lasts for this visit.
    }
    // Turning it on plays the sound once: a sample, and the click browsers need to allow audio.
    if (on) playDing();
  }

  return { enabled, setEnabled };
}
