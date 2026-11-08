import { describe, expect, it } from 'vitest';
import { applyRosyFilm, applySunlight } from '@/features/growth-community/moment-filter';

describe('photographic rosy film', () => {
  it('keeps the original unchanged at zero strength', () => {
    const pixels = new Uint8ClampedArray([220, 130, 120, 255, 12, 18, 22, 0]);
    const original = pixels.slice();
    applyRosyFilm(pixels, 0);
    expect(pixels).toEqual(original);
  });
  it('preserves alpha and transparent pixels while warming visible colors', () => {
    const pixels = new Uint8ClampedArray([200, 180, 160, 128, 12, 18, 22, 0]);
    applyRosyFilm(pixels, 55);
    expect(pixels[3]).toBe(128);
    expect(Array.from(pixels.slice(4))).toEqual([12, 18, 22, 0]);
    expect(pixels[0] - pixels[2]).toBeGreaterThan(40);
  });
  it('enhances existing rosy colors more than neutral skin tones and stays deterministic', () => {
    const source = new Uint8ClampedArray([220, 130, 120, 255, 220, 185, 155, 255]);
    const low = source.slice(), high = source.slice(), repeat = source.slice();
    applyRosyFilm(low, 25);
    applyRosyFilm(high, 80);
    applyRosyFilm(repeat, 80);
    expect(high).toEqual(repeat);
    const rosyBoost = high[0] - high[1] - (source[0] - source[1]);
    const neutralBoost = high[4] - high[5] - (source[4] - source[5]);
    expect(rosyBoost).toBeGreaterThan(neutralBoost);
    expect(high[0] - high[1]).toBeGreaterThan(low[0] - low[1]);
  });
});

it('sunlight lifts midtones without changing alpha or clipping pure white into color', () => {
 const pixels = new Uint8ClampedArray([90, 100, 110, 200, 255, 255, 255, 255, 12, 13, 14, 0]);
 const original = pixels.slice();
 applySunlight(pixels, 0); expect(pixels).toEqual(original);
 applySunlight(pixels, 60);
 expect(pixels[0]).toBeGreaterThan(90); expect(pixels[1]).toBeGreaterThan(100);
 expect(pixels[3]).toBe(200);
 expect(Array.from(pixels.slice(4))).toEqual([255,255,255,255,12,13,14,0]);
});
