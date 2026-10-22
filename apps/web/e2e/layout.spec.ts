import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

const PAGES = ['/vi', '/vi/login', '/vi/register', '/vi/forgot-password'];
const SIGNED_IN_PAGES = [
  '/vi/dashboard',
  '/vi/analyses',
  '/vi/applications',
  '/vi/interviews',
  '/vi/documents',
  '/vi/profile',
  '/vi/settings',
];

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

  test('on a phone, the menu drawer leads to every section, the account settings and sign-out', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await registerAndVerify(page, 'Minh Mobile');
    await completeOnboarding(page);

    // The header is just ☰ and the brand.
    await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeHidden();
    const toggle = page.getByRole('button', { name: 'Mở menu' });
    await toggle.click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu.getByRole('link', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page');
    await expect(menu.getByText('Ngôn ngữ')).toBeVisible();
    await expect(menu.getByText('Giao diện')).toBeVisible();

    // Switching the language reloads the page in English with the menu still open, focus on the switch.
    await menu.getByRole('link', { name: /English/ }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    const enMenu = page.getByRole('dialog', { name: 'Menu' });
    await expect(enMenu.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(enMenu.getByRole('link', { name: /Tiếng Việt/ })).toBeFocused();
    await enMenu.getByRole('link', { name: /Tiếng Việt/ }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
    await expect(menu.getByRole('link', { name: 'Tổng quan' })).toBeVisible();

    // Escape closes it and gives focus back to the button.
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(toggle).toBeFocused();

    // Following a link navigates and closes the menu.
    await toggle.click();
    await menu.getByRole('link', { name: 'Tài liệu' }).click();
    await expect(page).toHaveURL(/\/vi\/documents$/);
    await expect(menu).toBeHidden();

    await page.getByRole('button', { name: 'Mở menu' }).click();
    await menu.getByRole('link', { name: /Cài đặt tài khoản/ }).click();
    await expect(page).toHaveURL(/\/vi\/settings$/);

    await page.getByRole('button', { name: 'Mở menu' }).click();
    await menu.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/vi\/login$/);
  });

  test("signed-in pages don't jump while their data loads (header avatar included)", async ({ page }) => {
    test.slow();
    await registerAndVerify(page, 'Minh Layout');
    await completeOnboarding(page);
    await page.request.post(`http://localhost:${process.env.E2E_API_PORT ?? 4000}/api/v1/resumes`, {
      multipart: {
        file: {
          name: 'cv.pdf',
          mimeType: 'application/pdf',
          buffer: await readFile(path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf')),
        },
      },
    });
    // Records layout shifts (the browser's Cumulative Layout Shift entries) from the very first paint.
    await page.addInitScript(() => {
      const shifts: number[] = [];
      Object.assign(window, { layoutShifts: shifts });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) shifts.push((entry as unknown as { value: number }).value);
      }).observe({ type: 'layout-shift', buffered: true });
    });

    for (const viewport of [
      { width: 1280, height: 720 },
      { width: 375, height: 812 },
    ]) {
      await page.setViewportSize(viewport);
      for (const url of SIGNED_IN_PAGES) {
        await page.goto(url);
        await page.waitForLoadState('networkidle');
        const total = await page.evaluate(() =>
          (window as unknown as { layoutShifts: number[] }).layoutShifts.reduce(
            (sum, value) => sum + value,
            0,
          ),
        );
        expect.soft(total, `layout shift on ${url} at ${viewport.width}px`).toBeLessThan(0.01);
      }
    }
  });

  test('the theme switch is drawn in its final position: no slide from light to dark on load', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const transitions: string[] = [];
      Object.assign(window, { switchTransitions: transitions });
      document.addEventListener(
        'transitionrun',
        (event) => {
          if ((event.target as Element).closest?.('[role=switch]')) transitions.push(event.propertyName);
        },
        true,
      );
    });
    for (const url of ['/vi', '/vi/login']) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('switch', { name: 'Giao diện tối' })).toBeChecked();
      const transitions = await page.evaluate(
        () => (window as unknown as { switchTransitions: string[] }).switchTransitions,
      );
      expect(transitions, url).toEqual([]);
    }
    await context.close();
  });

  test('switching the language keeps the page steady: no theme flash, no transitions, no skeletons', async ({
    browser,
  }) => {
    const context = await browser.newContext({ colorScheme: 'dark' });
    const page = await context.newPage();
    await registerAndVerify(page, 'Minh Locale');
    await completeOnboarding(page);
    await page.goto('/vi/dashboard');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => {
      const problems: string[] = [];
      Object.assign(window, { switchProblems: problems });
      // Every frame must still have the theme; nothing may animate or fall back to a loading placeholder.
      const check = () => {
        if (!document.documentElement.dataset.theme) problems.push('frame without data-theme');
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
      document.addEventListener(
        'transitionrun',
        (event) => {
          const element = event.target as HTMLElement;
          // The language switch itself changes (VI → EN): that one is expected to animate.
          if (element.closest('nav')?.querySelector('[hreflang]')) return;
          const where =
            element.closest('[aria-label], [role]')?.getAttribute('aria-label') ?? element.tagName;
          problems.push(`transition ${event.propertyName} in ${where}`);
        },
        true,
      );
      new MutationObserver((records) => {
        for (const record of records)
          for (const node of record.addedNodes)
            if (
              node instanceof Element &&
              (node.matches('.animate-pulse') || node.querySelector('.animate-pulse'))
            )
              problems.push('skeleton shown');
      }).observe(document.body, { childList: true, subtree: true });
    });

    await page
      .getByRole('link', { name: /English/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(page.getByRole('heading', { name: /^Hi, / })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const problems = await page.evaluate(
      () => (window as unknown as { switchProblems: string[] }).switchProblems,
    );
    expect([...new Set(problems)]).toEqual([]);
    await context.close();
  });

  test('switching the language from the phone menu keeps the menu on screen in every frame', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await registerAndVerify(page, 'Minh Menu');
    await completeOnboarding(page);
    await page.getByRole('button', { name: 'Mở menu' }).click();
    const menu = page.getByRole('dialog', { name: 'Menu' });
    await expect(menu).toBeVisible();
    await page.waitForTimeout(400); // let the slide-in finish

    await page.evaluate(() => {
      const problems: string[] = [];
      Object.assign(window, { menuProblems: problems });
      const check = () => {
        if (!document.querySelector('dialog[open]')) problems.push('frame without the menu');
        if (!document.documentElement.dataset.theme) problems.push('frame without data-theme');
        requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    });
    await menu.getByRole('link', { name: /English/ }).click();
    await expect(page).toHaveURL(/\/en\/dashboard$/);
    await expect(menu.getByRole('link', { name: 'Overview' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    const problems = await page.evaluate(
      () => (window as unknown as { menuProblems: string[] }).menuProblems,
    );
    expect([...new Set(problems)]).toEqual([]);
  });

  test('the signed-in header fits every width from phone to desktop, also while resizing', async ({
    page,
  }) => {
    await registerAndVerify(page, 'Nguyễn Văn Minh Hoàng');
    await completeOnboarding(page);
    for (const locale of ['vi', 'en']) {
      await page.setViewportSize({ width: 1440, height: 800 });
      await page.goto(`/${locale}/dashboard`);
      await page.waitForLoadState('networkidle');
      // Resized without reloading, like dragging the window or the DevTools device toolbar.
      for (const width of [1440, 1280, 1279, 1100, 1024, 900, 768, 640, 480, 375, 320]) {
        await page.setViewportSize({ width, height: 800 });
        const { scrollWidth, clientWidth } = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect.soft(scrollWidth, `${locale} at ${width}px`).toBeLessThanOrEqual(clientWidth);
      }
    }
  });
});
