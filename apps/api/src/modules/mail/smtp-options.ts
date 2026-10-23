import type SMTPTransport from 'nodemailer/lib/smtp-transport';

/**
 * @description Nodemailer SMTP options. Port 465 speaks TLS from the first byte (`secure`); other ports (587,
 * 1025 for Mailpit) start in plain text and upgrade with STARTTLS when the server offers it. Credentials only when
 * a user is set (Mailpit needs none).
 * @param smtp - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD.
 */
export function smtpOptions(smtp: {
  host: string;
  port: number;
  user?: string;
  password?: string;
}): SMTPTransport.Options {
  return {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    ...(smtp.user && { auth: { user: smtp.user, pass: smtp.password } }),
  };
}
