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

export interface DocumentInfo {
  isDocument: boolean;
  docUrl: string | null;
  filename: string;
  filesize?: number | null;
  caption: string | null;
  fileExt: string;
}

export interface ProductMessageInfo {
  isProduct: boolean;
  catalogId: string;
  retailerId: string;
  name: string;
  price?: string | number;
  currency?: string;
  imageUrl?: string;
  caption: string | null;
}

const AUDIO_EXTENSIONS_REGEX = /\.(mp3|ogg|wav|m4a|aac|webm|opus)(\?[^\s\n]*)?$/i;
const DOC_EXTENSIONS_REGEX = /\.(pdf|doc|docx|xls|xlsx|csv|txt)(\?[^\s\n]*)?$/i;

export function isProductContent(rawContent: string): boolean {
  if (!rawContent) return false;
  const content = rawContent.replace(/^\[reply:\{.*?\}\]\n/, '').trim();
  return /^\[product(?:_list)?(?::\s*|\s*)\{/i.test(content);
}

export function extractProductInfo(rawContent: string): ProductMessageInfo {
  if (!rawContent) {
    return { isProduct: false, catalogId: '', retailerId: '', name: '', caption: null };
  }
  const content = rawContent.replace(/^\[reply:\{.*?\}\]\n/, '').trim();
  if (!/^\[product(?:_list)?(?::\s*|\s*)\{/i.test(content)) {
    return { isProduct: false, catalogId: '', retailerId: '', name: '', caption: null };
  }

  // 1. Single product: [product:{"catalog_id":"..."}] or [product{"catalog_id":"..."}]
  const match = content.match(/^\[product(?::\s*|\s*)(\{[\s\S]*?\})\]\n?([\s\S]*)$/i);
  if (match) {
    try {
      const meta = JSON.parse(match[1]);
      const caption = match[2]?.trim() || null;
      return {
        isProduct: true,
        catalogId: String(meta.catalog_id || ''),
        retailerId: String(meta.product_retailer_id || ''),
        name: String(meta.name || meta.title || meta.product_retailer_id || 'Sản phẩm Catalog'),
        price: meta.price,
        currency: meta.currency,
        imageUrl: meta.image || meta.imageUrl,
        caption,
      };
    } catch {
      const caption = match[2]?.trim() || null;
      return {
        isProduct: true,
        catalogId: '',
        retailerId: '',
        name: 'Sản phẩm Catalog',
        caption,
      };
    }
  }

  // 2. Product list: [product_list:{"catalog_id":"..."}] or [product_list{"catalog_id":"..."}]
  const listMatch = content.match(/^\[product_list(?::\s*|\s*)(\{[\s\S]*?\})\]\n?([\s\S]*)$/i);
  if (listMatch) {
    try {
      const meta = JSON.parse(listMatch[1]);
      const caption = listMatch[2]?.trim() || null;
      return {
        isProduct: true,
        catalogId: String(meta.catalog_id || ''),
        retailerId: '',
        name: String(meta.header || meta.title || 'Danh mục sản phẩm'),
        caption,
      };
    } catch {
      const caption = listMatch[2]?.trim() || null;
      return {
        isProduct: true,
        catalogId: '',
        retailerId: '',
        name: 'Danh mục sản phẩm',
        caption,
      };
    }
  }

  // 3. Fallback for malformed or truncated tag
  const nameMatch = content.match(/"name"\s*:\s*"([^"]+)"/i);
  return {
    isProduct: true,
    catalogId: '',
    retailerId: '',
    name: nameMatch ? nameMatch[1] : 'Sản phẩm Catalog',
    caption: null,
  };
}

/**
 * Generates a clean human-readable preview text for a message (for thread lists, reply banners, toasts, quotes, etc.)
 */
export function formatMessagePreview(rawContent: string | null | undefined): string {
  if (!rawContent) return '';

  // 1. Strip reply reference if present at start
  const clean = rawContent.replace(/^\[reply:\{.*?\}\]\n/, '').trim();
  if (!clean) return '';

  // 2. Product message
  if (isProductContent(clean)) {
    const prod = extractProductInfo(clean);
    const prodName = prod.name && prod.name !== 'Sản phẩm Catalog' && prod.name !== 'Danh mục sản phẩm'
      ? prod.name
      : (prod.name || 'Sản phẩm');
    if (prodName) {
      return prod.caption ? `🛍️ [Sản phẩm] ${prodName}: ${prod.caption}` : `🛍️ [Sản phẩm] ${prodName}`;
    }
    return prod.caption ? `🛍️ [Sản phẩm] ${prod.caption}` : '🛍️ [Sản phẩm]';
  }

  if (/^\[product(?:_list)?(?::\s*|\s*)\{/i.test(clean)) {
    return '🛍️ [Sản phẩm]';
  }

  // 3. Image message
  if (
    clean.startsWith('data:image/') ||
    clean.startsWith('/uploads/') ||
    clean.startsWith('/api/meta/media/') ||
    /^https?:\/\/[^\s\n]+\.(png|jpg|jpeg|gif|webp)(\?[^\s\n]*)?$/i.test(clean)
  ) {
    const parts = clean.split('\n');
    const cap = parts.slice(1).join(' ').trim();
    return cap ? `📷 ${cap}` : '📷 [Hình ảnh]';
  }
  if (
    clean.toLowerCase().startsWith('[image') ||
    clean.toLowerCase().startsWith('[hình ảnh') ||
    clean.toLowerCase() === '[photo]'
  ) {
    const cleanedImg = clean
      .replace(/\[image message\]/gi, '[Hình ảnh]')
      .replace(/\[image\]/gi, '[Hình ảnh]')
      .replace(/\[photo\]/gi, '[Hình ảnh]');
    return `📷 ${cleanedImg.replace(/^📷\s*/, '')}`;
  }

  // 4. Audio / Voice note
  if (isAudioContent(clean)) {
    const audio = extractAudioInfo(clean);
    return audio.caption ? `🎙️ [Tin nhắn thoại] ${audio.caption}` : '🎙️ [Tin nhắn thoại]';
  }

  // 5. Document message
  if (isDocumentContent(clean)) {
    const doc = extractDocumentInfo(clean);
    const docName = doc.filename && doc.filename !== 'Tài liệu đính kèm' ? doc.filename : '';
    if (docName) {
      return doc.caption ? `📄 [Tài liệu] ${docName}: ${doc.caption}` : `📄 [Tài liệu] ${docName}`;
    }
    return doc.caption ? `📄 [Tài liệu] ${doc.caption}` : '📄 [Tài liệu]';
  }

  // 6. Regular text message - flatten multi-line to single line for preview
  return clean.replace(/\r?\n+/g, ' ');
}


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

export function isDocumentContent(rawContent: string): boolean {
  if (!rawContent) return false;
  const content = rawContent.trim();
  if (content.startsWith('[document:')) return true;
  if (content.startsWith('data:application/') || content.startsWith('data:text/csv') || content.startsWith('data:text/plain')) return true;
  const firstLine = content.split('\n')[0].trim();
  if (DOC_EXTENSIONS_REGEX.test(firstLine)) return true;
  if (firstLine.startsWith('/uploads/') && DOC_EXTENSIONS_REGEX.test(firstLine)) return true;
  if (firstLine.startsWith('/api/meta/media/') && firstLine.includes('type=document')) return true;
  if (/^\[(tài liệu|document)/i.test(firstLine)) return true;
  return false;
}

export function extractDocumentInfo(rawContent: string): DocumentInfo {
  if (!rawContent) {
    return { isDocument: false, docUrl: null, filename: '', filesize: null, caption: null, fileExt: '' };
  }
  const content = rawContent.trim();

  // 1. Tag format [document:{"url":"...","filename":"...","size":...}]
  if (content.startsWith('[document:')) {
    const match = content.match(/^\[document:(\{.*?\})\]\n?([\s\S]*)$/);
    if (match) {
      try {
        const meta = JSON.parse(match[1]);
        const filename = meta.filename || 'Tài liệu đính kèm';
        const fileExt = (filename.split('.').pop() || 'pdf').toLowerCase();
        return {
          isDocument: true,
          docUrl: meta.url || null,
          filename,
          filesize: meta.size || null,
          caption: match[2]?.trim() || null,
          fileExt,
        };
      } catch {
        // ignore parse error
      }
    }
  }

  // 2. Data URL format
  if (content.startsWith('data:application/') || content.startsWith('data:text/csv') || content.startsWith('data:text/plain')) {
    const parts = content.split('\n');
    const dataUrl = parts[0];
    const caption = parts.slice(1).join('\n').trim() || null;
    let fileExt = 'pdf';
    if (dataUrl.includes('sheet') || dataUrl.includes('excel')) fileExt = 'xlsx';
    else if (dataUrl.includes('word') || dataUrl.includes('msword')) fileExt = 'docx';
    else if (dataUrl.includes('csv')) fileExt = 'csv';
    else if (dataUrl.includes('plain')) fileExt = 'txt';
    return {
      isDocument: true,
      docUrl: dataUrl,
      filename: `Tài liệu.${fileExt}`,
      filesize: null,
      caption,
      fileExt,
    };
  }

  // 3. Meta Media Document Proxy
  const firstLine = content.split('\n')[0].trim();
  if (firstLine.startsWith('/api/meta/media/') && firstLine.includes('type=document')) {
    const parts = content.split('\n');
    const docUrl = parts[0];
    const caption = parts.slice(1).join('\n').trim() || null;
    let filename = 'Tài liệu.pdf';
    try {
      const urlObj = new URL(docUrl, 'http://localhost');
      filename = urlObj.searchParams.get('filename') || 'Tài liệu.pdf';
    } catch {
      // ignore
    }
    const fileExt = (filename.split('.').pop() || 'pdf').toLowerCase();
    return {
      isDocument: true,
      docUrl,
      filename,
      filesize: null,
      caption,
      fileExt,
    };
  }

  // 4. File URL or /uploads/ path
  if (DOC_EXTENSIONS_REGEX.test(firstLine)) {
    const parts = content.split('\n');
    const docUrl = parts[0];
    const caption = parts.slice(1).join('\n').trim() || null;
    const cleanUrl = docUrl.split('?')[0];
    const filename = decodeURIComponent(cleanUrl.split('/').pop() || 'Tài liệu');
    const fileExt = (filename.split('.').pop() || 'pdf').toLowerCase();
    return {
      isDocument: true,
      docUrl,
      filename,
      filesize: null,
      caption,
      fileExt,
    };
  }

  // 5. Placeholder from webhook without direct URL
  if (/^\[(tài liệu|document)/i.test(firstLine)) {
    const cleanTag = content.replace(/^\[(tài liệu|document)\]:?\s*/i, '').trim();
    const parts = cleanTag.split('\n');
    const filename = parts[0] || 'Tài liệu đính kèm';
    const caption = parts.slice(1).join('\n').trim() || null;
    const fileExt = (filename.split('.').pop() || 'pdf').toLowerCase();
    return {
      isDocument: true,
      docUrl: null,
      filename,
      filesize: null,
      caption,
      fileExt,
    };
  }

  return { isDocument: false, docUrl: null, filename: '', filesize: null, caption: null, fileExt: '' };
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
  if (isAudioContent(rawContent) || isDocumentContent(rawContent)) return { isImage: false, imgUrl: null, caption: null };
  const content = rawContent.trim();

  if (content.startsWith('data:image/') || content.startsWith('/uploads/') || content.startsWith('/api/meta/media/')) {
    const parts = content.split('\n');
    return { isImage: true, imgUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  if (/^https?:\/\/[^\s\n]+\.(png|jpg|jpeg|gif|webp)(\?[^\s\n]*)?$/i.test(content)) {
    const parts = content.split('\n');
    return { isImage: true, imgUrl: parts[0], caption: parts.slice(1).join('\n').trim() || null };
  }

  const embeddedMatch = content.match(/(https?:\/\/[^\s\]\n]+\.(png|jpg|jpeg|gif|webp|svg)(\?[^\s\]\n]*)?|data:image\/[a-zA-Z+]+;base64,[^\s\]\n]+|\/uploads\/[^\s\]\n]+\.(png|jpg|jpeg|gif|webp|svg)(\?[^\s\]\n]*)?|\/api\/meta\/media\/[^\s\]\n]+)/i);
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
