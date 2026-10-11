import { expect, type Page, test as base } from '@playwright/test';

const MAILPIT = 'http://localhost:8025/api/v1';

/**
 * @description Polls Mailpit for the newest email sent to `to` and returns the first link with a token.
 * @param to - Recipient address.
 * @returns Absolute URL from the email.
 */
export async function linkFromEmail(to: string): Promise<string> {
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
        return link;
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
