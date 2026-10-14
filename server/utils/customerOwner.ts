import { prisma } from '../lib/prisma';

const UNASSIGNED_LABELS = new Set([
  '',
  'chưa phân công',
  'unassigned',
  'chua phan cong',
  'none',
  'null',
]);

export function isUnassignedOwnerInput(value?: string | null): boolean {
  if (!value) return true;
  return UNASSIGNED_LABELS.has(value.trim().toLowerCase());
}

/**
 * Resolves a User ID (`ownerId`) from either an explicit `ownerId` or a legacy `owner` display name / email.
 * Returns `null` if unassigned or no matching user exists.
 */
export async function resolveCustomerOwnerId(input: {
  ownerId?: string | null;
  owner?: string | null;
}): Promise<{ ownerId: string | null; ownerName: string }> {
  const rawOwnerId = input.ownerId !== undefined ? input.ownerId : undefined;
  const rawOwner = input.owner !== undefined ? input.owner : undefined;

  if (rawOwnerId !== undefined) {
    if (!rawOwnerId || isUnassignedOwnerInput(rawOwnerId)) {
      return { ownerId: null, ownerName: 'Chưa phân công' };
    }
    const byId = await prisma.user.findUnique({
      where: { id: rawOwnerId.trim() },
      select: { id: true, name: true },
    });
    if (byId) {
      return { ownerId: byId.id, ownerName: byId.name };
    }
  }

  if (rawOwner !== undefined) {
    if (!rawOwner || isUnassignedOwnerInput(rawOwner)) {
      return { ownerId: null, ownerName: 'Chưa phân công' };
    }
    const candidate = rawOwner.trim();
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: candidate },
          { name: { equals: candidate, mode: 'insensitive' } },
          { email: { equals: candidate, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true },
    });
    if (user) {
      return { ownerId: user.id, ownerName: user.name };
    }
  }

  return { ownerId: null, ownerName: 'Chưa phân công' };
}

/**
 * Serializes a Prisma Customer record (with optional `ownerUser` relation) so API consumers
 * receive both `ownerId` (foreign key) and `owner` (display name), plus numeric `totalSpent`.
 */
export function serializeCustomer<T extends Record<string, any>>(customer: T) {
  const { ownerUser, ...rest } = customer;
  const ownerName = ownerUser?.name || 'Chưa phân công';
  return {
    ...rest,
    ownerId: customer.ownerId ?? null,
    owner: ownerName,
    totalSpent: Number(customer.totalSpent ?? 0),
    ...(Array.isArray(customer.orders)
      ? {
          orders: customer.orders.map((o: any) => ({
            ...o,
            totalAmount: Number(o.totalAmount ?? 0),
            ...(Array.isArray(o.products)
              ? {
                  products: o.products.map((p: any) => ({
                    ...p,
                    price: Number(p.price ?? 0),
                  })),
                }
              : {}),
          })),
        }
      : {}),
  };
}
