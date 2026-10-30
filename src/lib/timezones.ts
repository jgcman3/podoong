export function supportedTimeZones(): string[] {
  return ['UTC', ...Intl.supportedValuesOf('timeZone')];
}

export function isValidTimeZone(value: string): boolean {
  if (
    value.length > 100 ||
    !/^(UTC|[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+)$/.test(value)
  )
    return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
}
