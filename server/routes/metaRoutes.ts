import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

// Endpoint: Meta User Data Deletion Callback
// Meta Graph API posts a signed_request when a user removes the app from Facebook Apps & Websites
router.post('/data-deletion', (req: Request, res: Response) => {
  try {
    const signedRequest = req.body.signed_request || req.query.signed_request;

    // Default confirmation code
    const confirmationCode = `YUM_DEL_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const domain = `${req.protocol}://${req.get('host')}`;
    const statusUrl = `${domain}/#data-deletion?code=${confirmationCode}`;

    // Respond according to Meta Spec
    // Spec requires JSON response containing `url` and `confirmation_code`
    return res.json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });
  } catch (error) {
    console.error('Meta Data Deletion Callback Error:', error);
    return res.status(500).json({ error: 'Failed to process data deletion callback' });
  }
});

// Endpoint: Meta Webhook Verification (GET)
router.get('/webhooks', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const EXPECTED_TOKEN = process.env.META_VERIFY_TOKEN || 'YUMNETWORK_CRM_META_VERIFY_TOKEN_2026';

  if (mode === 'subscribe' && token === EXPECTED_TOKEN) {
    console.log('Meta Webhook Verified Successfully');
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// Endpoint: Meta Webhook Event Handler (POST)
router.post('/webhooks', (req: Request, res: Response) => {
  const body = req.body;

  if (body.object === 'page' || body.object === 'whatsapp_business_account') {
    // Process incoming messaging/lead events
    console.log('Received Meta Webhook Event:', JSON.stringify(body, null, 2));
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.sendStatus(404);
});

export default router;
