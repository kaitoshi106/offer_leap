import { expect, test } from './support';

const PAGES = ['/vi', '/vi/login', '/vi/register', '/vi/forgot-password'];

test.describe('layout', () => {
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 1440, height: 900 },
  ]) {
    test(`public pages fit a ${viewport.width}×${viewport.height} screen without scrolling`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      for (const path of PAGES) {
        await page.goto(path);
        const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
        expect(scrollHeight, path).toBeLessThanOrEqual(viewport.height);
      }
    });
  }
});
