"use client";

import { useEffect, useState } from "react";

function readRemainingSeconds(storageKey: string) {
  if (typeof window === "undefined") {
    return 0;
  }

  const storedValue = window.localStorage.getItem(storageKey);
  const expiresAt = Number.parseInt(storedValue ?? "", 10);

  if (!Number.isFinite(expiresAt)) {
    return 0;
  }

  const remainingMilliseconds = expiresAt - Date.now();

  if (remainingMilliseconds <= 0) {
    window.localStorage.removeItem(storageKey);
    return 0;
  }

  return Math.ceil(remainingMilliseconds / 1000);
}

export function useVerificationCodeCooldown(storageKey: string, durationSeconds = 60) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    function syncRemainingSeconds() {
      setRemainingSeconds(readRemainingSeconds(storageKey));
    }

    syncRemainingSeconds();

    const intervalId = window.setInterval(syncRemainingSeconds, 1000);
    window.addEventListener("storage", syncRemainingSeconds);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", syncRemainingSeconds);
    };
  }, [storageKey]);

  function startCooldown() {
    if (typeof window === "undefined") {
      return;
    }

    const expiresAt = Date.now() + durationSeconds * 1000;
    window.localStorage.setItem(storageKey, String(expiresAt));
    setRemainingSeconds(durationSeconds);
  }

  return {
    isCoolingDown: remainingSeconds > 0,
    remainingSeconds,
    startCooldown,
  };
}
