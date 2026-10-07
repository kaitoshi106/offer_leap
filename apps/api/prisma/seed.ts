import './load-env';

import { PrismaPg } from '@prisma/adapter-pg';
import { z } from 'zod';

import { hashPassword } from '../src/common/security/hashing';
import { PrismaClient } from '../src/generated/prisma/client';

const seedEnv = z
  .object({
    DATABASE_URL: z.string().min(1),
    ROOT_ADMIN_EMAIL: z.email().transform((email) => email.toLowerCase()),
    ROOT_ADMIN_PASSWORD: z.string().min(12, 'ROOT_ADMIN_PASSWORD must be at least 12 characters'),
  })
  .parse(process.env);

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: seedEnv.DATABASE_URL }) });

/**
 * @description Creates or updates the single root admin from env. Re-running it is how the root password is
 * rotated: the app itself never lets root change or reset its password.
 */
async function seedRootAdmin(): Promise<void> {
  const passwordHash = await hashPassword(seedEnv.ROOT_ADMIN_PASSWORD);
  const data = {
    email: seedEnv.ROOT_ADMIN_EMAIL,
    passwordHash,
    fullName: 'Root Admin',
    role: 'ADMIN',
    adminLevel: 'ROOT',
    status: 'ACTIVE',
    emailVerifiedAt: new Date(),
    passwordChangedAt: new Date(),
  } as const;

  const existingRoot = await prisma.user.findFirst({ where: { adminLevel: 'ROOT' } });
  const root = existingRoot
    ? await prisma.user.update({ where: { id: existingRoot.id }, data })
    : await prisma.user.upsert({ where: { email: data.email }, update: data, create: data });

  // A new password must end every existing root session.
  await prisma.refreshToken.updateMany({
    where: { userId: root.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  console.log(`✔ root admin ready: ${root.email}`);
}

seedRootAdmin()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
