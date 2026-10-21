import type { CentralMessage } from '../../../types';
import {
  extractAudioInfo,
  extractDocumentInfo,
  extractImageInfo,
  extractProductInfo,
  extractWhatsAppOrderInfo,
  parseMessageContent,
} from './messageContent';

const VIETNAMESE_MARKS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const VIETNAMESE_WORDS = /\b(?:không|được|mình|bạn|anh|chị|em|cảm|ơn|giá|giao|hàng|sản phẩm|bao nhiêu|nhé|ạ)\b/gi;

export function isLikelyVietnamese(text: string): boolean {
  if (VIETNAMESE_MARKS.test(text)) return true;
  return (text.match(VIETNAMESE_WORDS) || []).length >= 2;
}

export function getTranslatableMessageText(message: CentralMessage): string {
  const content = parseMessageContent(message.content, message.replyTo).cleanContent.trim();
  if (!content || extractWhatsAppOrderInfo(content).isOrder) return '';
  const product = extractProductInfo(content);
  if (product.isProduct) return product.caption?.trim() || '';
  const image = extractImageInfo(content);
  if (image.isImage) return image.caption?.trim() || '';
  const audio = extractAudioInfo(content);
  if (audio.isAudio) return audio.caption?.trim() || '';
  const document = extractDocumentInfo(content);
  if (document.isDocument) return document.caption?.trim() || '';
  if (/^\[(?:image|hình ảnh|photo|audio|voice|tin nhắn thoại|document|tài liệu)[^\]]*\]$/i.test(content)) return '';
  return content;
}

export function canTranslateMessage(message: CentralMessage): boolean {
  const text = getTranslatableMessageText(message);
  return Boolean(text) && !isLikelyVietnamese(text);
}
