import http from 'http';
import { realtimeHub } from '../server/services/realtimeHub';

async function testSSERealtime() {
  console.log('--- TEST: Real-time Server-Sent Events (SSE) Hub ---');

  // Create a mock response object to simulate an SSE client
  let receivedEvents: Array<{ event?: string; data: string }> = [];

  const mockRes: any = {
    writeHead: (status: number, headers: any) => {
      console.log('✅ SSE Response Headers written:', status, headers['Content-Type']);
    },
    write: (chunk: string) => {
      console.log('📩 SSE Chunk Received by mock client:\n' + chunk.trim());
      const lines = chunk.trim().split('\n');
      let event = '';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) event = line.replace('event:', '').trim();
        if (line.startsWith('data:')) data = line.replace('data:', '').trim();
      }
      if (event || data) {
        receivedEvents.push({ event, data });
      }
    },
    flushHeaders: () => {}
  };

  // Connect client
  realtimeHub.addClient('mock_client_test_1', mockRes);
  console.log('✅ Connected client count:', realtimeHub.getClientCount());

  // Broadcast a new WhatsApp message
  const sampleMsg = {
    id: `wamid.TEST_REALTIME_${Date.now()}`,
    customerId: 'cust_001',
    customerName: 'Nguyễn Thị Minh Châu',
    customerPhone: '0908123456',
    sender: 'customer',
    content: 'Tin nhắn thời gian thực qua SSE <100ms!',
    timestamp: new Date().toISOString(),
    isRead: false
  };

  console.log('\n--- Broadcasting "message:new" event ---');
  realtimeHub.broadcast('message:new', sampleMsg);

  // Broadcast a read receipt
  console.log('\n--- Broadcasting "message:read" event ---');
  realtimeHub.broadcast('message:read', {
    customerId: 'cust_001',
    readBy: 'Admin',
    readAt: new Date().toISOString()
  });

  // Disconnect client
  realtimeHub.removeClient('mock_client_test_1');
  console.log('✅ Disconnected client count:', realtimeHub.getClientCount());

  console.log(`\n🎉 SSE Realtime Test passed! Total events received: ${receivedEvents.length}`);
  process.exit(0);
}

testSSERealtime().catch((err) => {
  console.error('❌ SSE Test failed:', err);
  process.exit(1);
});
