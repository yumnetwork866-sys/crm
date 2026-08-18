import { Router } from 'express';
import {
  getConfig,
  saveConfig,
  fetchPhoneNumbers,
  testConnection,
  handleDataDeletion,
  handleWebhookGet,
  handleWebhookPost
} from '../controllers/metaController';
import {
  getMessages,
  markMessagesAsRead,
  sendMessage,
  sendReaction,
  clearAllMessages,
  deleteThread,
  deleteMessage,
  getMediaProxy,
  getRealtimeStream
} from '../controllers/chatController';

const router = Router();

// ==========================================
// 1. Real-time SSE Streaming
// ==========================================
router.get('/messages/stream', getRealtimeStream);
router.get('/stream', getRealtimeStream);

// ==========================================
// 2. Meta Integration & Configuration Routes
// ==========================================
router.get('/config', getConfig);
router.post('/config', saveConfig);
router.post('/fetch-phone-numbers', fetchPhoneNumbers);
router.post('/test-connection', testConnection);
router.post('/data-deletion', handleDataDeletion);

// ==========================================
// 2. Meta Webhook Routes (Verification & Ingestion)
// ==========================================
router.get(['/', '/webhook', '/webhooks'], handleWebhookGet);
router.post(['/', '/webhook', '/webhooks'], handleWebhookPost);

// ==========================================
// 3. Centralized Chat & Messaging Routes
// ==========================================
router.get('/messages', getMessages);
router.get('/messages/thread/:customerId', getMessages);
router.post('/messages/read', markMessagesAsRead);
router.post('/messages/send', sendMessage);
router.post('/messages/react', sendReaction);
router.delete('/messages', clearAllMessages);
router.delete('/messages/thread/:customerId', deleteThread);
router.delete('/messages/item/:messageId', deleteMessage);

// ==========================================
// 4. Meta Media Proxy & CDN Cache
// ==========================================
router.get('/media/:mediaId', getMediaProxy);

export default router;
