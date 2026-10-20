import { completeOnboarding, expect, registerAndVerify, test } from './support';

test.describe('mock interviews', () => {
  test('practises for a saved application: answer, skip, summary', async ({ page }) => {
    await registerAndVerify(page, 'Minh Interview');
    await completeOnboarding(page);

    // A saved application with its job description.
    await page.goto('/vi/applications');
    await page.getByRole('button', { name: 'Thêm ứng tuyển' }).click();
    const dialog = page.getByRole('dialog', { name: 'Thêm ứng tuyển' });
    await dialog.getByLabel(/^Công ty/).fill('Acme Tech');
    await dialog.getByLabel(/^Vị trí/).fill('Senior Frontend Engineer');
    await dialog.getByLabel(/^Mô tả công việc/).fill('React, TypeScript, performance and testing.');
    await dialog.getByRole('button', { name: 'Thêm', exact: true }).click();
    await page.getByRole('link', { name: /Mở Senior Frontend Engineer/ }).click();

    // Practise from the application: the form is preselected.
    await page.getByRole('link', { name: 'Luyện phỏng vấn' }).click();
    await expect(page).toHaveURL(/\/vi\/interviews\?applicationId=/);
    await expect(page.getByLabel(/^Vị trí ứng tuyển/)).toHaveValue('Senior Frontend Engineer');
    await page.getByLabel('Số câu hỏi').selectOption('3');
    await page.getByRole('button', { name: 'Bắt đầu phỏng vấn' }).click();

    // The mock AI writes the questions; only the first is shown.
    await expect(page).toHaveURL(/\/vi\/interviews\/[a-z0-9]+$/);
    await expect(page.getByRole('heading', { name: 'Câu 1/3' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Câu 2/3' })).toHaveCount(0);

    await page.getByLabel('Câu trả lời của bạn').fill('Mình từng dẫn dắt việc chuyển ứng dụng sang Next.js.');
    await page.getByRole('button', { name: 'Gửi câu trả lời' }).click();
    await expect(page.getByText('7/10 điểm')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Câu 2/3' })).toBeFocused();

    await page.getByRole('button', { name: 'Bỏ qua' }).click();
    await expect(page.getByText('Đã bỏ qua câu này.')).toBeVisible();
    await page.getByLabel('Câu trả lời của bạn').fill('Mình đo trước bằng Profiler rồi mới tối ưu.');
    await page.getByRole('button', { name: 'Gửi câu trả lời' }).click();

    await page.getByRole('button', { name: 'Xem tổng kết' }).click();
    await expect(page.getByRole('meter', { name: 'Mức sẵn sàng' })).toHaveAttribute('aria-valuenow', '68');
    await expect(page.getByLabel('Câu trả lời của bạn')).toHaveCount(0);

    // A reload shows the same finished conversation; the history lists it.
    await page.reload();
    await expect(page.getByText('Đã bỏ qua câu này.')).toBeVisible();
    await page.getByRole('link', { name: 'Tất cả buổi phỏng vấn' }).click();
    await expect(page.getByRole('link', { name: /Senior Frontend Engineer.*Đã xong/ })).toBeVisible();
  });
});
