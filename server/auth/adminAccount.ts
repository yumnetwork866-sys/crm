import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

/** ADMIN identifies an account by email/login, never by another user's role. */
export async function syncConfiguredAdmin(
  email: string,
  password: string,
): Promise<'created' | 'updated' | 'unchanged'> {
  const existing =
    (await prisma.user.findUnique({ where: { email } })) ??
    (await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));

  if (!existing) {
    const hashedPassword = await bcrypt.hash(password, 10);
    // Concurrent backend starts can both observe a missing account.
    await prisma.user.upsert({
      where: { email },
      create: {
        name: 'Quản Trị Viên (Admin)',
        email,
        password: hashedPassword,
        role: 'Admin',
        status: 'active',
      },
      update: { password: hashedPassword, role: 'Admin', status: 'active' },
    });
    return 'created';
  }
  const passwordMatches = await bcrypt.compare(password, existing.password);
  if (
    passwordMatches &&
    existing.role === 'Admin' &&
    existing.status === 'active' &&
    existing.email === email
  ) {
    return 'unchanged';
  }
  await prisma.user.update({
    where: { id: existing.id },
    data: {
      email,
      password: passwordMatches ? existing.password : await bcrypt.hash(password, 10),
      role: 'Admin',
      status: 'active',
    },
  });
  return 'updated';
}
