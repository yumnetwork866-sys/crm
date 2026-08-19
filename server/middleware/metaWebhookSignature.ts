import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const META_SIGNATURE_PREFIX = 'sha256=';
const SHA256_SIGNATURE_PATTERN = /^[a-fA-F0-9]{64}$/;

export function isValidMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  appSecret: string
): boolean {
  if (!signatureHeader.startsWith(META_SIGNATURE_PREFIX)) {
    return false;
  }

  const signatureHex = signatureHeader.slice(META_SIGNATURE_PREFIX.length);
  if (!SHA256_SIGNATURE_PATTERN.test(signatureHex)) {
    return false;
  }

  const receivedSignature = Buffer.from(signatureHex, 'hex');
  const expectedSignature = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest();

  return crypto.timingSafeEqual(receivedSignature, expectedSignature);
}

export function verifyMetaWebhookSignature(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  if (!appSecret) {
    console.error('Meta webhook rejected: WHATSAPP_APP_SECRET is not configured.');
    return res.status(503).json({ error: 'Webhook signature verification is not configured.' });
  }

  const signatureHeader = req.get('x-hub-signature-256');
  if (!signatureHeader) {
    return res.status(401).json({ error: 'Missing webhook signature.' });
  }

  const rawBody = res.locals.metaWebhookRawBody;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ error: 'Webhook raw body is unavailable.' });
  }

  if (!isValidMetaWebhookSignature(rawBody, signatureHeader, appSecret)) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  return next();
}
