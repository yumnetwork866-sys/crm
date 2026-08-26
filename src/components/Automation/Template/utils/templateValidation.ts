import type { WhatsAppTemplateParameterFormat } from '../../../../types';

export function extractVariables(
  text: string,
  format: WhatsAppTemplateParameterFormat,
): string[] {
  const matches = Array.from(text.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g), (match) =>
    match[1].trim(),
  );
  const unique = Array.from(new Set(matches));

  return format === 'POSITIONAL'
    ? unique.sort((a, b) => Number(a) - Number(b))
    : unique;
}

export function getMetaTemplateBodyErrors(
  text: string,
  format: WhatsAppTemplateParameterFormat,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const variables = extractVariables(trimmed, format);
  if (variables.length === 0) return [];

  const errors: string[] = [];
  const nonVarText = trimmed.replace(/\{\{\s*[^{}]+\s*\}\}/g, '').trim();
  const minRequiredLength = Math.max(15, variables.length * 15);

  if (nonVarText.length < minRequiredLength) {
    errors.push(
      'Mẫu tin nhắn này có quá nhiều biến so với độ dài nội dung. Hãy giảm số lượng biến hoặc tăng độ dài tin nhắn.',
    );
  }

  if (
    /^\{\{\s*[^{}]+\s*\}\}/.test(trimmed) ||
    /\{\{\s*[^{}]+\s*\}\}$/.test(trimmed) ||
    /\{\{\s*[^{}]+\s*\}\}\s*\{\{\s*[^{}]+\s*\}\}/.test(trimmed)
  ) {
    errors.push('Biến không được đặt ở đầu hoặc cuối mẫu tin nhắn.');
  }

  return errors;
}
