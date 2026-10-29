'use client';
import { useState, useEffect } from 'react';
export function Timer({
  start,
  showSeconds = true,
}: {
  start: string;
  showSeconds?: boolean;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 1000)),
      );
    update();
    const interval = setInterval(update, showSeconds ? 1000 : 60000);
    return () => clearInterval(interval);
  }, [start, showSeconds]);
  return (
    <span className="timer" aria-live="off">
      {Math.floor(elapsed / 3600)
        .toString()
        .padStart(2, '0')}
      :
      {Math.floor((elapsed / 60) % 60)
        .toString()
        .padStart(2, '0')}
      {showSeconds && <>:{(elapsed % 60).toString().padStart(2, '0')}</>}
    </span>
  );
}
