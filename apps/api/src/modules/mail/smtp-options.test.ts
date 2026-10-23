import { describe, expect, it } from 'vitest';

import { smtpOptions } from './smtp-options';

describe('smtpOptions', () => {
  it('talks plain SMTP to the local inbox (Mailpit)', () => {
    expect(smtpOptions({ host: 'localhost', port: 1025 })).toEqual({
      host: 'localhost',
      port: 1025,
      secure: false,
    });
  });

  it('logs in to a real provider, upgrading to TLS on 587 and using TLS from the start on 465', () => {
    expect(smtpOptions({ host: 'smtp-relay.brevo.com', port: 587, user: 'me', password: 'key' })).toEqual({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: 'me', pass: 'key' },
    });
    expect(smtpOptions({ host: 'smtp.example.com', port: 465, user: 'me', password: 'key' }).secure).toBe(
      true,
    );
  });
});
