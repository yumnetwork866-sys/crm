export interface LinkPreviewData {
  url: string;
  domain: string;
  title: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface CacheItem {
  data: LinkPreviewData;
  expiresAt: number;
}

const previewCache = new Map<string, CacheItem>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_CACHE_SIZE = 500;

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => {
      try {
        return String.fromCharCode(Number(dec));
      } catch {
        return '';
      }
    })
    .trim();
}

function isPrivateIpOrHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === 'localhost' || lower.endsWith('.local') || lower.endsWith('.internal')) {
    return true;
  }
  // Check IPv4 private ranges
  if (/^127\./.test(lower) || /^10\./.test(lower) || /^192\.168\./.test(lower) || /^169\.254\./.test(lower)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(lower)) {
    return true;
  }
  if (lower === '0.0.0.0' || lower === '::1') {
    return true;
  }
  return false;
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null;
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (isPrivateIpOrHost(hostname)) {
    return null;
  }

  // Check cache
  const cached = previewCache.get(rawUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const decodedPath = decodeURIComponent(parsedUrl.pathname);

  // 1. Special Handling: Meta / WhatsApp Manager / Facebook Business
  if (
    hostname.includes('facebook.com') ||
    hostname.includes('meta.com') ||
    hostname.includes('whatsapp.com')
  ) {
    if (
      decodedPath.includes('whatsapp_manager') ||
      decodedPath.includes('setup_guidance') ||
      parsedUrl.search.includes('whatsapp_manager') ||
      parsedUrl.search.includes('setup_guidance')
    ) {
      const data: LinkPreviewData = {
        url: rawUrl,
        domain: parsedUrl.hostname,
        title: "WhatsApp Manager · Setup guidance",
        description: "Hoàn tất các bước thiết lập tài khoản WhatsApp Business và theo dõi tiến độ trên máy tính.",
        image: "https://static.whatsapp.net/rsrc.php/v4/yO/r/rukeqTVNJDY.png",
        siteName: "Meta Business Suite",
      };
      saveToCache(rawUrl, data);
      return data;
    }

    if (hostname.includes('whatsapp.com') || hostname === 'wa.me') {
      const data: LinkPreviewData = {
        url: rawUrl,
        domain: parsedUrl.hostname,
        title: "WhatsApp",
        description: "Nền tảng nhắn tin và gọi điện bảo mật.",
        image: "https://static.whatsapp.net/rsrc.php/v4/yO/r/rukeqTVNJDY.png",
        siteName: "WhatsApp",
      };
      saveToCache(rawUrl, data);
      return data;
    }
  }

  // 2. Special Handling: YouTube
  if (hostname.includes('youtube.com') || hostname.includes('youtu.be')) {
    let videoId = '';
    if (hostname.includes('youtu.be')) {
      videoId = parsedUrl.pathname.replace(/^\//, '');
    } else {
      videoId = parsedUrl.searchParams.get('v') || '';
    }
    if (videoId) {
      const data: LinkPreviewData = {
        url: rawUrl,
        domain: parsedUrl.hostname,
        title: "YouTube Video",
        description: "Xem video trên YouTube",
        image: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        siteName: "YouTube",
      };
      saveToCache(rawUrl, data);
      return data;
    }
  }

  // 3. Generic website fetcher
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'WhatsApp/2.23.23 (compatible; Mozilla/5.0; CRM LinkPreview)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi,en;q=0.9',
      },
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!res.ok) {
      return fallbackPreview(parsedUrl, rawUrl);
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return fallbackPreview(parsedUrl, rawUrl);
    }

    // Read initial 300KB
    const html = await res.text();
    const truncatedHtml = html.slice(0, 300000);

    const ogTitle =
      truncatedHtml.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      truncatedHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i)?.[1] ||
      truncatedHtml.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      parsedUrl.hostname;

    const ogDesc =
      truncatedHtml.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      truncatedHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1] ||
      truncatedHtml.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      truncatedHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1] ||
      '';

    let ogImage =
      truncatedHtml.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      truncatedHtml.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i)?.[1] ||
      truncatedHtml.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      '';

    const ogSiteName =
      truncatedHtml.match(/<meta[^>]*property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i)?.[1] ||
      parsedUrl.hostname;

    // Resolve relative image URLs
    if (ogImage && !ogImage.startsWith('http://') && !ogImage.startsWith('https://')) {
      try {
        ogImage = new URL(ogImage, rawUrl).toString();
      } catch {
        ogImage = '';
      }
    }

    const data: LinkPreviewData = {
      url: rawUrl,
      domain: parsedUrl.hostname,
      title: decodeHtmlEntities(ogTitle),
      description: decodeHtmlEntities(ogDesc),
      image: ogImage || undefined,
      siteName: decodeHtmlEntities(ogSiteName),
    };

    saveToCache(rawUrl, data);
    return data;
  } catch (err) {
    return fallbackPreview(parsedUrl, rawUrl);
  }
}

function fallbackPreview(parsedUrl: URL, rawUrl: string): LinkPreviewData {
  const data: LinkPreviewData = {
    url: rawUrl,
    domain: parsedUrl.hostname,
    title: parsedUrl.hostname,
    description: parsedUrl.pathname !== '/' ? parsedUrl.pathname : undefined,
  };
  saveToCache(rawUrl, data);
  return data;
}

function saveToCache(url: string, data: LinkPreviewData) {
  if (previewCache.size >= MAX_CACHE_SIZE) {
    const firstKey = previewCache.keys().next().value;
    if (firstKey) previewCache.delete(firstKey);
  }
  previewCache.set(url, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}
