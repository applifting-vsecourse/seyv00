import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { PrismaService } from '@/core/prisma/prisma.service';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

/** The whole Nest app, wired like main.ts, but not listening on a port. */
export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: ['error', 'warn'] });
  configureApp(app);
  await app.init();
  return app;
}

/** Empties every table except Prisma's migration log. */
export async function resetDatabase(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;

  const list = tables.map(({ tablename }) => `"public"."${tablename}"`);
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list.join(', ')} RESTART IDENTITY CASCADE`,
  );
}

type SignUpParams = { email?: string; password?: string; name?: string };

/**
 * Signs a new user up through BetterAuth's real endpoint and returns a
 * supertest agent that sends their session cookie with every request.
 */
export async function signUp(
  app: INestApplication,
  params: SignUpParams = {},
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/auth/sign-up/email')
    .send({
      email: params.email ?? 'duck@example.com',
      password: params.password ?? 'password123',
      name: params.name ?? 'Test Duck',
    })
    .expect(200);
  return agent;
}
