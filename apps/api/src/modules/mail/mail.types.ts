import type { Locale } from '@offerleap/shared';

export const MAIL_QUEUE = 'mail';

/** Every email the app can send. The processor renders the template for `locale`. */
export type MailJob =
  | { template: 'verify-email'; to: string; locale: Locale; fullName: string; link: string }
  | { template: 'reset-password'; to: string; locale: Locale; fullName: string; link: string }
  /** `fullName` is the inviting admin. */
  | { template: 'admin-invitation'; to: string; locale: Locale; fullName: string; link: string };

export interface RenderedMail {
  subject: string;
  text: string;
  html: string;
}
