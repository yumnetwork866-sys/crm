import { prisma } from '../../lib/prisma';
import { createLogger } from '../../lib/logger';
import { realtimeHub } from '../realtimeHub';
import { normalizeMetaRecipient } from '../../utils/metaRecipient';
import {
  getIntegrationSetting,
  getMetaAccessTokenForPhone,
  dispatchMetaMessage,
} from '../metaApiClient';
import { isCustomerDemandingHuman, isCustomerAngryOrComplaining } from '../difyService';
import { generateNativeAi, getAiConfig } from './nativeAiService';
import type { DifyReplyJobData } from '../queueService';

const log = createLogger('native-auto-reply');
const stateId = (phone: string, phoneId?: string) =>
  JSON.stringify([phoneId || '*', normalizeMetaRecipient(phone)]);
export async function isNativeAiActive(phone: string, phoneId?: string) {
  const states = await prisma.aiConversationState.findMany({
    where: { id: { in: [stateId(phone), stateId(phone, phoneId)] } },
  });
  return !states.some((state) => state.pausedUntil && state.pausedUntil > new Date());
}
export async function pauseNativeAi(phone: string, minutes = 0, phoneId?: string) {
  const pausedUntil =
    minutes > 0 ? new Date(Date.now() + minutes * 60000) : new Date('9999-12-31T00:00:00Z');
  await prisma.aiConversationState.upsert({
    where: { id: stateId(phone, phoneId) },
    update: { pausedUntil },
    create: { id: stateId(phone, phoneId), pausedUntil },
  });
}
export async function resumeNativeAi(phone: string, phoneId?: string) {
  await prisma.aiConversationState.updateMany({
    where: { id: stateId(phone, phoneId) },
    data: { pausedUntil: null },
  });
}
export const isNativeGlobalAiEnabled = async () => (await getAiConfig()).autoReplyEnabled;
export async function setNativeGlobalAiEnabled(enabled: boolean) {
  await prisma.aiConfiguration.upsert({
    where: { id: 'default' },
    create: { id: 'default', autoReplyEnabled: enabled },
    update: { autoReplyEnabled: enabled },
  });
  return enabled;
}

export async function autoReplyWithNativeAi(input: DifyReplyJobData): Promise<boolean> {
  const { fromPhone, businessPhoneNumberId: phoneId, incomingMsgId } = input;
  if (
    !phoneId ||
    !incomingMsgId ||
    !(await isNativeGlobalAiEnabled()) ||
    !(await isNativeAiActive(fromPhone, phoneId))
  )
    return false;
  const text = input.incomingText.trim();
  if (
    !text ||
    text.startsWith('[') ||
    text.startsWith('/api/meta/media/') ||
    normalizeMetaRecipient(fromPhone) === '16465894168'
  )
    return false;
  if (
    isCustomerDemandingHuman(text) ||
    isCustomerAngryOrComplaining(text) ||
    /^(stop|huy|dung|unsubscribe|tam dung)$/i.test(text)
  ) {
    await pauseNativeAi(fromPhone, 0, phoneId);
    realtimeHub.broadcast('ai:status', {
      phone: fromPhone,
      businessPhoneNumberId: phoneId,
      isAiActive: false,
    });
    log.info({ messageId: incomingMsgId, phoneId }, 'Conversation handed over to staff');
    return false;
  }
  const latestMessage = () =>
    prisma.whatsAppMessage.findFirst({
      where: { businessPhoneNumberId: phoneId, customerPhone: fromPhone },
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
    });
  const initial = await latestMessage();
  if (!initial || initial.id !== incomingMsgId || initial.sender !== 'customer') return false;
  const connection = await prisma.whatsAppConnection.findUnique({
    where: { phoneNumberId: phoneId },
    select: { verifiedName: true },
  });
  const brandName =
    connection?.verifiedName ||
    (input.brandName && !/^[\d\s+()-]+$/.test(input.brandName) ? input.brandName : 'Yum Network');
  const result = await generateNativeAi(
    {
      phone: fromPhone,
      customerId: input.customerId,
      businessPhoneNumberId: phoneId,
      customerName: input.customerName,
      brandName,
    },
    'reply',
  );
  const current = await latestMessage();
  if (
    !result.shouldAutoReply ||
    !current ||
    current.id !== incomingMsgId ||
    !(await isNativeGlobalAiEnabled()) ||
    !(await isNativeAiActive(fromPhone, phoneId))
  ) {
    await prisma.aiRun.update({
      where: { id: result.runId },
      data: {
        status: 'blocked',
        stage: 'dispatch-check',
        errorCode: 'NOT_SENT',
        errorMessage: result.shouldAutoReply
          ? 'Hội thoại hoặc trạng thái AI đã thay đổi trước khi gửi.'
          : result.reason,
      },
    });
    return false;
  }
  // Persist a claim before dispatch. An uncertain delivery is never retried blindly.
  const id = stateId(fromPhone, phoneId);
  await prisma.aiConversationState.upsert({ where: { id }, update: {}, create: { id } });
  const claimed = await prisma.aiConversationState.updateMany({
    where: {
      id,
      OR: [{ lastAttemptMessageId: null }, { lastAttemptMessageId: { not: incomingMsgId } }],
    },
    data: { lastAttemptMessageId: incomingMsgId },
  });
  if (!claimed.count) return false;
  try {
    const setting = await getIntegrationSetting();
    const token = await getMetaAccessTokenForPhone(phoneId, setting);
    if (!token) throw new Error('Chưa có token Meta hợp lệ cho số WhatsApp này.');
    // Check again after token/database work, immediately before the external send.
    const availableSources = await prisma.aiKnowledgeChunk.count({
      where: { id: { in: result.sourceIds }, document: { enabled: true } },
    });
    if (
      availableSources !== result.sourceIds.length ||
      !(await isNativeAiActive(fromPhone, phoneId)) ||
      !(await isNativeGlobalAiEnabled()) ||
      (await latestMessage())?.id !== incomingMsgId
    ) {
      await prisma.aiRun.update({
        where: { id: result.runId },
        data: {
          status: 'blocked',
          stage: 'dispatch-check',
          errorCode: 'CONTEXT_CHANGED',
          errorMessage: 'Nguồn kiến thức hoặc trạng thái hội thoại đã thay đổi trước khi gửi.',
        },
      });
      return false;
    }
    const sent = await dispatchMetaMessage({
      phoneId,
      token,
      cleanPhone: normalizeMetaRecipient(fromPhone),
      content: result.answer,
      contextMessageId: incomingMsgId,
    });
    if (!sent.isRealSent) throw new Error('Meta không xác nhận gửi tin thành công.');
    const metaId = sent.metaResult?.messages?.[0]?.id;
    if (!metaId) throw new Error('Meta không trả ID tin nhắn. Kiểm tra trước khi gửi lại.');
    const message = await prisma.whatsAppMessage.create({
      data: {
        id: metaId,
        customerId: input.isCrmCustomer ? input.customerId : null,
        customerName: input.customerName,
        customerPhone: fromPhone,
        businessPhoneNumberId: phoneId,
        sender: 'agent',
        agentName: setting.aiName || 'Trợ lý AI',
        isAi: true,
        content: result.answer,
        isRead: true,
        isRealSent: true,
        status: 'sent',
      },
    });
    await prisma.aiConversationState.update({ where: { id }, data: { lastSentMessageId: metaId } });
    await prisma.aiRun.update({ where: { id: result.runId }, data: { stage: 'sent' } });
    realtimeHub.broadcast('message:new', message);
    return true;
  } catch (error) {
    log.error(
      { err: error, runId: result.runId, incomingMsgId, phoneId },
      'Automatic AI dispatch failed; manual review required',
    );
    await prisma.aiRun.update({
      where: { id: result.runId },
      data: {
        status: 'error',
        stage: 'dispatch',
        errorCode: 'DISPATCH_FAILED',
        errorMessage: 'Không hoàn tất gửi hoặc lưu tin. Kiểm tra Meta và log trước khi gửi lại.',
      },
    });
    return false;
  }
}
