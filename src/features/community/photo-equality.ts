// Works on LAN HTTP too, without requiring the secure-context crypto API.
export async function samePhoto(a: Blob, b: Blob) {
  if (a.size !== b.size) return false;
  const [left, right] = await Promise.all([a.arrayBuffer(), b.arrayBuffer()]);
  const x = new Uint8Array(left),
    y = new Uint8Array(right);
  return x.every((value, index) => value === y[index]);
}
