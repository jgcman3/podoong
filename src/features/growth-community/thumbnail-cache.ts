// Session-local previews only. No localStorage or shared HTTP cache is used.
const MAX_BYTES = 24 * 1024 * 1024;
const MAX_ENTRIES = 80;
const TTL = 5 * 60 * 1000;
const entries = new Map<string, { data: string; expires: number }>();
const pending = new Map<string, Promise<void>>();
let owner = '';
let bytes = 0;
function remove(key: string) {
  const entry = entries.get(key);
  if (entry) bytes -= entry.data.length;
  entries.delete(key);
}
export function readThumbnail(scope: string, source: string) {
  if (scope !== owner) {
    entries.clear();
    pending.clear();
    bytes = 0;
    owner = scope;
  }
  const entry = entries.get(source);
  if (!entry) return;
  if (entry.expires <= Date.now()) {
    remove(source);
    return;
  }
  entries.delete(source);
  entries.set(source, entry);
  return entry.data;
}
export function rememberThumbnail(scope: string, source: string, data: string) {
  if (owner !== scope || data.length > MAX_BYTES) return;
  remove(source);
  while (entries.size >= MAX_ENTRIES || bytes + data.length > MAX_BYTES) {
    const oldest = entries.keys().next().value;
    if (!oldest) break;
    remove(oldest);
  }
  entries.set(source, { data, expires: Date.now() + TTL });
  bytes += data.length;
}
export function warmThumbnail(scope: string, source: string) {
  if (owner !== scope || readThumbnail(scope, source)) return Promise.resolve();
  const existing = pending.get(source);
  if (existing) return existing;
  // Called only after the normal, authorized image request completed. Reuse its
  // HTTP response rather than making another conditional validation request.
  const work = (async () => {
    try {
      const response = await fetch(source, {
        cache: 'force-cache',
        credentials: 'same-origin',
      });
      if (
        !response.ok ||
        !response.headers.get('content-type')?.startsWith('image/')
      )
        return;
      const blob = await response.blob();
      if (blob.size > 2 * 1024 * 1024) return;
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('Preview unavailable'));
        reader.readAsDataURL(blob);
      });
      rememberThumbnail(scope, source, data);
    } catch {
      /* The already displayed image remains available. */
    }
  })();
  pending.set(source, work);
  void work.finally(() => {
    if (pending.get(source) === work) pending.delete(source);
  });
  return work;
}
