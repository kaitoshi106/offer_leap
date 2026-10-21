import { ErrorCode } from '@offerleap/shared';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  createTestApp,
  resetDatabase,
  seedTaxonomies,
  signInAdmin,
  signUpAndVerify,
  signUpOnboarded,
  type TestContext,
} from './support/test-app';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await createTestApp();
  await seedTaxonomies(ctx.prisma);
});

afterAll(async () => {
  await ctx.app.close();
});

beforeEach(async () => {
  await resetDatabase(ctx.prisma);
  ctx.mail.sent.length = 0;
});

type Agent = ReturnType<typeof request.agent>;
const newAgent = () => request.agent(ctx.app.getHttpServer());
const WEB = 'http://localhost:3000';

/**
 * @description Runs a whole Google flow with the mock provider: start (GET for sign-in, POST for account
 * actions) → the provider's redirect to the callback → the callback's redirect to the web app.
 * @returns The final web URL.
 */
async function googleFlow(
  agent: Agent,
  email: string,
  options: { intent?: 'login' | 'link' | 'delete'; next?: string } = {},
): Promise<URL> {
  const query = { loginHint: email, locale: 'vi', ...(options.next ? { next: options.next } : {}) };
  const start =
    !options.intent || options.intent === 'login'
      ? agent.get('/api/v1/auth/google').query(query)
      : agent.post(`/api/v1/auth/google/${options.intent}`).query(query);
  const toProvider = await start.expect(303);
  const callback = new URL(toProvider.headers.location!);
  const back = await agent.get(callback.pathname + callback.search).expect(302);
  return new URL(back.headers.location!);
}

const userByEmail = (email: string) =>
  ctx.prisma.user.findUnique({ where: { email }, include: { identities: true } });

describe('sign in with Google', () => {
  it('advertises the provider', async () => {
    const { body } = await newAgent().get('/api/v1/auth/providers').expect(200);
    expect(body).toEqual({ google: true });
  });

  it('creates a verified account without a password and sends it to onboarding', async () => {
    const agent = newAgent();
    const landing = await googleFlow(agent, 'lan.nguyen@gmail.com');
    expect(landing.toString()).toBe(`${WEB}/vi/onboarding`);
    expect(
      ctx.mail.sent.filter((mail) => mail.to === 'lan.nguyen@gmail.com').map((mail) => mail.template),
    ).toEqual(['welcome']);

    const { body: me } = await agent.get('/api/v1/auth/me').expect(200);
    expect(me).toMatchObject({
      email: 'lan.nguyen@gmail.com',
      emailVerified: true,
      onboardingCompleted: false,
    });
    const { body: methods } = await agent.get('/api/v1/auth/sign-in-methods').expect(200);
    expect(methods).toMatchObject({
      hasPassword: false,
      identities: [{ provider: 'GOOGLE', email: 'lan.nguyen@gmail.com' }],
    });

    // No password to guess, and signing in again finds the same account.
    const login = await newAgent()
      .post('/api/v1/auth/login')
      .send({ email: 'lan.nguyen@gmail.com', password: 'leap2026' })
      .expect(401);
    expect(login.body.code).toBe(ErrorCode.AUTH_INVALID_CREDENTIALS);
    await googleFlow(newAgent(), 'lan.nguyen@gmail.com');
    expect(await ctx.prisma.user.count()).toBe(1);
  });

  it('links a verified password account with the same email and tells the owner', async () => {
    await signUpAndVerify(ctx, 'minh@example.com');
    const agent = newAgent();
    expect((await googleFlow(agent, 'minh@example.com')).pathname).toBe('/vi/onboarding');

    const user = await userByEmail('minh@example.com');
    expect(user!.identities).toHaveLength(1);
    // Admins see both ways in.
    const admin = await signInAdmin(ctx, 'GENERAL');
    const { body: detail } = await admin.get(`/api/v1/admin/users/${user!.id}`).expect(200);
    expect(detail.signInMethods).toEqual(['PASSWORD', 'GOOGLE']);
    expect(user!.passwordHash).not.toBeNull();
    // An existing account is told about the link, not welcomed again.
    expect(
      ctx.mail.sent.filter((mail) => mail.to === 'minh@example.com').map((mail) => mail.template),
    ).toEqual(['verify-email', 'welcome', 'google-linked']);
    expect(ctx.mail.sent.findLast((mail) => mail.template === 'google-linked')).toMatchObject({
      to: 'minh@example.com',
      link: `${WEB}/vi/settings`,
    });
    await newAgent()
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: 'leap2026' })
      .expect(200);
  });

  it('takes over an unverified account: the unproven password is removed', async () => {
    await newAgent()
      .post('/api/v1/auth/register')
      .send({ email: 'victim@example.com', password: 'attacker1', fullName: 'Kẻ chiếm trước' })
      .expect(201);
    await googleFlow(newAgent(), 'victim@example.com');

    const user = await userByEmail('victim@example.com');
    expect(user).toMatchObject({ passwordHash: null });
    expect(user!.emailVerifiedAt).not.toBeNull();
    await newAgent()
      .post('/api/v1/auth/login')
      .send({ email: 'victim@example.com', password: 'attacker1' })
      .expect(401);
    expect(
      ctx.mail.sent.some((mail) => mail.template === 'google-linked' && mail.to === 'victim@example.com'),
    ).toBe(false);
  });

  it('returns finished users to the page they asked for, never to another site', async () => {
    await signUpOnboarded(ctx, 'minh@example.com');
    expect((await googleFlow(newAgent(), 'minh@example.com', { next: '/applications' })).pathname).toBe(
      '/vi/applications',
    );
    expect((await googleFlow(newAgent(), 'minh@example.com', { next: '//evil.example' })).toString()).toBe(
      `${WEB}/vi/dashboard`,
    );
  });

  it.each([
    ['an unverified Google email', 'unverified.user@example.com', ErrorCode.AUTH_OAUTH_EMAIL_UNVERIFIED],
    ['an admin account', 'general@offerleap.local', ErrorCode.AUTH_OAUTH_NOT_ALLOWED],
  ])('refuses %s', async (_case, email, code) => {
    await signInAdmin(ctx, 'GENERAL');
    const landing = await googleFlow(newAgent(), email);
    expect(landing.pathname).toBe('/vi/login');
    expect(landing.searchParams.get('error')).toBe(code);
    expect(await ctx.prisma.userIdentity.count()).toBe(0);
  });

  it('refuses a disabled account', async () => {
    await googleFlow(newAgent(), 'lan@example.com');
    await ctx.prisma.user.update({ where: { email: 'lan@example.com' }, data: { status: 'DISABLED' } });
    const landing = await googleFlow(newAgent(), 'lan@example.com');
    expect(landing.searchParams.get('error')).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);
  });

  it('rejects a callback that this browser did not start, and a cancelled one quietly', async () => {
    const attacker = newAgent();
    const start = await attacker
      .get('/api/v1/auth/google')
      .query({ loginHint: 'evil@example.com' })
      .expect(303);
    const callback = new URL(start.headers.location!);

    // Another browser (no flow cookie) opening the attacker's callback link: no session for anyone.
    const victim = newAgent();
    const landing = await victim.get(callback.pathname + callback.search).expect(302);
    expect(new URL(landing.headers.location!).searchParams.get('error')).toBe(ErrorCode.AUTH_OAUTH_FAILED);
    await victim.get('/api/v1/auth/me').expect(401);

    // Same browser, state changed in transit.
    callback.searchParams.set('state', 'tampered');
    const tampered = await attacker.get(callback.pathname + callback.search).expect(302);
    expect(new URL(tampered.headers.location!).searchParams.get('error')).toBe(ErrorCode.AUTH_OAUTH_FAILED);

    const again = await attacker.get('/api/v1/auth/google').expect(303);
    expect(again.headers.location).toBeDefined();
    const cancelled = await attacker.get('/api/v1/auth/google/callback?error=access_denied').expect(302);
    expect(cancelled.headers.location).toBe(`${WEB}/vi/login`);
  });

  it('never accepts the flow cookie as an access token', async () => {
    const start = await newAgent().get('/api/v1/auth/google').expect(303);
    const flow = String(start.headers['set-cookie']).match(/ol_oauth=([^;]+)/)![1]!;
    await newAgent().get('/api/v1/auth/me').set('Cookie', `ol_at=${flow}`).expect(401);
  });
});

describe('Google on the settings page', () => {
  it('links Google to a signed-in user, refuses it for a second account, and unlinks', async () => {
    const minh = await signUpOnboarded(ctx, 'minh@example.com');
    const linked = await googleFlow(minh, 'minh.personal@gmail.com', { intent: 'link' });
    expect(linked.toString()).toBe(`${WEB}/vi/settings?linked=google`);
    const { body } = await minh.get('/api/v1/auth/sign-in-methods').expect(200);
    expect(body).toMatchObject({ hasPassword: true, identities: [{ email: 'minh.personal@gmail.com' }] });

    const lan = await signUpOnboarded(ctx, 'lan@example.com');
    const taken = await googleFlow(lan, 'minh.personal@gmail.com', { intent: 'link' });
    expect(taken.searchParams.get('error')).toBe(ErrorCode.AUTH_OAUTH_ALREADY_LINKED);

    await minh.delete('/api/v1/auth/identities/google').expect(204);
    expect(await ctx.prisma.userIdentity.count()).toBe(0);
    await newAgent().post('/api/v1/auth/google/link').expect(401);
  });

  it('keeps the only way in: no unlinking without a password', async () => {
    const agent = newAgent();
    await googleFlow(agent, 'lan@example.com');
    const refused = await agent.delete('/api/v1/auth/identities/google').expect(409);
    expect(refused.body.code).toBe(ErrorCode.AUTH_OAUTH_UNLINK_NOT_ALLOWED);
  });

  it('deletes a Google-only account after a fresh sign-in with the same Google account', async () => {
    const agent = newAgent();
    await googleFlow(agent, 'lan@example.com');

    const wrong = await googleFlow(agent, 'someone.else@gmail.com', { intent: 'delete' });
    expect(wrong.searchParams.get('error')).toBe(ErrorCode.AUTH_OAUTH_ACCOUNT_MISMATCH);
    expect(await userByEmail('lan@example.com')).not.toBeNull();

    const deleted = await googleFlow(agent, 'lan@example.com', { intent: 'delete' });
    expect(deleted.toString()).toBe(`${WEB}/vi/login?deleted=1`);
    expect(await userByEmail('lan@example.com')).toBeNull();
    await agent.get('/api/v1/auth/me').expect(401);
  });
});
