import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test as base } from '@playwright/test';

const MAILPIT = 'http://localhost:8025/api/v1';

/**
 * @description Polls Mailpit for the newest email sent to `to` and returns its link with a token.
 * @param to - Recipient address.
 * @param pathPart - Text the link must contain (e.g. `/reset-password`), to wait for a specific email.
 * @returns Absolute URL from the email.
 */
export async function linkFromEmail(to: string, pathPart = 'token='): Promise<string> {
  let link: string | undefined;
  await expect
    .poll(
      async () => {
        const search = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${to}"`)}`).then((r) =>
          r.json(),
        );
        const id: string | undefined = search.messages?.[0]?.ID;
        if (!id) return undefined;
        const message = await fetch(`${MAILPIT}/message/${id}`).then((r) => r.json());
        link = (message.Text as string).match(/https?:\/\/\S+token=[\w-]+/)?.[0];
        return link?.includes(pathPart) ? link : undefined;
      },
      { message: `email to ${to}`, timeout: 15_000 },
    )
    .toBeTruthy();
  return link!;
}

/** A unique address per run so tests can use the dev database repeatedly. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@example.com`;
}

/**
 * Fails any test that logs a console error or an uncaught exception — e.g. React warnings such as
 * "Encountered a script tag…" or hydration mismatches.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        // Expected: the browser logs failed requests (e.g. 401 from /auth/me before refreshing).
        if (message.type() === 'error' && !/Failed to load resource/.test(message.text()))
          errors.push(message.text());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await use(errors);
      expect(errors, 'console errors').toEqual([]);
    },
    { auto: true },
  ],
});

/**
 * @description Registers through the UI and returns the email used.
 */
export async function registerThroughUi(
  page: Page,
  fullName = 'Trần Minh',
  password = 'leap2026',
): Promise<string> {
  const email = uniqueEmail('e2e');
  await page.goto('/vi/register');
  await page.getByLabel('Họ và tên').fill(fullName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Mật khẩu\*?$/).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByText('Kiểm tra hộp thư của bạn')).toBeVisible();
  return email;
}

export { expect };

/**
 * @description Registers through the UI, follows the verification email and lands on the onboarding wizard.
 * @returns The account email.
 */
export async function registerAndVerify(page: Page, fullName = 'Trần Minh'): Promise<string> {
  const email = await registerThroughUi(page, fullName);
  await page.goto(await linkFromEmail(email, '/verify-email'));
  await expect(page).toHaveURL(/\/vi\/onboarding$/);
  return email;
}

/**
 * @description Fills every onboarding step with valid data and finishes on the dashboard.
 */
export async function completeOnboarding(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Bỏ qua, tự nhập' }).click();
  // The wizard focuses the new step's title; typing before that would lose focus and close the list.
  await expect(page.getByRole('heading', { name: 'Thông tin cá nhân' })).toBeFocused();
  await page.getByRole('combobox', { name: /Tỉnh\/thành phố/ }).fill('ha noi');
  await page.getByRole('option', { name: 'Hà Nội' }).click();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByRole('heading', { name: 'Kinh nghiệm và kỹ năng' })).toBeFocused();

  await page.getByRole('combobox', { name: /Ngành nghề/ }).fill('phan mem');
  await page.getByRole('option', { name: 'Công nghệ thông tin / Phần mềm' }).click();
  await page.getByLabel(/^Vị trí hiện tại/).fill('Frontend Developer');
  await page.getByLabel(/^Cấp bậc/).selectOption('SENIOR');
  await page.getByLabel(/^Số năm kinh nghiệm/).fill('6');
  await page.getByLabel(/^Kỹ năng/).fill('React');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect(page.getByRole('heading', { name: 'Công việc mong muốn' })).toBeFocused();

  await page.getByLabel('Từ xa').check();
  await page.getByRole('button', { name: 'Tiếp tục' }).click();

  await page.getByRole('button', { name: 'Hoàn tất' }).click();
  await expect(page).toHaveURL(/\/vi\/dashboard$/);
}

/** WCAG 2.2 A and AA rules — the level the app aims for. */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/**
 * @description Runs axe on the page as it is now and fails with a readable list (rule, impact, elements) when it
 * finds WCAG A/AA violations. Call it after the content you want checked is visible.
 * @param page - Page to scan.
 * @param label - What is being checked, shown in the failure message (e.g. "dashboard · dark").
 */
export async function expectAccessible(page: Page, label: string): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const report = violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.help}\n` +
      violation.nodes
        .slice(0, 5)
        .map(
          (node) => `    ${node.target.join(' ')} — ${node.failureSummary?.split('\n').slice(1).join(' ')}`,
        )
        .join('\n'),
  );
  // Soft: one run reports every page that fails, not just the first.
  expect.soft(report, `accessibility violations on ${label}`).toEqual([]);
}
