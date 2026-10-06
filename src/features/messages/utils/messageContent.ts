import type { CentralMessage } from '../../../types';

export interface ImageInfo {
  isImage: boolean;
  imgUrl: string | null;
  caption: string | null;
}

export interface AudioInfo {
  isAudio: boolean;
  audioUrl: string | null;
  caption: string | null;
}

const AUDIO_EXTENSIONS_REGEX = /\.(mp3|ogg|wav|m4a|aac|webm|opus)(\?[^\s\n]*)?$/i;

export function isAudioContent(rawContent: string): boolean {
  if (!rawContent) return false;
  const content = rawContent.trim();
  if (content.startsWith('data:audio/')) return true;
  const firstLine = content.split('\n')[0].trim();
  if (AUDIO_EXTENSIONS_REGEX.test(firstLine)) return true;
  if (firstLine.startsWith('/uploads/') && AUDIO_EXTENSIONS_REGEX.test(firstLine)) return true;
  if (firstLine.startsWith('/api/meta/media/') && firstLine.includes('type=audio')) return true;
  if (/^\[(tin nhắn thoại|audio|voice|voice note)/i.test(firstLine)) return true;
  return false;
}

export function extractAudioInfo(rawContent: string): AudioInfo {
  if (!rawContent) return { isAudio: false, audioUrl: null, caption: null };
  const content = rawContent.trim();

  // 1. Data URL
  if (content.startsWith('data:audio/')) {
    const parts = content.split('\n');
    return { isAudio: true, audioUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  // 2. Uploaded / URL audio
  const firstLine = content.split('\n')[0].trim();
  if (AUDIO_EXTENSIONS_REGEX.test(firstLine)) {
    const parts = content.split('\n');
    return { isAudio: true, audioUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  // 3. Meta Media Audio Proxy
  if (firstLine.startsWith('/api/meta/media/') && firstLine.includes('type=audio')) {
    const parts = content.split('\n');
    return { isAudio: true, audioUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  // 4. Voice message placeholder
  if (/^\[(tin nhắn thoại|audio|voice|voice note)/i.test(firstLine)) {
    const caption = content
      .replace(/^\[(tin nhắn thoại \(Audio\)|tin nhắn thoại|audio message|audio|voice note|voice)\]?:?\s*/i, '')
      .replace(/\[|\]/g, '')
      .trim();
    return { isAudio: true, audioUrl: null, caption: caption || null };
  }

  return { isAudio: false, audioUrl: null, caption: null };
}

export function extractImageInfo(rawContent: string): ImageInfo {
  if (!rawContent) return { isImage: false, imgUrl: null, caption: null };
  if (isAudioContent(rawContent)) return { isImage: false, imgUrl: null, caption: null };
  const content = rawContent.trim();

  if (content.startsWith('data:image/') || content.startsWith('/uploads/') || content.startsWith('/api/meta/media/')) {
    const parts = content.split('\n');
    return { isImage: true, imgUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  if (/^https?:\/\/[^\s\n]+\.(png|jpg|jpeg|gif|webp)(\?[^\s\n]*)?$/i.test(content)) {
    const parts = content.split('\n');
    return { isImage: true, imgUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  const embeddedMatch = content.match(/(https?:\/\/[^\s\]\n]+|data:image\/[a-zA-Z+]+;base64,[^\s\]\n]+|\/uploads\/[^\s\]\n]+|\/api\/meta\/media\/[^\s\]\n]+)/i);
  if (embeddedMatch) {
    const imgUrl = embeddedMatch[0];
    const caption = content
      .replace(imgUrl, '')
      .replace(/^\[(image message|image|hình ảnh|photo)\]?:?\s*/i, '')
      .replace(/\[|\]/g, '')
      .trim();
    return { isImage: true, imgUrl, caption: caption || null };
  }

  if (/^\[(image|hình ảnh|image message|photo)/i.test(content)) {
    const caption = content
      .replace(/^\[(image message|image|hình ảnh|photo)\]?:?\s*/i, '')
      .replace(/\[|\]/g, '')
      .trim();
    return { isImage: false, imgUrl: null, caption: caption || null };
  }

  return { isImage: false, imgUrl: null, caption: null };
}

interface ParsedMessageContent {
  replyTo?: NonNullable<CentralMessage['replyTo']>;
  cleanContent: string;
}

function isReplyReference(value: unknown): value is NonNullable<CentralMessage['replyTo']> {
  if (!value || typeof value !== 'object') return false;
  const reply = value as Record<string, unknown>;
  return typeof reply.id === 'string'
    && typeof reply.senderName === 'string'
    && typeof reply.content === 'string';
}

export function parseMessageContent(
  content: string,
  existingReplyTo?: CentralMessage['replyTo']
): ParsedMessageContent {
  if (existingReplyTo?.content) return { replyTo: existingReplyTo, cleanContent: content };
  if (!content.startsWith('[reply:')) return { cleanContent: content };

  const match = content.match(/^\[reply:(\{.*?\})\]\n([\s\S]*)$/);
  if (!match) return { cleanContent: content };

  try {
    const replyTo: unknown = JSON.parse(match[1]);
    return isReplyReference(replyTo)
      ? { replyTo, cleanContent: match[2] }
      : { cleanContent: content };
  } catch {
    return { cleanContent: content };
  }
}
