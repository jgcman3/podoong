import { expect, it } from 'vitest';
import {
  feedPreference,
  feedPreferenceCookie,
} from '@/features/community/feed-preference';
import { parentingTags, neighborhoodTags } from '@/features/community/options';
it('remembers the boards independently and rejects a category from the other board', () => {
  expect(feedPreferenceCookie('boards')).not.toBe(
    feedPreferenceCookie('neighborhood'),
  );
  expect(feedPreference('feeding:all', parentingTags)).toEqual({
    category: 'feeding',
    sort: 'all',
  });
  expect(feedPreference('feeding:all', neighborhoodTags)).toEqual({
    category: 'all',
    sort: 'all',
  });
});
it('restores popular sorting only for All, and resets removed categories', () => {
  expect(feedPreference('all:popular', parentingTags)).toEqual({
    category: 'all',
    sort: 'popular',
  });
  expect(feedPreference('daily:popular', parentingTags)).toEqual({
    category: 'daily',
    sort: 'all',
  });
  expect(feedPreference('local-friends:all', neighborhoodTags)).toEqual({
    category: 'all',
    sort: 'all',
  });
});
