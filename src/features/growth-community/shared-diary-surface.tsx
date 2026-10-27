'use client';
import { useEffect, type ReactNode } from 'react';

// A deterrent to casual saving, not a security boundary: displayed images
// remain accessible to the browser and can still be captured.
export function SharedDiarySurface({ children }: { children: ReactNode }) {
  useEffect(() => {
    const preventPageSave = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's')
        event.preventDefault();
    };
    document.addEventListener('keydown', preventPageSave);
    return () => document.removeEventListener('keydown', preventPageSave);
  }, []);
  return (
    <div
      className="shared-diary-scene"
      onContextMenu={(event) => event.preventDefault()}
    >
      {children}
    </div>
  );
}
