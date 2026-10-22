import { readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Page } from '@playwright/test';

import {
  completeOnboarding,
  expect,
  expectAccessible,
  expectNoHorizontalOverflow,
  registerAndVerify,
  test,
} from './support';

const API = `http://localhost:${process.env.E2E_API_PORT ?? 4000}/api/v1`;
const ROOT_EMAIL = process.env.E2E_ROOT_EMAIL;
const ROOT_PASSWORD = process.env.E2E_ROOT_PASSWORD;
const CV = path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf');
const JD = `Acme Tech tuyển Senior Frontend Engineer làm sản phẩm thương mại điện tử.
Yêu cầu: 5+ năm React và TypeScript, kinh nghiệm GraphQL, kiểm thử tự động với Playwright, làm việc nhóm tốt.`;

const DESKTOP = { width: 1280, height: 720 };
/** The narrowest phones in use (320px): if a page fits there, it fits wider phones too. */
const PHONE = { width: 320, height: 700 };

/**
 * @description Opens a page in light and dark mode (the app follows the OS theme until one is chosen) and scans
 * each with axe once its content has loaded; then once more at phone width, where it must not overflow sideways.
 */
async function scan(page: Page, url: string, label: string) {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    await page.waitForLoadState('networkidle');
    await expectAccessible(page, `${label} · ${colorScheme}`);
  }
  await page.setViewportSize(PHONE);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await expectNoHorizontalOverflow(page, `${label} · phone`);
  await expectAccessible(page, `${label} · phone`);
  await page.setViewportSize(DESKTOP);
}

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  test('public pages, with and without form errors', async ({ page }) => {
    for (const [url, label] of [
      ['/vi', 'landing'],
      ['/vi/login', 'login'],
      ['/vi/register', 'register'],
      ['/vi/forgot-password', 'forgot password'],
      ['/en/login', 'login (en)'],
    ] as const) {
      await scan(page, url, label);
    }
    await page.goto('/vi/register');
    await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expectAccessible(page, 'register with errors');
  });

  test('user pages', async ({ page }) => {
    test.slow();
    await registerAndVerify(page, 'Minh A11y');
    await scan(page, '/vi/onboarding', 'onboarding');
    await page.emulateMedia({ colorScheme: 'light' });
    await completeOnboarding(page);

    // Data for the detail pages, created through the API with the page's session cookies.
    const api = page.request;
    const upload = await api.post(`${API}/resumes`, {
      multipart: { file: { name: 'cv.pdf', mimeType: 'application/pdf', buffer: await readFile(CV) } },
    });
    const resume = await upload.json();
    await expect
      .poll(async () => (await (await api.get(`${API}/resumes/${resume.id}`)).json()).status, {
        timeout: 15_000,
      })
      .toBe('COMPLETED');
    const analysis = await (
      await api.post(`${API}/analyses`, { data: { resumeId: resume.id, jobDescription: JD, locale: 'vi' } })
    ).json();
    await expect
      .poll(async () => (await (await api.get(`${API}/analyses/${analysis.id}`)).json()).status, {
        timeout: 15_000,
      })
      .toBe('COMPLETED');
    const application = await (
      await api.post(`${API}/applications`, {
        data: { analysisId: analysis.id, company: 'Acme', jobTitle: 'Frontend' },
      })
    ).json();
    const interview = await (
      await api.post(`${API}/interviews`, {
        data: {
          applicationId: application.id,
          jobTitle: 'Frontend',
          type: 'MIXED',
          questionCount: 3,
          locale: 'vi',
        },
      })
    ).json();
    await api.post(`${API}/knowledge/text`, { data: { title: 'Dự án GraphQL', content: JD } });

    for (const [url, label] of [
      ['/vi/dashboard', 'dashboard'],
      ['/vi/analyses', 'analyses'],
      [`/vi/analyses/${analysis.id}`, 'analysis result'],
      ['/vi/applications', 'application board'],
      [`/vi/applications/${application.id}`, 'application detail'],
      ['/vi/interviews', 'interviews'],
      [`/vi/interviews/${interview.id}`, 'interview'],
      ['/vi/documents', 'documents'],
      ['/vi/profile', 'profile'],
      ['/vi/settings', 'settings'],
    ] as const) {
      await scan(page, url, label);
    }
    // The phone menu, open, in both themes.
    await page.setViewportSize(PHONE);
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/vi/dashboard');
      await page.getByRole('button', { name: 'Mở menu' }).click();
      await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible();
      await expectAccessible(page, `phone menu · ${colorScheme}`);
    }
    await page.setViewportSize(DESKTOP);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/vi/settings');
    await page.getByRole('button', { name: 'Xoá tài khoản' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xoá vĩnh viễn' }).click();
    await expect(page.getByRole('dialog').getByText('Vui lòng nhập thông tin này.')).toBeVisible();
    await expectAccessible(page, 'delete account dialog with error');
  });

  test('admin pages', async ({ page }) => {
    test.skip(!ROOT_EMAIL || !ROOT_PASSWORD, 'Set E2E_ROOT_EMAIL / E2E_ROOT_PASSWORD (test database root)');
    await page.goto('/vi/login');
    await page.getByLabel('Email').fill(ROOT_EMAIL!);
    await page.getByLabel(/^Mật khẩu\*?$/).fill(ROOT_PASSWORD!);
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard$/);

    for (const [url, label] of [
      ['/vi/admin', 'admin overview'],
      ['/vi/admin/users', 'admin users'],
      ['/vi/admin/industries', 'admin industries'],
      ['/vi/admin/admins', 'admin invitations'],
    ] as const) {
      await scan(page, url, label);
    }
    await page.goto('/vi/admin/users');
    await page.getByRole('row').nth(1).getByRole('link').click();
    await expect(page).toHaveURL(/\/vi\/admin\/users\/.+/);
    await scan(page, page.url(), 'admin user detail');
  });
});
