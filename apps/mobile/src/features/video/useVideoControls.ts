import { useState, useRef, useCallback, useEffect } from 'react';

const AUTO_HIDE_MS = 3000;

export function useVideoControls(isPlaying: boolean) {
  const [visible, setVisible] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  const arm = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, []);

  const disarm = useCallback(() => {
    clearTimeout(timer.current);
  }, []);

  useEffect(() => {
    if (isPlaying) arm();
    else disarm();
    return disarm;
  }, [isPlaying, arm, disarm]);

  const show = useCallback(() => {
    setVisible(true);
    if (playingRef.current) arm();
    else disarm();
  }, [arm, disarm]);

  const toggle = useCallback(() => {
    setVisible(v => {
      const next = !v;
      if (next && playingRef.current) arm();
      else if (!next) disarm();
      return next;
    });
  }, [arm, disarm]);

  return { visible, show, toggle };
}
