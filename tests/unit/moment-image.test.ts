import { describe, expect, it } from 'vitest';
import { momentLines, shortMoment, momentPhotoPlacement } from '@/features/growth-community/moment-image';
const width = (text: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;
describe('moment card text', () => {
  it('keeps combined emoji intact when shortening a selected excerpt', () => {
    expect(shortMoment('가족 👨‍👩‍👧‍👦 💛', 4)).toBe('가족 👨‍👩‍👧‍👦');
  });
  it('wraps English at word boundaries and long Korean text without losing characters', () => {
    expect(momentLines('hello there', 6, width, 4).lines).toEqual(['hello', 'there']);
    const text = '오늘처음소리내어웃었어요';
    expect(momentLines(text, 5, width, 8).lines.join('')).toBe(text);
  });
  it('makes cropped wording explicit and keeps the ellipsis within the card', () => {
    const result = momentLines('첫 줄\n둘째 줄\n셋째 줄', 5, width, 2);
    expect(result.truncated).toBe(true);
    expect(result.lines).toEqual(['첫 줄', '둘째 줄…']);
    expect(result.lines.every(line => width(line) <= 5)).toBe(true);
  });
});


describe('moment photo framing', () => {
  it('fills portrait, landscape and square frames without letterboxing', () => {
    for (const [iw, ih] of [[400,1200],[1200,400],[512,512]]) {
      for (const [w,h] of [[1080,1350],[944,730],[836,620],[756,702]]) {
        for (const position of [0,35,50,100]) {
          const fit = momentPhotoPlacement(iw,ih,w,h,position,position);
          expect(fit.x).toBeLessThanOrEqual(0);
          expect(fit.y).toBeLessThanOrEqual(0);
          expect(fit.x+fit.width).toBeGreaterThanOrEqual(w-0.001);
          expect(fit.y+fit.height).toBeGreaterThanOrEqual(h-0.001);
        }
      }
    }
  });
  it('moves the crop within the image instead of exposing an empty edge', () => {
    const left = momentPhotoPlacement(1200,400,500,500,0,50);
    const right = momentPhotoPlacement(1200,400,500,500,100,50);
    expect(left.x).toBeCloseTo(0);
    expect(right.x+right.width).toBe(500);
    expect(left.width).toBe(right.width);
  });
});
