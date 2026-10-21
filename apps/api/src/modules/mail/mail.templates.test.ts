import { describe, expect, it } from 'vitest';

import { renderMail } from './mail.templates';

describe('renderMail', () => {
  it('renders the verification email in the recipient language', () => {
    const vi = renderMail({
      template: 'verify-email',
      to: 'a@b.co',
      locale: 'vi',
      fullName: 'Minh',
      link: 'https://x/vi/verify-email?token=t',
    });
    const en = renderMail({
      ...{ template: 'verify-email', to: 'a@b.co', fullName: 'Minh', link: 'https://x' },
      locale: 'en',
    });

    expect(vi.subject).toContain('Xác thực email');
    expect(vi.text).toContain('https://x/vi/verify-email?token=t');
    expect(en.subject).toContain('Verify your email');
  });

  it('escapes user-provided names in HTML', () => {
    const mail = renderMail({
      template: 'reset-password',
      to: 'a@b.co',
      locale: 'en',
      fullName: '<script>x</script>',
      link: 'https://x',
    });
    expect(mail.html).not.toContain('<script>x');
    expect(mail.html).toContain('&#60;script&#62;');
  });

  it('warns about a newly linked Google account with a way to undo it', () => {
    const mail = renderMail({
      template: 'google-linked',
      to: 'a@b.co',
      locale: 'vi',
      fullName: 'Minh',
      link: 'https://x/vi/settings',
    });
    expect(mail.subject).toContain('Đã liên kết tài khoản Google');
    expect(mail.text).toContain('gỡ liên kết Google');
    expect(mail.text).toContain('https://x/vi/settings');
  });
});
