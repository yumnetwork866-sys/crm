import { prisma } from '../lib/prisma';
import {
  dispatchMetaTemplateMessage,
  getIntegrationSetting,
  resolvePhoneNumberId,
} from './metaApiClient';

const WORKER_INTERVAL_MS = Math.max(1_000, Number(process.env.CAMPAIGN_WORKER_INTERVAL_MS) || 2_000);
const WORKER_CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.CAMPAIGN_WORKER_CONCURRENCY) || 5));
const MAX_ATTEMPTS = Math.max(1, Number(process.env.CAMPAIGN_MAX_ATTEMPTS) || 3);
const STALE_LOCK_MS = 5 * 60 * 1_000;

let isRunning = false;
let workerTimer: ReturnType<typeof setInterval> | null = null;
let isSchemaReady = false;
let hasRecoveredStaleRecipients = false;
let lastSchemaWarningAt = 0;

const countFor = (counts: Map<string, number>, statuses: string[]) =>
  statuses.reduce((total, status) => total + (counts.get(status) || 0), 0);

export async function aggregateCampaign(campaignId: string): Promise<void> {
  const grouped = await prisma.broadcastRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { _all: true },
  });
  const counts = new Map(grouped.map((item) => [item.status, item._count._all]));
  const total = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
  const sentCount = countFor(counts, ['Sent', 'Delivered', 'Read']);
  const deliveredCount = countFor(counts, ['Delivered', 'Read']);
  const readCount = countFor(counts, ['Read']);
  const failedCount = countFor(counts, ['Failed']);
  const remaining = countFor(counts, ['Pending', 'Processing', 'Retry']);

  let status = 'Sending';
  if (total === 0) status = 'Failed';
  else if (remaining === 0 && sentCount === 0) status = 'Failed';
  else if (remaining === 0 && failedCount > 0) status = 'PartiallyFailed';
  else if (remaining === 0) status = 'Completed';

  const latestFailure = failedCount > 0
    ? await prisma.broadcastRecipient.findFirst({
        where: { campaignId, status: 'Failed' },
        orderBy: { updatedAt: 'desc' },
        select: { lastErrorMessage: true },
      })
    : null;

  await prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: {
      status,
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
      lastError: latestFailure?.lastErrorMessage || null,
      completedAt: remaining === 0 ? new Date() : null,
    },
  });
}

async function ensureQueueSchema() {
  if (isSchemaReady) return true;
  try {
    if (!prisma.broadcastRecipient) {
      if (Date.now() - lastSchemaWarningAt > 60_000) {
        console.warn('[CAMPAIGN WORKER PAUSED] Prisma Client chưa có model BroadcastRecipient. Hãy chạy: npm run db:generate hoặc npm run db:push');
        lastSchemaWarningAt = Date.now();
      }
      return false;
    }
    await prisma.broadcastRecipient.count();
    isSchemaReady = true;
    return true;
  } catch (error: any) {
    if (error?.code !== 'P2021') throw error;
    if (Date.now() - lastSchemaWarningAt > 60_000) {
      console.warn('[CAMPAIGN WORKER PAUSED] Bảng BroadcastRecipient chưa tồn tại. Hãy chạy: npm run db:push');
      lastSchemaWarningAt = Date.now();
    }
    return false;
  }
}

async function recoverStaleRecipients() {
  await prisma.broadcastRecipient.updateMany({
    where: {
      status: 'Processing',
      lockedAt: { lt: new Date(Date.now() - STALE_LOCK_MS) },
    },
    data: {
      status: 'Retry',
      lockedAt: null,
      nextAttemptAt: new Date(),
      lastErrorMessage: 'Worker bị gián đoạn; recipient đã được đưa lại vào hàng đợi.',
    },
  });
}

async function claimRecipient() {
  const now = new Date();
  const candidate = await prisma.broadcastRecipient.findFirst({
    where: {
      status: { in: ['Pending', 'Retry'] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      campaign: { status: { in: ['Pending', 'Sending'] } },
    },
    include: { campaign: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!candidate) return null;

  const claimed = await prisma.broadcastRecipient.updateMany({
    where: {
      id: candidate.id,
      status: candidate.status,
    },
    data: {
      status: 'Processing',
      lockedAt: now,
      attemptCount: { increment: 1 },
    },
  });
  return claimed.count === 1 ? candidate : null;
}

async function failRecipient(
  recipientId: string,
  attemptCount: number,
  retryable: boolean,
  errorCode: string,
  errorMessage: string,
) {
  const shouldRetry = retryable && attemptCount < MAX_ATTEMPTS;
  const backoffMs = 30_000 * Math.pow(4, Math.max(0, attemptCount - 1));
  await prisma.broadcastRecipient.update({
    where: { id: recipientId },
    data: {
      status: shouldRetry ? 'Retry' : 'Failed',
      lockedAt: null,
      nextAttemptAt: shouldRetry ? new Date(Date.now() + backoffMs) : null,
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
    },
  });
}

async function processRecipient() {
  const recipient = await claimRecipient();
  if (!recipient) return false;

  const campaign = recipient.campaign;
  try {
    if (!campaign.templateName) {
      await failRecipient(recipient.id, recipient.attemptCount + 1, false, 'INVALID_TEMPLATE', 'Chiến dịch thiếu tên approved template.');
      await aggregateCampaign(campaign.id);
      return true;
    }

    if (recipient.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: recipient.customerId },
        select: { whatsappOptIn: true },
      });
      if (!customer?.whatsappOptIn) {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: 'Cancelled',
            lockedAt: null,
            lastErrorCode: 'OPT_OUT',
            lastErrorMessage: 'Khách hàng đã thu hồi quyền nhận tin trước khi gửi.',
          },
        });
        await aggregateCampaign(campaign.id);
        return true;
      }
    }

    const setting = await getIntegrationSetting();
    const phoneId = await resolvePhoneNumberId(setting);
    const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim() || '';
    if (!phoneId || !token) {
      await failRecipient(recipient.id, recipient.attemptCount + 1, true, 'NOT_CONFIGURED', 'Chưa cấu hình WhatsApp Phone Number ID hoặc access token.');
      await aggregateCampaign(campaign.id);
      return true;
    }

    const templateData = recipient.templateParams as {
      bodyParameters?: string[];
      renderedMessage?: string;
    } | null;
    const result = await dispatchMetaTemplateMessage({
      phoneId,
      token,
      cleanPhone: recipient.normalizedPhone,
      templateName: campaign.templateName,
      languageCode: campaign.templateLanguage,
      bodyParameters: templateData?.bodyParameters || [],
    });

    if (!result.isRealSent || !result.messageId) {
      await failRecipient(
        recipient.id,
        recipient.attemptCount + 1,
        result.retryable,
        result.errorCode || 'META_REJECTED',
        result.errorMessage || 'Meta không chấp nhận tin nhắn template.',
      );
      await aggregateCampaign(campaign.id);
      return true;
    }

    await prisma.$transaction([
      prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: {
          status: 'Sent',
          metaMessageId: result.messageId,
          sentAt: new Date(),
          lockedAt: null,
          nextAttemptAt: null,
          lastErrorCode: null,
          lastErrorMessage: null,
        },
      }),
      prisma.whatsAppMessage.upsert({
        where: { id: result.messageId },
        update: {},
        create: {
          id: result.messageId,
          customerId: recipient.customerId,
          customerName: recipient.customerName,
          customerPhone: recipient.customerPhone,
          sender: 'agent',
          agentName: 'Broadcast Automation',
          channel: 'WhatsApp',
          content: templateData?.renderedMessage || campaign.messageTemplate,
          isRead: true,
          isRealSent: true,
          timestamp: new Date(),
        },
      }),
    ]);
    await aggregateCampaign(campaign.id);
    return true;
  } catch (error: any) {
    await failRecipient(
      recipient.id,
      recipient.attemptCount + 1,
      true,
      'WORKER_ERROR',
      error?.message || 'Lỗi worker không xác định.',
    );
    await aggregateCampaign(campaign.id).catch(() => {});
    return true;
  }
}

async function runWorkerCycle() {
  if (isRunning) return;
  isRunning = true;
  try {
    if (!(await ensureQueueSchema())) return;
    if (!hasRecoveredStaleRecipients) {
      await recoverStaleRecipients();
      hasRecoveredStaleRecipients = true;
    }
    await Promise.all(Array.from({ length: WORKER_CONCURRENCY }, () => processRecipient()));
  } catch (error) {
    console.error('[CAMPAIGN WORKER ERROR]', error);
  } finally {
    isRunning = false;
  }
}

export function kickCampaignWorker() {
  void runWorkerCycle();
}

export function startCampaignWorker() {
  if (workerTimer) return () => {};
  void runWorkerCycle();
  workerTimer = setInterval(() => void runWorkerCycle(), WORKER_INTERVAL_MS);
  return () => {
    if (workerTimer) clearInterval(workerTimer);
    workerTimer = null;
  };
}
