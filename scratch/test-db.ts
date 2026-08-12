import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.customer.count();
  console.log('Customer count in DB:', count);
  const customers = await prisma.customer.findMany({
    take: 5,
    select: { id: true, name: true, phone: true }
  });
  console.log('Sample customers:', customers);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
