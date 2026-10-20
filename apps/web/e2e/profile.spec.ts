import path from 'node:path';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

test.describe('profile page', () => {
  test('edits a section and manages CVs', async ({ page }) => {
    await registerAndVerify(page, 'Minh Profile');
    await completeOnboarding(page);

    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .first()
      .getByRole('link', { name: 'Hồ sơ' })
      .click();
    await expect(page).toHaveURL(/\/vi\/profile$/);

    // Each section saves on its own and survives a reload.
    const career = page.getByRole('region', { name: 'Kinh nghiệm và kỹ năng' });
    await expect(career.getByLabel(/^Vị trí hiện tại/)).toHaveValue('Frontend Developer');
    await career.getByLabel(/^Vị trí hiện tại/).fill('Tech Lead');
    await career.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Đã lưu thay đổi')).toBeVisible();
    await page.reload();
    await expect(career.getByLabel(/^Vị trí hiện tại/)).toHaveValue('Tech Lead');

    // Upload a CV (read by the mock AI in the background), then delete it.
    const cvs = page.getByRole('region', { name: 'CV đã tải lên' });
    await expect(cvs.getByText('Chưa có CV nào.')).toBeVisible();
    await cvs
      .getByLabel(/Kéo thả CV/)
      .setInputFiles(path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf'));
    const item = cvs.getByRole('listitem').filter({ hasText: 'CV Nguyễn Văn An.pdf' });
    await expect(item.getByText('Đã đọc')).toBeVisible({ timeout: 15_000 });

    await item.getByRole('button', { name: /^Xoá/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('File CV sẽ bị xoá vĩnh viễn');
    await dialog.getByRole('button', { name: 'Xoá' }).click();
    await expect(page.getByText('Đã xoá CV')).toBeVisible();
    await expect(cvs.getByText('Chưa có CV nào.')).toBeVisible();
  });
});
