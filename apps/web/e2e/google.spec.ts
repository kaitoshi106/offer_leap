import type { Page } from '@playwright/test';

import { completeOnboarding, expect, test, uniqueEmail } from './support';

/**
 * The API under test runs `OAUTH_PROVIDER=mock` (NODE_ENV=test): "Google" signs in the account named by
 * `loginHint` without a Google page. The button's real URL is used, with the hint added.
 */
async function continueWithGoogle(page: Page, email: string) {
  const button = page.getByRole('link', { name: 'Tiếp tục với Google' });
  // Relative when the API is served from this site (`/api/v1`).
  const url = new URL((await button.getAttribute('href'))!, page.url());
  url.searchParams.set('loginHint', email);
  await page.goto(url.toString());
}

test.describe('sign in with Google', () => {
  test('signs up with Google, onboards, then deletes the account by confirming with Google', async ({
    page,
  }) => {
    const email = uniqueEmail('google');
    await page.goto('/vi/register');
    await continueWithGoogle(page, email);
    // No verification email: Google already verified the address.
    await expect(page).toHaveURL(/\/vi\/onboarding$/);
    await completeOnboarding(page);

    await page.goto('/vi/settings');
    await expect(page.getByText(`Đã liên kết với ${email}`)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gỡ liên kết' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Gửi email đặt mật khẩu' })).toBeVisible();

    // The confirmation is a fresh Google sign-in; the mock needs to know which account answers.
    await page.route('**/auth/google/delete?*', (route) =>
      route.continue({ url: `${route.request().url()}&loginHint=${encodeURIComponent(email)}` }),
    );
    await page.getByRole('button', { name: 'Xoá tài khoản' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận bằng Google' }).click();
    await expect(page).toHaveURL(/\/vi\/login\?deleted=1$/);
    await expect(page.getByText(/Tài khoản của bạn đã được xoá/)).toBeVisible();
  });

  test('explains why an admin account is refused', async ({ page }) => {
    const rootEmail = process.env.E2E_ROOT_EMAIL;
    test.skip(!rootEmail, 'Set E2E_ROOT_EMAIL (test database root)');
    await page.goto('/vi/login');
    await continueWithGoogle(page, rootEmail!);
    await expect(page).toHaveURL(/\/vi\/login\?error=AUTH_OAUTH_NOT_ALLOWED$/);
    await expect(page.getByText('Tài khoản quản trị chỉ đăng nhập bằng email và mật khẩu.')).toBeVisible();
  });
});
