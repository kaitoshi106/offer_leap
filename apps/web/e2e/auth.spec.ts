import { expect, linkFromEmail, registerThroughUi, test } from './support';

test.describe('authentication', () => {
  test('register → verify email → dashboard → sign out', async ({ page }) => {
    const email = await registerThroughUi(page);

    const link = await linkFromEmail(email);
    expect(link).toContain('/vi/verify-email?token=');
    await page.goto(link);

    await expect(page).toHaveURL(/\/vi\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Xin chào, Trần Minh!' })).toBeVisible();
    await expect(page.getByText(email)).toBeVisible();

    // The session survives a reload (cookies + /auth/me).
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Xin chào, Trần Minh!' })).toBeVisible();

    // Signed-in users are sent away from guest pages.
    await page.goto('/vi/login');
    await expect(page).toHaveURL(/\/vi\/dashboard$/);

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/vi\/login$/);
    await page.goto('/vi/dashboard');
    await expect(page).toHaveURL(/\/vi\/login\?next=%2Fdashboard$/);
  });

  test('sign in with validation, wrong password and redirect back', async ({ page }) => {
    const email = await registerThroughUi(page, 'Minh Login');
    await page.goto(await linkFromEmail(email));
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/vi\/login$/);

    // Protected page → login with ?next
    await page.goto('/vi/dashboard');
    await expect(page).toHaveURL(/next=%2Fdashboard/);

    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByText('Vui lòng nhập thông tin này.').first()).toBeVisible();

    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/^Mật khẩu\*?$/).fill('wrong-password-1');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Email hoặc' })).toHaveText(
      'Email hoặc mật khẩu không đúng.',
    );

    await page.getByLabel(/^Mật khẩu\*?$/).fill('leap2026');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
  });

  test('forgot password always confirms without revealing accounts', async ({ page }) => {
    await page.goto('/vi/forgot-password');
    await page.getByLabel('Email').fill('nobody@example.com');
    await page.getByRole('button', { name: 'Gửi liên kết' }).click();
    await expect(page.getByText('Đã gửi yêu cầu')).toBeVisible();
  });

  test('an invalid verification link offers a new one', async ({ page }) => {
    await page.goto('/vi/verify-email?token=this-token-does-not-exist-123');
    // Next.js renders its own (empty) route announcer with role=alert, so filter by text.
    await expect(page.getByRole('alert').filter({ hasText: 'Liên kết' })).toHaveText(
      'Liên kết không hợp lệ.',
    );
    await expect(page.getByRole('button', { name: 'Gửi lại email' })).toBeVisible();
  });
});

test.describe('app shell', () => {
  test('switches language on auth pages without console errors', async ({ page }) => {
    await page.goto('/vi/login');
    await page.getByRole('link', { name: 'Switch to English' }).click();
    await expect(page).toHaveURL(/\/en\/login$/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('keeps the chosen theme after a reload', async ({ page }) => {
    await page.goto('/vi');
    await page.getByRole('button', { name: /^Giao diện:/ }).click(); // system → light
    await page.getByRole('button', { name: /^Giao diện:/ }).click(); // light → dark
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
