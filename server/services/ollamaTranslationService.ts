const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_TRANSLATION_MODEL = 'translategemma:12b';
const DEFAULT_TRANSLATION_TIMEOUT_MS = 90_000;

const TARGET_LANGUAGES = {
  vi: 'Vietnamese',
  en: 'English',
  ms: 'Malay',
  'zh-Hans': 'Chinese (Simplified)',
  ja: 'Japanese',
  ko: 'Korean',
  th: 'Thai',
} as const;

export type TranslationTargetLanguage = keyof typeof TARGET_LANGUAGES;

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}

export interface TranslationResult {
  translation: string;
  targetLanguage: TranslationTargetLanguage;
  model: string;
}

const VIETNAMESE_MARKS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;
const VIETNAMESE_WORDS = /\b(?:không|được|mình|bạn|anh|chị|em|cảm|ơn|giá|giao|hàng|sản phẩm|bao nhiêu|nhé|ạ)\b/gi;

export function isLikelyVietnamese(text: string): boolean {
  if (VIETNAMESE_MARKS.test(text)) return true;
  return (text.match(VIETNAMESE_WORDS) || []).length >= 2;
}

const readPositiveInteger = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const normalizeTranslation = (value: string) => value
  .trim()
  .replace(/^```(?:\w+)?\s*/i, '')
  .replace(/\s*```$/, '')
  .replace(/^(?:translation|bản dịch)\s*:\s*/i, '')
  .trim();

export async function translateWithOllama(input: {
  text: string;
  targetLanguage?: string;
}): Promise<TranslationResult> {
  const text = input.text.trim();
  if (!text) throw new Error('Nội dung cần dịch đang trống.');
  if (text.length > 5_000) throw new Error('Tin nhắn vượt quá giới hạn 5.000 ký tự.');

  const targetLanguage = (input.targetLanguage || 'vi') as TranslationTargetLanguage;
  const targetName = TARGET_LANGUAGES[targetLanguage];
  if (!targetName) throw new Error('Ngôn ngữ đích chưa được hỗ trợ.');

  const baseUrl = (process.env.OLLAMA_URL || DEFAULT_OLLAMA_URL).replace(/\/+$/, '');
  const model = process.env.OLLAMA_TRANSLATION_MODEL?.trim() || DEFAULT_TRANSLATION_MODEL;
  const timeoutMs = readPositiveInteger(
    process.env.OLLAMA_TRANSLATION_TIMEOUT_MS,
    DEFAULT_TRANSLATION_TIMEOUT_MS,
  );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const prompt = `You are a professional translator from the automatically detected source language to ${targetName} (${targetLanguage}). Your goal is to accurately convey the meaning and nuances of the original text while adhering to ${targetName} grammar, vocabulary, and cultural sensitivities.
Produce only the ${targetName} translation, without any additional explanations or commentary. Please translate the following text into ${targetName}:


${text}`;

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        keep_alive: '10m',
        options: { temperature: 0 },
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({})) as OllamaChatResponse;
    if (!response.ok) {
      throw new Error(payload.error || `Ollama phản hồi mã lỗi ${response.status}.`);
    }

    const translation = normalizeTranslation(payload.message?.content || '');
    if (!translation) throw new Error('Ollama không trả về nội dung bản dịch.');

    return { translation, targetLanguage, model };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(
        `Ollama dịch quá thời gian chờ ${Math.round(timeoutMs / 1000)} giây.`,
        { cause: error },
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

