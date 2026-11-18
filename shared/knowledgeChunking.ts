export interface ChunkSettings {
  delimiter: string;
  maxLength: number;
  overlap: number;
  normalizeWhitespace: boolean;
  removeUrlsAndEmails: boolean;
}

export type KnowledgeReindexRequest =
  | { mode: 'embedding'; expectedUpdatedAt?: string }
  | { mode: 'rechunk'; chunkSettings: ChunkSettings; expectedUpdatedAt: string };

export const defaultChunkSettings: ChunkSettings = {
  delimiter: '\\n',
  maxLength: 1024,
  overlap: 50,
  normalizeWhitespace: true,
  removeUrlsAndEmails: false,
};

export function chunkSettingsError(settings: ChunkSettings): string {
  if (
    !Number.isInteger(settings.maxLength) ||
    settings.maxLength < 64 ||
    settings.maxLength > 10000
  )
    return 'Độ dài đoạn cần từ 64 đến 10.000 ký tự.';
  if (
    !Number.isInteger(settings.overlap) ||
    settings.overlap < 0 ||
    settings.overlap >= settings.maxLength
  )
    return 'Độ chồng lấn cần từ 0 và nhỏ hơn độ dài đoạn.';
  if (settings.delimiter.length > 100) return 'Dấu phân cách quá dài.';
  return '';
}

export function splitKnowledge(
  content: string,
  title: string,
  settings: ChunkSettings = defaultChunkSettings,
) {
  const error = chunkSettingsError(settings);
  if (error) throw new Error(error);
  let text = content.replace(/\r\n?/g, '\n');
  if (settings.removeUrlsAndEmails) {
    text = text
      .replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi, '')
      .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '');
  }
  if (settings.normalizeWhitespace) {
    text = text
      .replace(/[\t ]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n');
  }
  text = text.trim();
  const delimiter = settings.delimiter.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  const chunks: { ordinal: number; content: string; searchText: string }[] = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(start + settings.maxLength, text.length);
    if (end < text.length) {
      const window = text.slice(start, end);
      const separator = delimiter ? window.lastIndexOf(delimiter) : -1;
      if (separator >= settings.maxLength / 2) {
        end = start + separator + delimiter.length;
      } else {
        for (const pattern of [/\n\s*\n/g, /\n/g, /[.!?。！？](?=\s)/gu, /\s/g]) {
          const boundaries = [...window.matchAll(pattern)]
            .map((match) => (match.index || 0) + match[0].length)
            .filter((offset) => offset >= settings.maxLength / 2);
          if (boundaries.length) {
            end = start + boundaries[boundaries.length - 1];
            break;
          }
        }
      }
    }
    const chunk = text.slice(start, end).trim();
    if (chunk)
      chunks.push({
        ordinal: chunks.length,
        content: chunk,
        searchText: normalizeKnowledgeText(`${title}\n${chunk}`),
      });
    if (end === text.length) break;
    const overlapStart = Math.max(start + 1, end - settings.overlap);
    const wordBoundary = text.indexOf(' ', overlapStart);
    start = wordBoundary >= overlapStart && wordBoundary < end ? wordBoundary + 1 : overlapStart;
  }
  return chunks;
}

export const normalizeKnowledgeText = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
