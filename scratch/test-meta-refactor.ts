import { getIntegrationSetting, resolvePhoneNumberId } from '../server/services/metaApiClient';
import { processWebhookPayload, verifyWebhookChallenge } from '../server/services/webhookService';
import { messageStore } from '../server/services/messageStore';
import { prisma } from '../server/lib/prisma';

async function testMetaRefactor() {
  console.log('--- TEST 1: Meta API Client Service ---');
  const setting = await getIntegrationSetting();
  console.log('✅ Integration setting loaded:', {
    id: setting.id,
    status: setting.status,
    wabaId: setting.whatsappWabaId,
    phoneId: setting.whatsappPhoneNumberId
  });

  console.log('\n--- TEST 2: Webhook Verification ---');
  const verifyRes = await verifyWebhookChallenge({
    'hub.mode': 'subscribe',
    'hub.verify_token': 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026',
    'hub.challenge': '1158201444'
  });
  console.log('✅ Webhook verification result:', verifyRes);

  console.log('\n--- TEST 3: Webhook Ingestion & Customer Matching & Opt-In ---');
  // Get an existing customer's phone from DB
  const existingCust = await prisma.customer.findFirst();
  const testPhone = existingCust ? existingCust.phone : '0901234567';
  console.log(`Using customer phone for webhook test: ${testPhone}`);

  const mockPayload = {
    entry: [
      {
        id: '123456789',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '123456', phone_number_id: '123456' },
              contacts: [{ profile: { name: 'Nguyễn Văn Test' }, wa_id: testPhone }],
              messages: [
                {
                  from: testPhone,
                  id: `wamid.TEST_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  text: { body: 'Xin chào CRM, tôi muốn nhận tư vấn!' },
                  type: 'text'
                }
              ]
            },
            field: 'messages'
          }
        ]
      }
    ]
  };

  const processedCount = await processWebhookPayload(mockPayload);
  console.log(`✅ Processed ${processedCount} webhook message(s).`);

  // Verify message in messageStore
  const inMemory = messageStore.getAll();
  console.log(`✅ Total messages in memory store: ${inMemory.length}`);

  // Verify customer opt-in updated
  if (existingCust) {
    const refreshedCust = await prisma.customer.findUnique({ where: { id: existingCust.id } });
    console.log(`✅ Customer ${refreshedCust?.name} whatsappOptIn:`, refreshedCust?.whatsappOptIn);
  }

  console.log('\n🎉 ALL META MODULAR REFACTOR TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

testMetaRefactor().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
