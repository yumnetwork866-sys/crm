import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findFirst: vi.fn(), upsert: vi.fn(), update: vi.fn() },
  compare: vi.fn(),
  hash: vi.fn(),
}));
vi.mock('../lib/prisma', () => ({ prisma: { user: mocks.user } }));
vi.mock('bcryptjs', () => ({ default: { compare: mocks.compare, hash: mocks.hash } }));
import { syncConfiguredAdmin } from './adminAccount';

const admin = {
  id: 'configured-admin',
  email: 'admin',
  password: 'existing-hash',
  role: 'Admin',
  status: 'active',
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.compare.mockResolvedValue(true);
  mocks.hash.mockResolvedValue('new-hash');
});

describe('configured admin synchronization', () => {
  it('chooses the exact admin login instead of another account with the Admin role', async () => {
    mocks.user.findUnique.mockResolvedValue(admin);
    mocks.user.findFirst.mockResolvedValue({
      ...admin,
      id: 'another-admin',
      email: 'other@example.com',
    });
    expect(await syncConfiguredAdmin('admin', 'configured-password')).toBe('unchanged');
    expect(mocks.user.findUnique).toHaveBeenCalledWith({ where: { email: 'admin' } });
    expect(mocks.user.findFirst).not.toHaveBeenCalled();
    expect(mocks.user.update).not.toHaveBeenCalled();
    expect(mocks.hash).not.toHaveBeenCalled();
  });
  it('updates only the configured account when its password or role needs synchronization', async () => {
    mocks.user.findUnique.mockResolvedValue({ ...admin, role: 'Employee', status: 'inactive' });
    mocks.compare.mockResolvedValue(false);
    expect(await syncConfiguredAdmin('admin', 'configured-password')).toBe('updated');
    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: admin.id },
      data: { email: 'admin', password: 'new-hash', role: 'Admin', status: 'active' },
    });
  });
  it('normalizes a case-insensitive match only when the exact login is absent', async () => {
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.user.findFirst.mockResolvedValue({ ...admin, email: 'ADMIN' });
    expect(await syncConfiguredAdmin('admin', 'configured-password')).toBe('updated');
    expect(mocks.user.findFirst).toHaveBeenCalledWith({
      where: { email: { equals: 'admin', mode: 'insensitive' } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: admin.id },
      data: { email: 'admin', password: 'existing-hash', role: 'Admin', status: 'active' },
    });
    expect(mocks.hash).not.toHaveBeenCalled();
  });
  it('creates the configured login without renaming another admin and uses upsert for concurrent starts', async () => {
    mocks.user.findUnique.mockResolvedValue(null);
    mocks.user.findFirst.mockResolvedValue(null);
    expect(await syncConfiguredAdmin('admin', 'configured-password')).toBe('created');
    expect(mocks.user.upsert).toHaveBeenCalledWith({
      where: { email: 'admin' },
      create: {
        name: 'Quản Trị Viên (Admin)',
        email: 'admin',
        password: 'new-hash',
        role: 'Admin',
        status: 'active',
      },
      update: { password: 'new-hash', role: 'Admin', status: 'active' },
    });
    expect(mocks.user.findFirst.mock.calls[0][0].where).not.toHaveProperty('OR');
    expect(mocks.user.update).not.toHaveBeenCalled();
  });
});
