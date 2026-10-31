import { prisma } from '../../lib/prisma';
import {
  getIntegrationSetting,
  getMetaAccessToken,
  getMetaAccessTokenForPhone,
} from './integrationSettings.service';
import {
  saveUploadedFile,
  getUploadedFile,
  extensionFromMime,
} from '../fileStorage.service';

/**
 * Upload media directly to Meta Graph API for real WhatsApp image dispatch
 */
export async function uploadMediaToMeta(
  phoneId: string,
  token: string,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  try {
    const formData = new FormData();
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, filename);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', mimeType);

    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/media`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: formData
    });

    const data: any = await res.json().catch(() => ({}));
    if (res.ok && data?.id) {
      console.log(`[META DIRECT MEDIA UPLOAD] Uploaded image to Meta Cloud CDN, Media ID: ${data.id}`);
      return data.id;
    } else {
      console.warn('[META DIRECT MEDIA UPLOAD FAILED]', data);
      return null;
    }
  } catch (err) {
    console.error('[META DIRECT MEDIA UPLOAD ERROR]', err);
    return null;
  }
}

export async function uploadTemplateSampleMedia(options: {
  appId: string;
  token: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}): Promise<string> {
  const sessionParams = new URLSearchParams({
    file_name: options.fileName,
    file_length: String(options.buffer.length),
    file_type: options.mimeType,
    access_token: options.token,
  });
  const sessionResponse = await fetch(
    `https://graph.facebook.com/v26.0/${options.appId}/uploads?${sessionParams.toString()}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(20_000),
    },
  );
  const sessionResult: any = await sessionResponse.json().catch(() => ({}));
  if (!sessionResponse.ok || !sessionResult?.id) {
    throw new Error(
      sessionResult?.error?.error_user_msg
      || sessionResult?.error?.message
      || 'Meta không thể khởi tạo phiên tải file.',
    );
  }

  const uploadResponse = await fetch(
    `https://graph.facebook.com/v26.0/${encodeURIComponent(sessionResult.id)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${options.token}`,
        file_offset: '0',
        'Content-Type': 'application/octet-stream',
      },
      body: options.buffer,
      signal: AbortSignal.timeout(30_000),
    },
  );
  const uploadResult: any = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || !uploadResult?.h) {
    throw new Error(
      uploadResult?.error?.error_user_msg
      || uploadResult?.error?.message
      || 'Meta không thể nhận file mẫu.',
    );
  }
  return uploadResult.h;
}

async function fetchMetaMediaBinary(mediaId: string, token: string): Promise<{ buffer: Buffer; contentType: string } | null> {
  const metaMediaRes = await fetch(`https://graph.facebook.com/v22.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!metaMediaRes.ok) {
    const errText = await metaMediaRes.text().catch(() => '');
    console.warn(`[META MEDIA PROXY METADATA FAILED] Media ID: ${mediaId}, status: ${metaMediaRes.status}`, errText);
    return null;
  }

  const metaMediaData: any = await metaMediaRes.json();
  const downloadUrl = metaMediaData?.url;
  if (!downloadUrl) return null;

  const binaryRes = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!binaryRes.ok) return null;

  const contentType = binaryRes.headers.get('content-type') || metaMediaData?.mime_type || 'image/jpeg';
  const buffer = Buffer.from(await binaryRes.arrayBuffer());
  return { buffer, contentType };
}

async function saveMediaToDatabase(mediaId: string, contentType: string, buffer: Buffer): Promise<void> {
  const ext = extensionFromMime(contentType);
  const filename = `meta_${mediaId}.${ext}`;
  try {
    await saveUploadedFile('chat', filename, contentType, buffer);
  } catch (err) {
    console.warn('Could not save media cache to database:', err);
  }
}

/**
 * Fetch media from Meta CDN, cache to database, and return file buffer + mimeType
 */
export async function fetchAndCacheMetaMedia(
  mediaId: string,
  preferredPhoneNumberId?: string
): Promise<{ buffer: Buffer; contentType: string } | null> {
  // 1. Check database cache
  const cachedExtensions = ['jpg', 'png', 'webp', 'jpeg', 'ogg', 'mp3', 'm4a', 'wav', 'webm', 'aac', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt'];
  for (const ext of cachedExtensions) {
    const cached = await getUploadedFile('chat', `meta_${mediaId}.${ext}`);
    if (cached) {
      return { buffer: cached.buffer, contentType: cached.mimeType };
    }
  }

  // 2. Direct exact match: Determine exact receiving phone number (1 single call)
  let exactPhoneId = preferredPhoneNumberId?.trim();
  if (!exactPhoneId) {
    try {
      const matchedMsg = await prisma.whatsAppMessage.findFirst({
        where: { content: { contains: mediaId } },
        select: { businessPhoneNumberId: true },
      });
      if (matchedMsg?.businessPhoneNumberId) {
        exactPhoneId = matchedMsg.businessPhoneNumberId;
      }
    } catch {
      // Non-fatal
    }
  }

  const triedTokens = new Set<string>();

  if (exactPhoneId) {
    const directToken = await getMetaAccessTokenForPhone(exactPhoneId).catch(() => '');
    if (directToken) {
      triedTokens.add(directToken);
      const media = await fetchMetaMediaBinary(mediaId, directToken);
      if (media) {
        await saveMediaToDatabase(mediaId, media.contentType, media.buffer);
        return media;
      }
    }
  }

  // 3. Parallel fallback: If exact phone wasn't known or its token failed, query all other accounts IN PARALLEL
  const fallbackTokens: string[] = [];
  const addFallbackToken = (t?: string | null) => {
    const trimmed = t?.trim();
    if (trimmed && !triedTokens.has(trimmed) && !fallbackTokens.includes(trimmed)) {
      fallbackTokens.push(trimmed);
    }
  };

  try {
    const connections = await prisma.whatsAppConnection.findMany({
      where: { status: 'connected' },
      select: { phoneNumberId: true },
    });
    for (const conn of connections) {
      if (conn.phoneNumberId !== exactPhoneId) {
        const tok = await getMetaAccessTokenForPhone(conn.phoneNumberId).catch(() => '');
        addFallbackToken(tok);
      }
    }
  } catch {
    // Non-fatal
  }

  try {
    const setting = await getIntegrationSetting();
    const defaultTok = await getMetaAccessToken(setting);
    addFallbackToken(defaultTok);
  } catch {
    // Non-fatal
  }

  if (fallbackTokens.length > 0) {
    try {
      const media = await Promise.any(
        fallbackTokens.map(async (token) => {
          const res = await fetchMetaMediaBinary(mediaId, token);
          if (!res) throw new Error('Token not authorized');
          return res;
        })
      );
      if (media) {
        await saveMediaToDatabase(mediaId, media.contentType, media.buffer);
        return media;
      }
    } catch {
      // All fallback tokens failed
    }
  }

  return null;
}
