import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:123@localhost:5432/postgres?schema=public'
    }
  }
});

async function dropOldDb() {
  try {
    // Terminate existing active connections to vietcrm
    await prisma.$executeRawUnsafe(`
      SELECT pg_terminate_backend(pid) 
      FROM pg_stat_activity 
      WHERE datname = 'vietcrm' AND pid <> pg_backend_pid();
    `);

    // Drop database
    await prisma.$executeRawUnsafe('DROP DATABASE IF EXISTS vietcrm;');
    console.log('✅ Đã xóa thành công database cũ vietcrm!');
  } catch (err) {
    console.error('Lỗi khi xóa database cũ:', err);
  } finally {
    await prisma.$disconnect();
  }
}

void dropOldDb();
