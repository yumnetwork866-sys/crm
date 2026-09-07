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
import { verifyMetaWebhookSignature } from '../middleware/metaWebhookSignature';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';

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
router.post(['/', '/webhook', '/webhooks'], verifyMetaWebhookSignature, handleWebhookPost);

// ==========================================
// 3. Centralized Chat & Messaging Routes
// ==========================================
router.get('/messages', authenticateToken, requirePermission(Permission.MESSAGES_VIEW), getMessages);
router.get('/messages/thread/:customerId', authenticateToken, requirePermission(Permission.MESSAGES_VIEW), getMessages);
router.post('/messages/read', authenticateToken, requirePermission(Permission.MESSAGES_MANAGE), markMessagesAsRead);
router.post('/messages/send', authenticateToken, requirePermission(Permission.MESSAGES_MANAGE), sendMessage);
router.post('/messages/react', authenticateToken, requirePermission(Permission.MESSAGES_MANAGE), sendReaction);
router.delete('/messages', authenticateToken, requirePermission(Permission.MESSAGES_MANAGE), clearAllMessages);
router.delete('/messages/thread/:customerId', authenticateToken, requirePermission(Permission.MESSAGES_MANAGE), deleteThread);
router.delete('/messages/item/:messageId', authenticateToken, requirePermission(Permission.MESSAGES_MANAGE), deleteMessage);

// ==========================================
// 4. Meta Media Proxy & CDN Cache
// ==========================================
// Media URLs are consumed directly by <img>/<video>; these requests cannot attach the bearer header.
router.get('/media/:mediaId', getMediaProxy);

export default router;
