export function Nest({ large = false }: { large?: boolean }) {
  return (
    <svg
      viewBox="0 0 180 150"
      className={large ? 'nest large' : 'nest'}
      aria-hidden="true"
    >
      <ellipse cx="90" cy="122" rx="64" ry="17" fill="#ead6bd" />
      <path d="M27 104q63 37 126 0l-13 22q-50 30-101 0z" fill="#b58a60" />
      <path
        d="M30 111q60 32 120 0M38 120q51 22 103 0"
        fill="none"
        stroke="#8e6748"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <ellipse cx="90" cy="86" rx="43" ry="37" fill="#f8ead3" />
      <circle cx="62" cy="47" r="14" fill="#f8ead3" />
      <circle cx="118" cy="47" r="14" fill="#f8ead3" />
      <circle cx="62" cy="47" r="8" fill="#e8bb9f" />
      <circle cx="118" cy="47" r="8" fill="#e8bb9f" />
      <circle cx="76" cy="82" r="3" fill="#544235" />
      <circle cx="103" cy="82" r="3" fill="#544235" />
      <ellipse cx="89" cy="91" rx="5" ry="4" fill="#8a654b" />
      <path
        d="M82 97q7 7 14 0"
        stroke="#8a654b"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="66" cy="93" rx="8" ry="5" fill="#f0c0ac" />
      <ellipse cx="114" cy="93" rx="8" ry="5" fill="#f0c0ac" />
      <path d="M145 44q-11-14-15-4q-5-10-12-2q-6 11 19 21z" fill="#da9b83" />
    </svg>
  );
}
