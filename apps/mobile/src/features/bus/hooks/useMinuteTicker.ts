/**
 * Minute ticker hook — triggers re-render every 60 seconds.
 *
 * Used by schedule screen for live "X분 후" ETA updates.
 * Returns a tick counter that increments each minute.
 */

import { useState, useEffect } from 'react';

export function useMinuteTicker(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return tick;
}
