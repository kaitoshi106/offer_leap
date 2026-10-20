import { APP_NAME, type Locale } from '@offerleap/shared';

import type { MailJob, RenderedMail } from './mail.types';

const COPY = {
  'verify-email': {
    vi: {
      subject: `Xác thực email của bạn – ${APP_NAME}`,
      greeting: (name: string) => `Chào ${name},`,
      body: 'Cảm ơn bạn đã đăng ký. Nhấn vào nút bên dưới để xác thực email. Liên kết có hiệu lực trong 24 giờ.',
      action: 'Xác thực email',
      ignore: 'Nếu bạn không đăng ký tài khoản, hãy bỏ qua email này.',
    },
    en: {
      subject: `Verify your email – ${APP_NAME}`,
      greeting: (name: string) => `Hi ${name},`,
      body: 'Thanks for signing up. Click the button below to verify your email. The link is valid for 24 hours.',
      action: 'Verify email',
      ignore: "If you didn't create an account, you can ignore this email.",
    },
  },
  'reset-password': {
    vi: {
      subject: `Đặt lại mật khẩu – ${APP_NAME}`,
      greeting: (name: string) => `Chào ${name},`,
      body: 'Chúng tôi nhận được yêu cầu đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút và chỉ dùng được một lần.',
      action: 'Đặt lại mật khẩu',
      ignore: 'Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu của bạn không thay đổi.',
    },
    en: {
      subject: `Reset your password – ${APP_NAME}`,
      greeting: (name: string) => `Hi ${name},`,
      body: 'We received a request to reset your password. The link is valid for 30 minutes and can be used once.',
      action: 'Reset password',
      ignore: "If you didn't ask for this, ignore this email — your password stays the same.",
    },
  },
  'admin-invitation': {
    vi: {
      subject: `Lời mời làm quản trị viên – ${APP_NAME}`,
      greeting: () => 'Xin chào,',
      body: (inviter: string) =>
        `${inviter} mời bạn trở thành quản trị viên của ${APP_NAME}. Nhấn vào nút bên dưới để tạo tài khoản. Liên kết có hiệu lực trong 48 giờ và chỉ dùng được một lần.`,
      action: 'Tạo tài khoản quản trị',
      ignore: 'Nếu bạn không mong đợi lời mời này, hãy bỏ qua email.',
    },
    en: {
      subject: `You're invited to be an admin – ${APP_NAME}`,
      greeting: () => 'Hello,',
      body: (inviter: string) =>
        `${inviter} invited you to become an admin of ${APP_NAME}. Click the button below to set up your account. The link is valid for 48 hours and can be used once.`,
      action: 'Set up admin account',
      ignore: "If you weren't expecting this invitation, you can ignore this email.",
    },
  },
} satisfies Record<MailJob['template'], Record<Locale, unknown>>;

/**
 * @description Escapes text placed inside HTML (user names are user input).
 * @param value - Raw text.
 * @returns HTML-safe text.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

/**
 * @description Renders an email in the recipient's language, as plain text and simple inline-styled HTML.
 * @param job - Template name and data.
 * @returns Subject, text and HTML bodies.
 */
export function renderMail(job: MailJob): RenderedMail {
  const copy = COPY[job.template][job.locale];
  const greeting = copy.greeting(job.fullName);
  // The invitation names the inviting admin in the body (escaped below: names are user input).
  const body = typeof copy.body === 'function' ? copy.body(job.fullName) : copy.body;

  const text = [greeting, '', body, '', job.link, '', copy.ignore].join('\n');
  const html = `<!doctype html>
<html lang="${job.locale}">
  <body style="margin:0;padding:24px;background:#f6f7fb;font-family:Roboto,Arial,sans-serif;color:#1f2330">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px">
      <tr><td>
        <p style="font-size:20px;font-weight:700;margin:0 0 24px">${APP_NAME}</p>
        <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 24px;line-height:1.5">${escapeHtml(body)}</p>
        <a href="${escapeHtml(job.link)}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${copy.action}</a>
        <p style="margin:24px 0 0;font-size:13px;color:#6b7080">${copy.ignore}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject: copy.subject, text, html };
}
