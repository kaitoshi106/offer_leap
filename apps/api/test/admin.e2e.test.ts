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

describe('admin invitations', () => {
  it('root invites a general admin who sets up the account from the email link', async () => {
    const root = await signInAdmin(ctx, 'ROOT');

    const { body: invitation } = await root
      .post('/api/v1/admin/invitations')
      .send({ email: 'Lan.Admin@Example.com', locale: 'vi' })
      .expect(201);
    expect(invitation).toMatchObject({
      email: 'lan.admin@example.com',
      status: 'PENDING',
      invitedBy: 'Root Admin',
    });

    const mail = ctx.mail.sent.at(-1)!;
    expect(mail).toMatchObject({
      template: 'admin-invitation',
      to: 'lan.admin@example.com',
      fullName: 'Root Admin',
    });
    expect(mail.link).toMatch(/\/vi\/admin-invite\?token=/);
    const token = ctx.mail.lastToken('lan.admin@example.com', 'admin-invitation');

    const anonymous = request.agent(ctx.app.getHttpServer());
    const preview = await anonymous
      .post('/api/v1/auth/admin-invitations/preview')
      .send({ token })
      .expect(200);
    expect(preview.body.email).toBe('lan.admin@example.com');

    const accepted = await anonymous
      .post('/api/v1/auth/accept-invitation')
      .send({ token, fullName: 'Lan Nguyễn', password: 'leap2026' })
      .expect(200);
    expect(accepted.body.user).toMatchObject({ role: 'ADMIN', adminLevel: 'GENERAL', emailVerified: true });
    // Signed in straight away, and the admin API is open to them.
    await anonymous.get('/api/v1/admin/users').expect(200);

    // The link is single use; the list shows the invitation as accepted.
    await anonymous
      .post('/api/v1/auth/accept-invitation')
      .send({ token, fullName: 'Someone', password: 'leap2026' })
      .expect(400)
      .expect(({ body }) => expect(body.code).toBe(ErrorCode.AUTH_TOKEN_INVALID));
    const list = await root.get('/api/v1/admin/invitations').expect(200);
    expect(list.body[0]).toMatchObject({ status: 'ACCEPTED' });
  });

  it('refuses duplicates, supports resend and revoke, and rejects expired links', async () => {
    const root = await signInAdmin(ctx, 'ROOT');
    await signUpAndVerify(ctx, 'taken@example.com');
    const taken = await root
      .post('/api/v1/admin/invitations')
      .send({ email: 'taken@example.com', locale: 'en' });
    expect(taken.body.code).toBe(ErrorCode.AUTH_EMAIL_TAKEN);

    const { body } = await root
      .post('/api/v1/admin/invitations')
      .send({ email: 'a@example.com', locale: 'en' })
      .expect(201);
    const firstToken = ctx.mail.lastToken('a@example.com', 'admin-invitation');
    const again = await root
      .post('/api/v1/admin/invitations')
      .send({ email: 'a@example.com', locale: 'en' })
      .expect(409);
    expect(again.body.code).toBe(ErrorCode.ADMIN_INVITATION_PENDING);

    // Resend: a new link, the old one stops working.
    await root.post(`/api/v1/admin/invitations/${body.id}/resend`).send({ locale: 'en' }).expect(200);
    const secondToken = ctx.mail.lastToken('a@example.com', 'admin-invitation');
    expect(secondToken).not.toBe(firstToken);
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/admin-invitations/preview')
      .send({ token: firstToken })
      .expect(400);

    // Expired.
    await ctx.prisma.adminInvitation.update({
      where: { id: body.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/admin-invitations/preview')
      .send({ token: secondToken });
    expect(expired.body.code).toBe(ErrorCode.AUTH_TOKEN_EXPIRED);

    // Revoked.
    await root.delete(`/api/v1/admin/invitations/${body.id}`).expect(204);
    expect((await root.get('/api/v1/admin/invitations').expect(200)).body[0].status).toBe('REVOKED');
  });

  it('is root only', async () => {
    const general = await signInAdmin(ctx, 'GENERAL');
    const response = await general
      .post('/api/v1/admin/invitations')
      .send({ email: 'x@example.com', locale: 'en' });
    expect(response.status).toBe(403);
    await general.get('/api/v1/admin/invitations').expect(403);

    const user = await signUpOnboarded(ctx);
    await user.get('/api/v1/admin/users').expect(403);
  });
});

describe('admin users', () => {
  it('searches and pages through accounts', async () => {
    const admin = await signInAdmin(ctx, 'GENERAL');
    await signUpOnboarded(ctx, 'minh@example.com');
    await signUpAndVerify(ctx, 'lan@example.com');

    const all = await admin.get('/api/v1/admin/users').expect(200);
    expect(all.body).toMatchObject({ total: 3, page: 1, pageSize: 10 });
    expect(all.body.items).toHaveLength(3);
    const second = await admin.get('/api/v1/admin/users').query({ page: 2, pageSize: 50 }).expect(200);
    expect(second.body).toMatchObject({ total: 3, page: 2, pageSize: 50, items: [] });

    // Case-insensitive, on email or name.
    const search = await admin.get('/api/v1/admin/users').query({ q: 'MINH@', role: 'USER' }).expect(200);
    expect(search.body.items.map((user: { email: string }) => user.email)).toEqual(['minh@example.com']);
    expect(search.body.items[0]).toMatchObject({ onboardingCompleted: true, status: 'ACTIVE' });

    await admin.get('/api/v1/admin/users').query({ pageSize: 500 }).expect(422);
    await admin.get('/api/v1/admin/users').query({ pageSize: 2 }).expect(422);
  });

  it('shows account details with activity counts but no documents', async () => {
    const admin = await signInAdmin(ctx, 'GENERAL');
    await signUpOnboarded(ctx, 'minh@example.com');
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'minh@example.com' } });

    const { body } = await admin.get(`/api/v1/admin/users/${user.id}`).expect(200);
    expect(body).toMatchObject({
      email: 'minh@example.com',
      profile: { jobTitle: 'Frontend Developer', level: 'SENIOR' },
      activity: { resumes: 0, analyses: 0, applications: 0, interviews: 0 },
      manageable: true,
    });
    expect(body).not.toHaveProperty('passwordHash');
  });

  it('disables an account: its sessions end and it cannot sign in until enabled again', async () => {
    const admin = await signInAdmin(ctx, 'GENERAL');
    const userAgent = await signUpOnboarded(ctx, 'minh@example.com');
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'minh@example.com' } });

    await admin.patch(`/api/v1/admin/users/${user.id}/status`).send({ status: 'DISABLED' }).expect(200);
    // The refresh token was revoked, so the session can't be renewed.
    const refresh = await userAgent.post('/api/v1/auth/refresh').expect(400);
    expect(refresh.body.code).toBe(ErrorCode.AUTH_TOKEN_INVALID);
    const login = await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: 'leap2026' });
    expect(login.body.code).toBe(ErrorCode.AUTH_ACCOUNT_LOCKED);

    await admin.patch(`/api/v1/admin/users/${user.id}/status`).send({ status: 'ACTIVE' }).expect(200);
    await request(ctx.app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'minh@example.com', password: 'leap2026' })
      .expect(200);
  });

  it('enforces who may manage whom', async () => {
    const root = await signInAdmin(ctx, 'ROOT');
    const general = await signInAdmin(ctx, 'GENERAL', 'g1@offerleap.local');
    await signInAdmin(ctx, 'GENERAL', 'g2@offerleap.local');
    const byEmail = (email: string) => ctx.prisma.user.findUniqueOrThrow({ where: { email } });
    const [rootUser, g1, g2] = await Promise.all([
      byEmail('root@offerleap.local'),
      byEmail('g1@offerleap.local'),
      byEmail('g2@offerleap.local'),
    ]);
    const disable = (agent: typeof root, id: string) =>
      agent.patch(`/api/v1/admin/users/${id}/status`).send({ status: 'DISABLED' });

    for (const [agent, target] of [
      [general, g2],
      [general, rootUser],
      [general, g1],
      [root, rootUser],
    ] as const) {
      const response = await disable(agent, target.id);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe(ErrorCode.ADMIN_ACTION_NOT_ALLOWED);
    }
    // Root may manage general admins.
    await disable(root, g2.id).expect(200);
    expect((await general.get(`/api/v1/admin/users/${g1.id}`).expect(200)).body.manageable).toBe(false);
  });
});
