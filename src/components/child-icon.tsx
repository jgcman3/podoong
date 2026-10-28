/** Distinct silhouettes keep child icons recognizable without relying on color. */
export function ChildIcon({ sex, size = 22 }: { sex: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" data-sex={sex}>
      <path d="M5 8a8 8 0 0 0-1 4c-2 0-2 4 0 4a8.2 8.2 0 0 0 16 0c2 0 2-4 0-4a8 8 0 0 0-1-4" />
      {sex === 'female' ? (
        <path d="M12 5 7 2v6l5-3 5 3V2l-5 3Z" />
      ) : (
        <path d="M6 7c1-3 5-5 8-4 3 1 2 4 0 4-2 0-2-2-1-3M15 4c1 0 3 1 3 3" />
      )}
      <path d="M8 12h.01M16 12h.01M9 16c1.5 1.5 4.5 1.5 6 0" />
    </svg>
  );
}
