import type { Locale } from '@offerleap/shared';

export const MAIL_QUEUE = 'mail';

/** Every email the app can send. The processor renders the template for `locale`. */
export type MailJob =
  | { template: 'verify-email'; to: string; locale: Locale; fullName: string; link: string }
  | { template: 'reset-password'; to: string; locale: Locale; fullName: string; link: string }
  /** `fullName` is the inviting admin. */
  | { template: 'admin-invitation'; to: string; locale: Locale; fullName: string; link: string }
  /** After sign-up, once the account is ready (email verified, or created with Google); `link` opens onboarding. */
  | { template: 'welcome'; to: string; locale: Locale; fullName: string; link: string }
  /** Someone tried to sign up with a verified account's email; `link` opens the forgot-password page. */
  | { template: 'account-exists'; to: string; locale: Locale; fullName: string; link: string }
  /** Security notice after a Google account was linked; `link` opens the settings page. */
  | { template: 'google-linked'; to: string; locale: Locale; fullName: string; link: string };

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}
