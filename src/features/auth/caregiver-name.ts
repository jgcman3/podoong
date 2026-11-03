function cleanName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, 60)
    : '';
}

export function caregiverName(
  saved: unknown,
  metadata: Record<string, unknown> = {},
) {
  // An edited app profile always wins over future social profile changes.
  for (const candidate of [
    saved,
    metadata.nickname,
    metadata.name,
    metadata.full_name,
  ]) {
    const name = cleanName(candidate);
    if (name) return name;
  }
  return '';
}
