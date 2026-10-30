import { test, expect } from '@playwright/test';

test('public login and expired diary use the same podoong image', async ({
  page,
}) => {
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/ko/login');
    await expect(page.locator('img.brand-image')).toHaveCount(2);
    await expect
      .poll(() =>
        page
          .locator('img.brand-image')
          .evaluateAll((images) =>
            images.every(
              (image) =>
                (image as HTMLImageElement).complete &&
                (image as HTMLImageElement).naturalWidth > 0,
            ),
          ),
      )
      .toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/tmp/podung-brand-login-${width}.png`,
      fullPage: true,
    });
  }
  await page.goto(`/ko/share/diary/${'0'.repeat(64)}`);
  await expect(
    page.getByRole('heading', { name: '공유가 종료되었거나 없는 일기예요' }),
  ).toBeVisible();
  await expect(page.locator('img.brand-image')).toHaveCount(1);
  await expect
    .poll(() =>
      page
        .locator('img.brand-image')
        .evaluate(
          (image) =>
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
    )
    .toBe(true);
  await page.screenshot({
    path: '/tmp/podung-brand-share-ended-mobile.png',
    fullPage: true,
  });
});
