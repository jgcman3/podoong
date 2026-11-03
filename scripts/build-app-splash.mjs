import { chromium } from '@playwright/test';
import { readFile, mkdir, stat } from 'node:fs/promises';
import { startupScreens, startupBackground } from '../src/lib/app-startup.mjs';
const portrait = (await readFile('public/brand/podung.png')).toString('base64');
const font = (
  await readFile('public/fonts/nanum-square-round-bold.woff2')
).toString('base64');
await mkdir('public/splash/v1', { recursive: true });
const browser = await chromium.launch();
let bytes = 0,
  count = 0;
try {
  for (const [width, height, scale] of startupScreens) {
    for (const orientation of ['portrait', 'landscape']) {
      const landscape = orientation === 'landscape';
      const context = await browser.newContext({
        viewport: {
          width: landscape ? height : width,
          height: landscape ? width : height,
        },
        deviceScaleFactor: scale,
      });
      const page = await context.newPage();
      await page.setContent(
        `<style>@font-face{font-family:Round;src:url(data:font/woff2;base64,${font})}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;background:${startupBackground}}body{display:grid;place-items:center}.brand{display:flex;flex-direction:column;align-items:center;gap:18px;transform:translateY(-12px)}img{width:148px;height:148px;object-fit:contain}strong{font:700 34px/1.2 Round,sans-serif;letter-spacing:-1.3px;color:#5267a8}</style><div class="brand"><img src="data:image/png;base64,${portrait}"/><strong>podoong</strong></div>`,
      );
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all([...document.images].map((image) => image.decode()));
      });
      const path = `public/splash/v1/${width}x${height}@${scale}-${orientation}.png`;
      await page.screenshot({ path });
      bytes += (await stat(path)).size;
      count++;
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(
  `Generated ${count} startup images (${(bytes / 1024 / 1024).toFixed(2)} MiB total).`,
);
