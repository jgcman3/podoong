import { expect, it } from 'vitest';
import {
  feedPreference,
  feedPreferenceCookie,
} from '@/features/community/feed-preference';
import { neighborhoodTags } from '@/features/community/options';
it('remembers neighborhood topics and rejects removed country topics', () => {
  expect(feedPreferenceCookie('neighborhood')).toBe(
    'podoong-feed-neighborhood',
  );
  expect(feedPreference('local-help:all', neighborhoodTags)).toEqual({
    category: 'local-help',
    sort: 'all',
  });
  expect(feedPreference('feeding:all', neighborhoodTags)).toEqual({
    category: 'all',
    sort: 'all',
  });
});
it('restores popular sorting only for All, and resets removed categories', () => {
  expect(feedPreference('all:popular', neighborhoodTags)).toEqual({
    category: 'all',
    sort: 'popular',
  });
  expect(feedPreference('local-daily:popular', neighborhoodTags)).toEqual({
    category: 'local-daily',
    sort: 'all',
  });
  expect(feedPreference('local-friends:all', neighborhoodTags)).toEqual({
    category: 'all',
    sort: 'all',
  });
});
