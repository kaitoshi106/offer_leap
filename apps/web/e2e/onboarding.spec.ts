import path from 'node:path';

import { completeOnboarding, expect, registerAndVerify, test } from './support';

test.describe('onboarding', () => {
  test('is required, validates each step, resumes after a reload and unlocks the dashboard', async ({
    page,
  }) => {
    await registerAndVerify(page, 'Minh Onboarding');

    // The dashboard is off-limits until the profile is complete.
    await page.goto('/vi/dashboard');
    await expect(page).toHaveURL(/\/vi\/onboarding$/);
    await expect(page.getByRole('navigation', { name: 'Tiến độ hoàn thiện hồ sơ' })).toBeVisible();

    // The CV step is optional.
    await page.getByRole('button', { name: 'Bỏ qua, tự nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeFocused();

    // Step 1: validation, then accent-insensitive province search.
    await page.getByLabel(/^Số điện thoại/).fill('12345');
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByText('Số điện thoại không hợp lệ (VD: 0912345678).')).toBeVisible();
    await expect(page.getByText('Vui lòng nhập thông tin này.')).toBeVisible();

    await page.getByLabel(/^Số điện thoại/).fill('0912 345 678');
    const province = page.getByRole('combobox', { name: /Tỉnh\/thành phố/ });
    await province.fill('da nang');
    await expect(page.getByRole('option')).toHaveText(['Đà Nẵng']);
    await page.keyboard.press('Enter');
    await expect(province).toHaveValue('Đà Nẵng');
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByRole('heading', { name: 'Kinh nghiệm và kỹ năng' })).toBeFocused();

    // Reload: the saved draft resumes at step 2.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Kinh nghiệm và kỹ năng' })).toBeVisible();

    // Step 2
    await page.getByRole('combobox', { name: /Ngành nghề/ }).fill('du lieu');
    await page.getByRole('option', { name: 'Dữ liệu / Trí tuệ nhân tạo' }).click();
    await page.getByLabel(/^Vị trí hiện tại/).fill('Data Engineer');
    await page.getByLabel(/^Cấp bậc/).selectOption('MIDDLE');
    await page.getByLabel(/^Số năm kinh nghiệm/).fill('3');
    const skills = page.getByLabel(/^Kỹ năng/);
    await skills.fill('Python');
    await page.keyboard.press('Enter');
    await skills.fill('SQL,Airflow');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: /^Xoá / })).toHaveCount(2);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // Step 3: incoherent salary range is rejected.
    await page.getByLabel('Từ', { exact: true }).fill('50');
    await page.getByLabel('Đến', { exact: true }).fill('30');
    await page.getByLabel('Kết hợp').check();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByText('Mức tối đa phải lớn hơn hoặc bằng mức tối thiểu.')).toBeVisible();
    await page.getByLabel('Đến', { exact: true }).fill('70');
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // Review shows everything and allows editing a section.
    await expect(page.getByText('Đà Nẵng')).toBeVisible();
    await expect(page.getByText('50 – 70 triệu')).toBeVisible();
    await expect(page.getByText('3 năm')).toBeVisible();
    await page.getByRole('button', { name: 'Sửa' }).first().click();
    await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeFocused();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    await page.getByRole('button', { name: 'Hoàn tất' }).click();
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Xin chào, Minh Onboarding!' })).toBeVisible();

    // A finished profile can't reopen the wizard.
    await page.goto('/vi/onboarding');
    await expect(page).toHaveURL(/\/vi\/dashboard$/);
  });

  test('fills the next steps from an uploaded CV, replacing what was entered', async ({ page }) => {
    await registerAndVerify(page, 'Minh CV');

    // Fill step 1 by hand first, then go back and upload a CV.
    await page.getByRole('button', { name: 'Bỏ qua, tự nhập' }).click();
    await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeFocused();
    await page.getByLabel(/^Số điện thoại/).fill('0987 000 111');
    await page.getByRole('combobox', { name: /Tỉnh\/thành phố/ }).fill('da nang');
    await page.getByRole('option', { name: 'Đà Nẵng' }).click();
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByRole('heading', { name: 'Kinh nghiệm và kỹ năng' })).toBeFocused();
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByRole('button', { name: 'Quay lại' }).click();

    await page
      .getByLabel(/Kéo thả CV/)
      .setInputFiles(path.join(__dirname, 'fixtures', 'CV Nguyễn Văn An.pdf'));
    // The API runs with AI_PROVIDER=mock, so the "AI" answers instantly with a fixed profile.
    await expect(page.getByText('Đã đọc xong CV Nguyễn Văn An.pdf')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // Step 1: everything the CV contains replaced what was entered, and is marked.
    await expect(page.getByLabel(/^Họ và tên/)).toHaveValue('Nguyễn Văn An');
    await expect(page.getByLabel(/^Số điện thoại/)).toHaveValue('0912345678');
    await expect(page.getByLabel(/^Số điện thoại/)).toHaveAccessibleDescription(
      'AI chưa chắc chắn ở mục này — hãy kiểm tra lại.',
    );
    await expect(page.getByRole('combobox', { name: /Tỉnh\/thành phố/ })).toHaveValue('Hà Nội');
    await expect(page.getByText('AI gợi ý', { exact: true })).toHaveCount(3);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();

    // Step 2 is entirely pre-filled and valid as is.
    await expect(page.getByLabel(/^Vị trí hiện tại/)).toHaveValue('Frontend Developer');
    await expect(page.getByLabel(/^Cấp bậc/)).toHaveValue('SENIOR');
    await expect(page.getByRole('button', { name: /^Xoá / })).toHaveCount(5);
    await page.getByRole('button', { name: 'Tiếp tục' }).click();
    await expect(page.getByRole('heading', { name: 'Công việc mong muốn' })).toBeFocused();

    // Going back to the CV step shows the parsed result instead of the drop zone.
    await page.reload();
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await page.getByRole('button', { name: 'Quay lại' }).click();
    await expect(page.getByText('Đã đọc xong CV Nguyễn Văn An.pdf')).toBeVisible();
  });
});

test.describe('onboarding redirects happen on the server', () => {
  test('unfinished accounts are sent to onboarding and finished ones away from it, before any page renders', async ({
    page,
  }) => {
    await registerAndVerify(page, 'Minh Redirect');
    // Not followed: the answer itself must be the redirect (no page rendered first, then moved by the client).
    const visit = (path: string) => page.request.get(path, { maxRedirects: 0 });

    const early = await visit('/vi/dashboard');
    expect(early.status()).toBe(307);
    expect(early.headers().location).toMatch(/\/vi\/onboarding$/);

    await completeOnboarding(page);
    const late = await visit('/vi/onboarding');
    expect(late.status()).toBe(307);
    expect(late.headers().location).toMatch(/\/vi\/dashboard$/);
    expect((await visit('/vi/dashboard')).status()).toBe(200);
  });

  test('a session from before the flag existed gets it on its first page', async ({ page, context }) => {
    await registerAndVerify(page, 'Minh Old Session');
    await completeOnboarding(page);
    // As if the session had been started before the flag cookie existed.
    await context.clearCookies({ name: 'ol_onboarding' });
    const visit = (path: string) => page.request.get(path, { maxRedirects: 0 });
    expect((await visit('/vi/onboarding')).status()).toBe(200); // unknown: the page decides

    // Any app page asks the API for /auth/me, which sets the flag again…
    await page.goto('/vi/dashboard');
    await page.waitForLoadState('networkidle');
    // …so from now on the server redirects before rendering.
    const after = await visit('/vi/onboarding');
    expect(after.status()).toBe(307);
    expect(after.headers().location).toMatch(/\/vi\/dashboard$/);
  });
});
