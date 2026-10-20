import path from 'node:path';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

const NOTE = `Dự án GraphQL cho sàn thương mại điện tử: xây dựng API GraphQL với Apollo bằng React và TypeScript,
kiểm thử end-to-end với Playwright cho luồng thanh toán.`;
const JD = `Acme Tech tuyển Senior Frontend Engineer.
Yêu cầu: 5+ năm React và TypeScript, GraphQL, kiểm thử với Playwright.`;

test.describe('personal documents (RAG)', () => {
  test('adds a note, finds it by meaning and uses it in an analysis', async ({ page }) => {
    await registerAndVerify(page, 'Minh RAG');
    await completeOnboarding(page);

    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .first()
      .getByRole('link', { name: 'Tài liệu' })
      .click();
    await expect(page).toHaveURL(/\/vi\/documents$/);
    await page.getByLabel(/^Tiêu đề/).fill('Dự án GraphQL');
    await page.getByLabel(/^Nội dung\*?$/).fill(NOTE);
    await page.getByRole('button', { name: 'Lưu tài liệu' }).click();
    const item = page.getByRole('listitem').filter({ hasText: 'Dự án GraphQL' });
    // Processed in the background (mock embeddings in tests); the list refreshes itself.
    await expect(item.getByText('Sẵn sàng')).toBeVisible({ timeout: 15_000 });

    await page.getByLabel('Nội dung tìm kiếm').fill('kinh nghiệm GraphQL Apollo');
    await page.getByRole('button', { name: 'Tìm' }).click();
    await expect(page.getByRole('status').getByText('Dự án GraphQL', { exact: true })).toBeVisible();

    // The analysis is given the note and lists it as a source.
    await page.goto('/vi/analyses');
    await page
      .getByLabel(/Kéo thả CV/)
      .setInputFiles(path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf'));
    await expect(page.getByLabel(/^CV dùng để phân tích/)).toHaveValue(/.+/);
    await page.getByLabel(/^Mô tả công việc/).fill(JD);
    await page.getByRole('button', { name: 'Phân tích' }).click();
    await expect(page.getByRole('meter')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tài liệu đã dùng' })).toBeVisible();
    await expect(page.getByText('Dự án GraphQL', { exact: true })).toBeVisible();
  });
});
