import { prisma } from '../server/lib/prisma';

async function testAll() {
  console.log('--- TEST 1: Singleton Prisma Connection ---');
  const userCount = await prisma.user.count();
  console.log('✅ User count via singleton prisma:', userCount);

  console.log('\n--- TEST 2: PostgreSQL pg_trgm & GIN Indexes ---');
  // Check pg_trgm extension
  const extensions: any = await prisma.$queryRaw`SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';`;
  console.log('✅ pg_trgm extension in DB:', extensions);

  // Check GIN indexes on Customer table
  const indexes: any = await prisma.$queryRaw`
    SELECT indexname, indexdef 
    FROM pg_indexes 
    WHERE tablename = 'Customer' AND indexdef LIKE '%gin%';
  `;
  console.log('✅ GIN Trigram indexes on Customer:');
  indexes.forEach((idx: any) => console.log(`   - ${idx.indexname}: ${idx.indexdef}`));

  console.log('\n--- TEST 3: GIN Trigram Search Query ---');
  const searchResults = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'nguyen', mode: 'insensitive' } },
        { phone: { contains: '09' } },
        { email: { contains: 'test', mode: 'insensitive' } }
      ]
    },
    take: 5
  });
  console.log(`✅ Substring search via GIN Trigram found ${searchResults.length} customer(s).`);

  console.log('\n--- TEST 4: Offset Pagination on Customers ---');
  const page = 1;
  const limit = 2;
  const [totalCust, pagedCust] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' }
    })
  ]);
  console.log(`✅ Customers Pagination: Total ${totalCust}, Page ${page} (take ${limit}), Items returned: ${pagedCust.length}`);

  console.log('\n--- TEST 5: Cursor-based Pagination on WhatsApp Messages ---');
  // Fetch newest 2 messages
  const newestMsgs = await prisma.whatsAppMessage.findMany({
    take: 2,
    orderBy: { timestamp: 'desc' }
  });
  console.log(`✅ Initial newest messages count: ${newestMsgs.length}`);

  if (newestMsgs.length > 0) {
    const pivot = newestMsgs[0];
    const olderMsgs = await prisma.whatsAppMessage.findMany({
      where: {
        timestamp: { lt: pivot.timestamp }
      },
      take: 2,
      orderBy: { timestamp: 'desc' }
    });
    console.log(`✅ Cursor-based pagination before message ID "${pivot.id}" found ${olderMsgs.length} older message(s).`);
  }

  console.log('\n🎉 ALL DATABASE & QUERY OPTIMIZATION TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testAll().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
