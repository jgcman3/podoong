import { describe, expect, it } from 'vitest';
import { isValidTimeZone, supportedTimeZones } from '../../src/lib/timezones';

describe('worldwide time zones', () => {
  it('offers the runtime IANA catalogue and UTC', () => {
    const timeZones = supportedTimeZones();
    expect(timeZones.length).toBeGreaterThan(400);
    for (const zone of [
      'UTC',
      'Asia/Seoul',
      'Pacific/Auckland',
      'Australia/Sydney',
      'Africa/Nairobi',
      'Europe/Paris',
      'America/Sao_Paulo',
    ])
      expect(timeZones).toContain(zone);
  });
  it('accepts international zones, aliases and non-hour offsets', () => {
    for (const zone of [
      'UTC',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      'Australia/Adelaide',
      'Pacific/Chatham',
      'America/St_Johns',
      'US/Eastern',
    ])
      expect(isValidTimeZone(zone)).toBe(true);
  });
  it('rejects unknown or ambiguous free text', () => {
    for (const zone of [
      '',
      'Seoul',
      'Not/A_Zone',
      '+09:00',
      'Asia/Seoul<script>',
      'a'.repeat(101),
    ])
      expect(isValidTimeZone(zone)).toBe(false);
  });
});
