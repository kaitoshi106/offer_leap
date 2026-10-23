import { ErrorCode } from '@offerleap/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { hashPassword } from '../src/common/security/hashing';
import { createTestApp, resetDatabase, type TestContext } from './support/test-app';

const PASSWORD = 'leap2026';
let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
});

afterAll(async () => {
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.mail.sent.length = 0;
});

const http = () => request(ctx.app.getHttpServer());
/** An agent keeps cookies between requests, like a browser. */
const browser = () => request.agent(ctx.app.getHttpServer());

/**
 * @description Registers and verifies an account through the API, returning a signed-in agent.
 */
async function signUp(email = 'minh@example.com') {
  const agent = browser();
  await agent
    .post('/api/v1/auth/register')
    .send({ email, password: PASSWORD, fullName: 'Trần Minh' })
    .expect(201);
  await agent
    .post('/api/v1/auth/verify-email')
    .send({ token: ctx.mail.lastToken(email, 'verify-email') })
    .expect(200);
  return agent;
}

/**
 * @description Reads a cookie value from a response's Set-Cookie headers.
 */
function cookie(response: request.Response, name: string): string | undefined {
  const header = ([] as string[]).concat(response.headers['set-cookie'] ?? []);
  return header.find((line) => line.startsWith(`${name}=`));
}

describe('register & verify email', () => {
  it('creates an unverified account and emails a link in the request language', async () => {
    await http()
      .post('/api/v1/auth/register')
      .set('Accept-Language', 'en-US,en;q=0.9')
      .send({ email: '  Minh@Example.com ', password: PASSWORD, fullName: 'Trần Minh' })
      .expect(201, { email: 'minh@example.com' });

    expect(ctx.mail.sent).toEqual([
      expect.objectContaining({ template: 'verify-email', to: 'minh@example.com', locale: 'en' }),
    ]);
    expect(ctx.mail.sent[0]?.link).toMatch(/^http:\/\/localhost:3000\/en\/verify-email\?token=/);
  });

  it('answers both of two simultaneous sign-ups for the same new email (a double click)', async () => {
    const send = () =>
      http()
        .post('/api/v1/auth/register')
        .send({ email: 'twice@example.com', password: PASSWORD, fullName: 'Minh' });
    const responses = await Promise.all([send(), send()]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await ctx.prisma.user.count({ where: { email: 'twice@example.com' } })).toBe(1);
  });

  it('rejects invalid input with translatable field errors', async () => {
    const response = await http()
      .post('/api/v1/auth/register')
      .send({ email: 'nope', password: 'short', fullName: 'Minh' })
      .expect(422);

    expect(response.body).toMatchObject({
      code: ErrorCode.COMMON_VALIDATION_FAILED,
      fieldErrors: [
        { field: 'email', rule: 'invalidEmail' },
        { field: 'password', rule: 'tooShort', params: { min: 8 } },
        { field: 'password', rule: 'weakPassword' },
      ],
    });
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('answers a sign-up for a verified email like any other, and emails the owner instead of revealing it', async () => {
    await signUp();
    ctx.mail.sent.length = 0;
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'minh@example.com', password: 'other2026', fullName: 'Someone' })
      .expect(201, { email: 'minh@example.com' });

    // The owner learns about it (with a way back in); nothing about the account changes.
    expect(ctx.mail.sent).toEqual([
      expect.objectContaining({ template: 'account-exists', to: 'minh@example.com', fullName: 'Trần Minh' }),
    ]);
    expect(ctx.mail.sent[0]?.link).toBe('http://localhost:3000/vi/forgot-password');
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: PASSWORD })
      .expect(200);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: 'other2026' })
      .expect(401);
  });

  it('cannot be claimed in advance: signing up again for an unverified email replaces the password', async () => {
    // Someone signs up first with the victim's email and a password of their choosing…
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'victim@example.com', password: 'attacker2026', fullName: 'Attacker' })
      .expect(201);
    // …then the owner signs up: same answer as a fresh sign-up, and only the newest link works.
    const firstLink = ctx.mail.lastToken('victim@example.com', 'verify-email');
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'victim@example.com', password: 'owner2026x', fullName: 'Owner' })
      .expect(201, { email: 'victim@example.com' });
    await http().post('/api/v1/auth/verify-email').send({ token: firstLink }).expect(400);

    const verified = await http()
      .post('/api/v1/auth/verify-email')
      .send({ token: ctx.mail.lastToken('victim@example.com', 'verify-email') })
      .expect(200);
    expect(verified.body.user.fullName).toBe('Owner');
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker2026' })
      .expect(401);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'victim@example.com', password: 'owner2026x' })
      .expect(200);
  });

  it('lets the inbox owner take over an unverified account with a password reset, which also verifies it', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'victim@example.com', password: 'attacker2026', fullName: 'Attacker' })
      .expect(201);
    await http().post('/api/v1/auth/forgot-password').send({ email: 'victim@example.com' }).expect(202);
    await http()
      .post('/api/v1/auth/reset-password')
      .send({ token: ctx.mail.lastToken('victim@example.com', 'reset-password'), password: 'owner2026x' })
      .expect(204);

    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker2026' })
      .expect(401);
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'victim@example.com', password: 'owner2026x' })
      .expect(200);
    expect(login.body.user.emailVerified).toBe(true);
  });

  it('does not reveal whether an email is verified when asked to resend the link', async () => {
    await signUp();
    ctx.mail.sent.length = 0;
    await http().post('/api/v1/auth/resend-verification').send({ email: 'minh@example.com' }).expect(202);
    await http().post('/api/v1/auth/resend-verification').send({ email: 'nobody@example.com' }).expect(202);
    expect(ctx.mail.sent).toEqual([]);
  });

  it('blocks login until the email is verified, then verification signs the user in', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.co', password: PASSWORD, fullName: 'Minh' });
    const blocked = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'a@b.co', password: PASSWORD })
      .expect(403);
    expect(blocked.body.code).toBe(ErrorCode.AUTH_EMAIL_NOT_VERIFIED);

    const agent = browser();
    const verified = await agent
      .post('/api/v1/auth/verify-email')
      .send({ token: ctx.mail.lastToken('a@b.co', 'verify-email') })
      .expect(200);

    expect(verified.body.user).toMatchObject({ email: 'a@b.co', emailVerified: true, role: 'USER' });
    expect(cookie(verified, 'ol_at')).toMatch(/HttpOnly/);
    expect(cookie(verified, 'ol_rt')).toMatch(/Path=\/api\/v1\/auth;.*HttpOnly/);
    expect(cookie(verified, 'ol_session')).toMatch(/^ol_session=1; Path=\/;/);
    await agent.get('/api/v1/auth/me').expect(200);
    // The account is ready: a welcome email points to onboarding.
    expect(ctx.mail.sent.findLast((mail) => mail.to === 'a@b.co')).toMatchObject({
      template: 'welcome',
      link: 'http://localhost:3000/vi/onboarding',
    });
  });

  it('does not sign in a disabled account from its verification link', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.co', password: PASSWORD, fullName: 'Minh' });
    // Disabled by an admin before the owner clicked the link.
    await ctx.prisma.user.update({ where: { email: 'a@b.co' }, data: { status: 'DISABLED' } });

    const response = await http()
      .post('/api/v1/auth/verify-email')
      .send({ token: ctx.mail.lastToken('a@b.co', 'verify-email') })
      .expect(423);
    expect(response.body.code).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);
    expect(cookie(response, 'ol_at')).toBeUndefined();
  });

  it('does not accept a verification token twice', async () => {
    await http()
      .post('/api/v1/auth/register')
      .send({ email: 'a@b.co', password: PASSWORD, fullName: 'Minh' });
    const token = ctx.mail.lastToken('a@b.co', 'verify-email');
    await http().post('/api/v1/auth/verify-email').send({ token }).expect(200);

    const again = await http().post('/api/v1/auth/verify-email').send({ token }).expect(400);
    expect(again.body.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    const welcomes = ctx.mail.sent.filter((mail) => mail.to === 'a@b.co' && mail.template === 'welcome');
    expect(welcomes).toHaveLength(1);
  });
});

describe('login & session', () => {
  it('returns the same error for a wrong password and an unknown email', async () => {
    await signUp();
    const wrongPassword = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: 'wrong123' })
      .expect(401);
    const unknownEmail = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@example.com', password: PASSWORD })
      .expect(401);

    expect(wrongPassword.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    expect(unknownEmail.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
  });

  it('requires authentication for /me', async () => {
    const response = await http().get('/api/v1/auth/me').expect(401);
    expect(response.body.code).toBe(ErrorCode.AUTH_UNAUTHENTICATED);
  });

  it('accepts the access token as a Bearer header too', async () => {
    await signUp();
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: PASSWORD });
    const accessToken = cookie(login, 'ol_at')?.split(';')[0]?.split('=')[1];

    await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`).expect(200);
  });

  it('rejects disabled accounts', async () => {
    await signUp();
    await ctx.prisma.user.update({ where: { email: 'minh@example.com' }, data: { status: 'DISABLED' } });

    const response = await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: PASSWORD })
      .expect(423);
    expect(response.body.code).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);
  });

  it('logout revokes the refresh token and clears cookies', async () => {
    const agent = await signUp();
    const logout = await agent.post('/api/v1/auth/logout').expect(204);

    expect(cookie(logout, 'ol_at')).toMatch(/Expires=Thu, 01 Jan 1970/);
    expect(cookie(logout, 'ol_session')).toMatch(/Expires=Thu, 01 Jan 1970/);
    await agent.post('/api/v1/auth/refresh').expect(401);
  });
});

describe('refresh token rotation', () => {
  it('issues a new refresh token on every refresh', async () => {
    const agent = await signUp();
    const first = await agent.post('/api/v1/auth/refresh').expect(200);
    const second = await agent.post('/api/v1/auth/refresh').expect(200);

    expect(cookie(first, 'ol_rt')).not.toBe(cookie(second, 'ol_rt'));
    expect(await ctx.prisma.refreshToken.count({ where: { revokedAt: null } })).toBe(1);
  });

  it('lets two tabs refresh at once: the one that loses is told to retry, and nobody is signed out', async () => {
    const agent = await signUp();
    const { body } = await agent.get('/api/v1/auth/me').expect(200);
    expect(body.email).toBe('minh@example.com');
    const [first, second] = await Promise.all([
      agent.post('/api/v1/auth/refresh'),
      agent.post('/api/v1/auth/refresh'),
    ]);
    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = first.status === 409 ? first : second;
    expect(loser.body.code).toBe(ErrorCode.AUTH_REFRESH_RACE);
    // The loser must not clear the cookies the winner just set.
    expect(loser.headers['set-cookie']).toBeUndefined();
    // The session is intact: refreshing again with the winner's cookie works.
    await agent.post('/api/v1/auth/refresh').expect(200);
  });

  it('revokes the whole session when an old refresh token is reused (theft)', async () => {
    const victim = await signUp();
    const stolen = await victim.post('/api/v1/auth/refresh').expect(200);
    const stolenToken = cookie(stolen, 'ol_rt')?.split(';')[0];

    // The victim keeps using the app: the stolen token gets rotated…
    await victim.post('/api/v1/auth/refresh').expect(200);
    // …and later (outside the multi-tab grace window) the thief replays it.
    await ctx.prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const replay = await http()
      .post('/api/v1/auth/refresh')
      .set('Cookie', stolenToken ?? '')
      .expect(400);

    expect(replay.body.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    // Everyone in that session family is signed out, including the victim's current token.
    await victim.post('/api/v1/auth/refresh').expect(400);
  });
});

describe('password reset & change', () => {
  it('resets the password from an emailed link and signs out every session', async () => {
    const oldSession = await signUp();
    await http().post('/api/v1/auth/forgot-password').send({ email: 'minh@example.com' }).expect(202);
    const token = ctx.mail.lastToken('minh@example.com', 'reset-password');

    await http().post('/api/v1/auth/reset-password').send({ token, password: 'newleap2026' }).expect(204);

    await oldSession.post('/api/v1/auth/refresh').expect(400);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: PASSWORD })
      .expect(401);
    await http()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: 'newleap2026' })
      .expect(200);
  });

  it('rejects reusing the current password without burning the reset link', async () => {
    await signUp();
    await http().post('/api/v1/auth/forgot-password').send({ email: 'minh@example.com' }).expect(202);
    const token = ctx.mail.lastToken('minh@example.com', 'reset-password');

    const same = await http()
      .post('/api/v1/auth/reset-password')
      .send({ token, password: PASSWORD })
      .expect(422);
    expect(same.body).toMatchObject({
      code: ErrorCode.COMMON_VALIDATION_FAILED,
      fieldErrors: [{ field: 'password', rule: 'sameAsCurrent' }],
    });

    // The same link still works with a different password.
    await http().post('/api/v1/auth/reset-password').send({ token, password: 'newleap2026' }).expect(204);
    await http().post('/api/v1/auth/reset-password').send({ token, password: 'other2026' }).expect(400);
  });

  it('answers forgot-password identically for unknown emails and sends nothing', async () => {
    await http().post('/api/v1/auth/forgot-password').send({ email: 'nobody@example.com' }).expect(202);
    expect(ctx.mail.sent).toHaveLength(0);
  });

  it('changes the password with the current one and keeps the caller signed in', async () => {
    const agent = await signUp();
    const wrong = await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'wrong123', newPassword: 'newleap2026' })
      .expect(401);
    expect(wrong.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);

    await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'newleap2026' })
      .expect(200);
    await agent.get('/api/v1/auth/me').expect(200);
    await agent.post('/api/v1/auth/refresh').expect(200);
  });
});

describe('root admin', () => {
  beforeEach(async () => {
    await ctx.prisma.user.create({
      data: {
        email: 'root@offerleap.local',
        passwordHash: await hashPassword('root-password-123'),
        fullName: 'Root',
        role: 'ADMIN',
        adminLevel: 'ROOT',
        emailVerifiedAt: new Date(),
      },
    });
  });

  it('cannot change its password in the app', async () => {
    const agent = browser();
    await agent
      .post('/api/v1/auth/login')
      .send({ email: 'root@offerleap.local', password: 'root-password-123' })
      .expect(200);

    const response = await agent
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: 'root-password-123', newPassword: 'another-pass-1' })
      .expect(403);
    expect(response.body.code).toBe(ErrorCode.AUTH_PASSWORD_CHANGE_NOT_ALLOWED);
  });

  it('never receives a password reset email', async () => {
    await http().post('/api/v1/auth/forgot-password').send({ email: 'root@offerleap.local' }).expect(202);
    expect(ctx.mail.sent).toHaveLength(0);
  });
});
