// execCommand keeps copy available on LAN HTTP, where Clipboard API is absent.
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* Try the user-gesture fallback. */
    }
  }
  const active = document.activeElement as HTMLElement | null;
  const field = document.createElement('textarea');
  field.value = text;
  field.readOnly = true;
  field.setAttribute('aria-hidden', 'true');
  Object.assign(field.style, {
    position: 'fixed',
    left: '-9999px',
    top: '0',
    opacity: '0',
  });
  // Native modal dialogs make the rest of the document inert.
  const host =
    active?.closest('dialog[open]') ??
    Array.from(document.querySelectorAll('dialog[open]')).at(-1) ??
    document.body;
  host.append(field);
  let wrote = false;
  const copy = (event: ClipboardEvent) => {
    if (event.clipboardData) {
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
      wrote = true;
    }
  };
  document.addEventListener('copy', copy, true);
  try {
    field.focus({ preventScroll: true });
    field.select();
    field.setSelectionRange(0, text.length);
    const executed = document.execCommand('copy');
    return executed && (wrote || document.activeElement === field);
  } finally {
    document.removeEventListener('copy', copy, true);
    field.remove();
    active?.focus({ preventScroll: true });
  }
}
