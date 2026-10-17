import { expect, registerAndVerify, test } from './support';

test.describe('onboarding', () => {
  test('is required, validates each step, resumes after a reload and unlocks the dashboard', async ({
    page,
  }) => {
    await registerAndVerify(page, 'Minh Onboarding');

    // The dashboard is off-limits until the profile is complete.
    await page.goto('/vi/dashboard');
    await expect(page).toHaveURL(/\/vi\/onboarding$/);
    await expect(page.getByRole('navigation', { name: 'Tiến độ hoàn thiện hồ sơ' })).toBeVisible();

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
});
