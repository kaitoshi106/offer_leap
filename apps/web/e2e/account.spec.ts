import { readFile } from 'node:fs/promises';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

test.describe('account data', () => {
  test('downloads the data, then deletes the account', async ({ page }) => {
    const email = await registerAndVerify(page, 'Minh Leaving');
    await completeOnboarding(page);
    await page.goto('/vi/settings');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải dữ liệu (JSON)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^offerleap-export-\d{4}-\d{2}-\d{2}\.json$/);
    const data = JSON.parse(await readFile((await file.path())!, 'utf8'));
    expect(data).toMatchObject({ account: { email }, profile: { jobTitle: 'Frontend Developer' } });

    await page.getByRole('button', { name: 'Xoá tài khoản' }).click();
    const dialog = page.getByRole('dialog', { name: 'Xoá tài khoản vĩnh viễn?' });
    await dialog.getByLabel(/^Mật khẩu hiện tại/).fill('not-my-password');
    await dialog.getByRole('button', { name: 'Xoá vĩnh viễn' }).click();
    await expect(dialog.getByText('Mật khẩu không đúng.')).toBeVisible();

    await dialog.getByLabel(/^Mật khẩu hiện tại/).fill('leap2026');
    await dialog.getByRole('button', { name: 'Xoá vĩnh viễn' }).click();
    await expect(page).toHaveURL(/\/vi\/login\?deleted=1$/);
    await expect(page.getByText(/Tài khoản của bạn đã được xoá/)).toBeVisible();

    // The account is gone: signing in with it fails.
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Mật khẩu\*?$/).fill('leap2026');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Email hoặc mật khẩu không đúng.')).toBeVisible();
  });
});
