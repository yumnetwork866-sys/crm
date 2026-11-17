import { prisma } from '../lib/prisma';
import { realtimeHub } from './realtimeHub';
import { isLikelyVietnamese, translateWithOllama } from './ollamaTranslationService';

/** Only translate the message body/caption, never reply metadata or media URLs. */
export function getStoredTranslationText(content: string): string {
  let text = content.replace(/^\[reply:\{.*?\}\]\r?\n/, '').trim();
  if (/^\[whatsapp_order:/i.test(text)) return '';
  if (/^\[product(?:_list)?(?::\s*|\s*)\{/i.test(text)) {
    const match = text.match(/^\[product(?:_list)?(?::\s*|\s*)\{[\s\S]*\}\]\s*([\s\S]*)$/i);
    return match?.[1]?.trim() || '';
  }
  if (
    /^(?:\/api\/meta\/media\/|\/uploads\/|https?:\/\/\S+\.(?:jpg|jpeg|png|webp|gif|pdf|mp3|ogg|wav|mp4)(?:[?\s]|$))/i.test(
      text,
    )
  ) {
    const newline = text.indexOf('\n');
    return newline < 0 ? '' : text.slice(newline + 1).trim();
  }
  if (/^\[(?:Tài liệu|document)\]/i.test(text)) {
    const newline = text.indexOf('\n');
    return newline < 0 ? '' : text.slice(newline + 1).trim();
  }
  text = text.replace(/^\[(?:Hình ảnh|image|photo)\]\s*/i, '').trim();
  if (
    /^\[(?:Video|Nhãn dán|sticker|Vị trí|Cảm xúc|Gỡ cảm xúc|Tin nhắn thoại|audio|voice)\b/i.test(
      text,
    )
  )
    return '';
  return text;
}

export function needsIncomingTranslation(content: string): boolean {
  if (process.env.AUTO_TRANSLATE_INCOMING === 'false') return false;
  const text = getStoredTranslationText(content);
  return Boolean(text && text.length <= 5000 && /\p{L}/u.test(text) && !isLikelyVietnamese(text));
}

interface StoredTranslationResult {
  translation?: string;
  targetLanguage: string;
  model?: string | null;
  alreadyTargetLanguage?: boolean;
  persisted?: boolean;
  skipped?: boolean;
}

export class MessageTranslationError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Both webhook jobs and composer requests share one lane to the translation model.
let translationTail: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<StoredTranslationResult>>();

export function translateStoredMessage(
  messageId: string,
  targetLanguage = 'vi',
): Promise<StoredTranslationResult> {
  const key = JSON.stringify([messageId, targetLanguage]);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const work = translationTail.then(async (): Promise<StoredTranslationResult> => {
    const message = await prisma.whatsAppMessage.findUnique({ where: { id: messageId } });
    if (!message) throw new MessageTranslationError('Không tìm thấy tin nhắn.', 404);
    if (message.translatedContent && message.translatedLanguage === targetLanguage) {
      return {
        translation: message.translatedContent,
        targetLanguage,
        model: message.translationModel,
        persisted: true,
      };
    }
    const text = getStoredTranslationText(message.content);
    if (!text || !/\p{L}/u.test(text)) return { targetLanguage, skipped: true };
    if (targetLanguage === 'vi' && isLikelyVietnamese(text))
      return { targetLanguage, alreadyTargetLanguage: true };
    const result = await translateWithOllama({ text, targetLanguage });
    const translatedAt = new Date();
    const saved = await prisma.whatsAppMessage.updateMany({
      where: { id: messageId, content: message.content },
      data: {
        translatedContent: result.translation,
        translatedLanguage: result.targetLanguage,
        translationModel: result.model,
        translatedAt,
      },
    });
    if (!saved.count)
      throw new MessageTranslationError(
        'Tin nhắn đã thay đổi trong lúc dịch. Vui lòng thử lại.',
        409,
      );
    realtimeHub.broadcast('message:translated', {
      messageId,
      translatedContent: result.translation,
      translatedLanguage: result.targetLanguage,
      translationModel: result.model,
      translatedAt: translatedAt.toISOString(),
    });
    return { ...result, persisted: true };
  });
  const tracked = work.finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  // A failed request must not block subsequent messages.
  translationTail = tracked.catch(() => {});
  return tracked;
}

export async function processIncomingTranslation({
  messageId,
}: {
  messageId: string;
}): Promise<void> {
  const message = await prisma.whatsAppMessage.findUnique({ where: { id: messageId } });
  if (!message || message.sender !== 'customer' || !needsIncomingTranslation(message.content))
    return;
  await translateStoredMessage(messageId);
}
