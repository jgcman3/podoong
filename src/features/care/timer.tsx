'use client';
import { useState, useEffect } from 'react';
export function Timer({ start }: { start: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsed(
        Math.max(0, Math.floor((Date.now() - Date.parse(start)) / 1000)),
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [start]);
  return (
    <span className="timer" aria-live="off">
      {Math.floor(elapsed / 3600)
        .toString()
        .padStart(2, '0')}
      :
      {Math.floor((elapsed / 60) % 60)
        .toString()
        .padStart(2, '0')}
      :{(elapsed % 60).toString().padStart(2, '0')}
    </span>
  );
}
