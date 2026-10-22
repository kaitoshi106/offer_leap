import path from 'node:path';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

const JD = `Acme Tech tuyển Senior Frontend Engineer.
Yêu cầu: 5+ năm React và TypeScript, GraphQL, kiểm thử với Playwright.
Ưu tiên: Next.js, design system.`;

test.describe('applications', () => {
  test('tracks an application on the board and writes its cover letter', async ({ page }) => {
    await registerAndVerify(page, 'Minh Board');
    await completeOnboarding(page);
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .first()
      .getByRole('link', { name: 'Ứng tuyển' })
      .click();
    await expect(page).toHaveURL(/\/vi\/applications$/);

    // Add a card.
    await page.getByRole('button', { name: 'Thêm ứng tuyển' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm ứng tuyển' });
    await dialog.getByLabel(/^Công ty/).fill('Acme Tech');
    await dialog.getByLabel(/^Vị trí/).fill('Senior Frontend Engineer');
    await dialog.getByLabel(/^Mô tả công việc/).fill(JD);
    await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
    await expect(page.getByText('Đã thêm vào bảng ứng tuyển')).toBeVisible();
    const saved = page.getByRole('region', { name: /Đã lưu/ });
    await expect(
      saved.getByRole('link', { name: 'Mở Senior Frontend Engineer tại Acme Tech' }),
    ).toBeVisible();

    // Move with the select (keyboard / touch path), then by drag and drop.
    await page.getByLabel('Chuyển Senior Frontend Engineer tại Acme Tech sang cột').selectOption('APPLIED');
    const applied = page.getByRole('region', { name: /Đã nộp/ });
    await expect(applied.getByRole('link', { name: /Senior Frontend Engineer/ })).toBeVisible();
    await page.reload();
    await expect(applied.getByRole('link', { name: /Senior Frontend Engineer/ })).toBeVisible();

    const interview = page.getByRole('region', { name: /Phỏng vấn/ });
    // A real mouse drag: a full copy of the card follows the pointer, then lands in the column.
    const from = (await applied.getByRole('listitem').first().boundingBox())!;
    const to = (await interview.getByRole('list').boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + 20);
    await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 });
    const overlay = page.locator('[data-drag-overlay]');
    await expect(overlay).toBeVisible();
    await expect(overlay).toContainText('Senior Frontend Engineer');
    await page.mouse.up();
    await expect(overlay).toHaveCount(0);
    await expect(interview.getByRole('link', { name: /Senior Frontend Engineer/ })).toBeVisible();
    // Dropping didn't open the card (the link under the pointer ignores the drag's click).
    await expect(page).toHaveURL(/\/vi\/applications$/);
    await expect(page.getByRole('status').filter({ hasText: 'Đã chuyển' })).toHaveText(
      'Đã chuyển Senior Frontend Engineer sang cột Phỏng vấn.',
    );

    // Cover letter, streamed by the mock AI.
    await interview.getByRole('link', { name: /Senior Frontend Engineer/ }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Senior Frontend Engineer · Acme Tech');
    await page.getByRole('button', { name: 'Viết bằng AI' }).click();
    const letter = page.getByRole('textbox', { name: 'Nội dung cover letter' });
    await expect(letter).toHaveValue(/^Dear Hiring Team,[\s\S]*Nguyễn Văn An$/);

    // Saved by the API: still there after a reload, and the card shows it.
    await page.reload();
    await expect(letter).toHaveValue(/^Dear Hiring Team,/);
    await page.getByRole('link', { name: 'Bảng ứng tuyển' }).click();
    await expect(interview.getByText('Đã có cover letter')).toBeVisible();
  });

  test('saves an analysed job to the board', async ({ page }) => {
    await registerAndVerify(page, 'Minh Save');
    await completeOnboarding(page);

    await page.goto('/vi/analyses');
    await page
      .getByLabel(/Kéo thả CV/)
      .setInputFiles(path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf'));
    await expect(page.getByLabel(/^CV dùng để phân tích/)).toHaveValue(/.+/);
    await page.getByLabel(/^Mô tả công việc/).fill(JD);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    await expect(page.getByRole('meter')).toBeVisible();

    await page.getByRole('button', { name: 'Lưu vào bảng ứng tuyển' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm ứng tuyển' });
    await expect(dialog.getByLabel(/^Công ty/)).toHaveValue('Acme Tech');
    await expect(dialog.getByLabel(/^Vị trí/)).toHaveValue('Senior Frontend Engineer');
    await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();

    await expect(page).toHaveURL(/\/vi\/applications\/[a-z0-9]+$/);
    await expect(page.getByRole('link', { name: 'Xem phân tích (72 điểm)' })).toBeVisible();
    // The job description came from the analysis, so a cover letter can be written right away.
    await expect(page.getByRole('button', { name: 'Viết bằng AI' })).toBeEnabled();
  });
});
