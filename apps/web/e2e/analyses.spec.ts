import path from 'node:path';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

const JD = `Acme Tech tuyển Senior Frontend Engineer.
Yêu cầu: 5+ năm React và TypeScript, GraphQL, kiểm thử với Playwright.
Ưu tiên: Next.js, design system.`;

test.describe('CV ↔ job analysis', () => {
  test('uploads a CV, analyses a job description and keeps the result in the history', async ({ page }) => {
    await registerAndVerify(page, 'Minh Analysis');
    await completeOnboarding(page);

    // Dashboard → analyses through the navigation.
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .first()
      .getByRole('link', { name: 'Phân tích CV' })
      .click();
    await expect(page).toHaveURL(/\/vi\/analyses$/);
    await expect(page.getByText('Chưa có phân tích nào. Kết quả sẽ xuất hiện ở đây.')).toBeVisible();

    // No CV yet (onboarding was skipped): upload one right in the form.
    await page
      .getByLabel(/Kéo thả CV/)
      .setInputFiles(path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf'));
    await expect(page.getByLabel(/^CV dùng để phân tích/)).toHaveValue(/.+/);

    await page.getByLabel(/^Mô tả công việc/).fill(JD);
    await page.getByRole('button', { name: 'Phân tích' }).click();

    // The API runs with AI_PROVIDER=mock: a fixed result arrives almost at once.
    await expect(page).toHaveURL(/\/vi\/analyses\/[a-z0-9]+$/);
    await expect(page.getByRole('meter', { name: 'Mức độ phù hợp' })).toHaveAttribute('aria-valuenow', '72');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior Frontend Engineer · Acme Tech');
    await expect(page.getByText('GraphQL · Bắt buộc')).toBeVisible();

    // History and dashboard list it.
    await page.getByRole('link', { name: 'Tất cả phân tích' }).click();
    await expect(page.getByRole('link', { name: /Senior Frontend Engineer · Acme Tech/ })).toBeVisible();
    await page.getByRole('link', { name: 'Tổng quan' }).first().click();
    await expect(page.getByRole('heading', { name: 'Xin chào, Minh Analysis!' })).toBeVisible();
    await page.getByRole('link', { name: /Senior Frontend Engineer · Acme Tech/ }).click();

    // Delete after confirming.
    await page.getByRole('button', { name: 'Xoá' }).click();
    await page
      .getByRole('dialog', { name: 'Xoá phân tích này?' })
      .getByRole('button', { name: 'Xoá' })
      .click();
    await expect(page).toHaveURL(/\/vi\/analyses$/);
    await expect(page.getByText('Chưa có phân tích nào. Kết quả sẽ xuất hiện ở đây.')).toBeVisible();
  });

  test('is only for signed-in users', async ({ page }) => {
    await page.goto('/vi/analyses');
    await expect(page).toHaveURL(/\/vi\/login\?next=%2Fanalyses$/);
  });
});
