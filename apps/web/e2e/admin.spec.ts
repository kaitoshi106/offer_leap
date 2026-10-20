import type { Page } from '@playwright/test';

import { completeOnboarding, expect, linkFromEmail, registerAndVerify, test, uniqueEmail } from './support';

/**
 * Root credentials of the database the API under test uses. Never the real dev root: run the isolated API on the
 * test database, seeded with these values (see playwright.config.ts).
 */
const ROOT_EMAIL = process.env.E2E_ROOT_EMAIL;
const ROOT_PASSWORD = process.env.E2E_ROOT_PASSWORD;

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/vi/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Mật khẩu\*?$/).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

test.describe('admin console', () => {
  test.skip(!ROOT_EMAIL || !ROOT_PASSWORD, 'Set E2E_ROOT_EMAIL / E2E_ROOT_PASSWORD (test database root)');

  test('root invites a general admin who manages users', async ({ page, browser }) => {
    // Root: invite.
    await signIn(page, ROOT_EMAIL!, ROOT_PASSWORD!);
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
    // The admin entry is in the main navigation for admins only.
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .first()
      .getByRole('link', { name: 'Quản trị' })
      .click();
    await expect(page).toHaveURL(/\/vi\/admin\/users$/);
    await page
      .getByRole('navigation', { name: 'Mục quản trị' })
      .getByRole('link', { name: 'Quản trị viên' })
      .click();
    const adminEmail = uniqueEmail('admin');
    await page.getByLabel(/^Email người được mời/).fill(adminEmail);
    await page.getByRole('button', { name: 'Gửi lời mời' }).click();
    await expect(page.getByText(`Đã gửi lời mời tới ${adminEmail}`)).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: adminEmail })).toContainText('Đang chờ');

    // Invitee (separate browser, no session): set up the account from the email link.
    const inviteeContext = await browser.newContext({ locale: 'vi-VN' });
    const invitee = await inviteeContext.newPage();
    await invitee.goto(await linkFromEmail(adminEmail, '/admin-invite'));
    await expect(invitee.getByLabel('Email được mời')).toHaveValue(adminEmail);
    await invitee.getByLabel(/^Họ và tên/).fill('Lan Admin');
    await invitee.getByLabel(/^Mật khẩu/).fill('leap2026');
    await invitee.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(invitee).toHaveURL(/\/vi\/admin\/users$/);
    // General admins don't see the invitations tab.
    await expect(invitee.getByRole('link', { name: 'Quản trị viên' })).toHaveCount(0);

    // A user signs up; the general admin finds and disables the account.
    const userContext = await browser.newContext({ locale: 'vi-VN' });
    const userPage = await userContext.newPage();
    const userEmail = await registerAndVerify(userPage, 'Minh Locked');
    await invitee.getByLabel('Tìm theo email hoặc tên').fill(userEmail);
    // The search waits for typing to pause: wait until the list is narrowed to that one account.
    await expect(invitee.getByText('1 tài khoản')).toBeVisible();
    await invitee.getByRole('link', { name: 'Minh Locked' }).click();
    await invitee.getByRole('button', { name: 'Khoá tài khoản' }).click();
    await invitee.getByRole('dialog').getByRole('button', { name: 'Khoá tài khoản' }).click();
    await expect(invitee.getByText('Đã khoá tài khoản')).toBeVisible();

    await userPage.context().clearCookies();
    await signIn(userPage, userEmail, 'leap2026');
    await expect(userPage.getByRole('alert').filter({ hasText: 'khoá' })).toHaveText(
      'Tài khoản đang bị khoá. Vui lòng liên hệ quản trị viên.',
    );

    // Back in root's list the invitation is accepted.
    await page.reload();
    await expect(page.getByRole('listitem').filter({ hasText: adminEmail })).toContainText('Đã chấp nhận');
    await inviteeContext.close();
    await userContext.close();
  });
});

test.describe('account settings', () => {
  test('changes the password, then signs in with the new one', async ({ page }) => {
    const email = await registerAndVerify(page, 'Minh Settings');
    await completeOnboarding(page);

    await page.getByRole('link', { name: 'Cài đặt tài khoản' }).click();
    await expect(page).toHaveURL(/\/vi\/settings$/);
    await page.getByLabel(/^Mật khẩu hiện tại/).fill('leap2026');
    await page.getByLabel(/^Mật khẩu mới/).fill('leap2027');
    await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();
    await expect(page.getByText('Đã đổi mật khẩu')).toBeVisible();

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await signIn(page, email, 'leap2027');
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
  });
});
