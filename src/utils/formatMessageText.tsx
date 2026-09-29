import React from 'react';

/**
 * Parses and formats WhatsApp and Markdown text into React elements:
 * - Bold: **text** (Markdown) or *text* (WhatsApp)
 * - Italic: _text_
 * - Strikethrough: ~text~
 * - Monospace / Code: `code` or ```code```
 * - Bullet lists: Lines starting with * or - are converted to neat bullet points (•)
 * - Headers: Lines starting with ### are converted to bold
 * - Links: URLs are made clickable
 */
export function renderFormattedMessage(text: string | null | undefined): React.ReactNode {
  if (!text) return null;

  // 1. Normalize line-based markdown elements
  const normalizedText = text
    // Markdown headers (### Header -> *Header*)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // Markdown lists (* item or - item -> • item)
    .replace(/^(\s*)[*\-]\s+/gm, '$1• ');

  // 2. Tokenize by inline formatting patterns
  // Order matters: code blocks first, inline code, bold markdown, bold whatsapp, italic, strike, url
  const pattern = /(```[\s\S]*?```|`[^`\n]+`|\*\*[^*\n]+?\*\*|\*(?!\s)[^*\n]+?(?<!\s)\*|_(?!\s)[^_\n]+?(?<!\s)_|~(?!\s)[^~\n]+?(?<!\s)~|https?:\/\/[^\s]+)/g;

  const parts = normalizedText.split(pattern);

  return parts.map((part, index) => {
    if (!part) return null;

    // Code block: ```code```
    if (part.startsWith('```') && part.endsWith('```') && part.length >= 6) {
      const code = part.slice(3, -3).replace(/^\n/, '');
      return (
        <pre
          key={index}
          className="my-1.5 p-2 bg-slate-100/90 text-slate-800 rounded-md text-[12px] font-mono overflow-x-auto whitespace-pre-wrap border border-slate-200"
        >
          {code}
        </pre>
      );
    }

    // Inline code: `code`
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1 py-0.5 bg-slate-100 text-[#d63384] rounded text-[12px] font-mono border border-slate-200"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    // Bold Markdown: **text**
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-inherit">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Bold WhatsApp: *text*
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <strong key={index} className="font-semibold text-inherit">
          {part.slice(1, -1)}
        </strong>
      );
    }

    // Italic: _text_
    if (part.startsWith('_') && part.endsWith('_') && part.length >= 2) {
      return (
        <em key={index} className="italic text-inherit">
          {part.slice(1, -1)}
        </em>
      );
    }

    // Strikethrough: ~text~
    if (part.startsWith('~') && part.endsWith('~') && part.length >= 2) {
      return (
        <del key={index} className="line-through text-inherit opacity-75">
          {part.slice(1, -1)}
        </del>
      );
    }

    // URL link: http:// or https://
    if (part.startsWith('http://') || part.startsWith('https://')) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#027eb5] hover:underline underline-offset-2 break-all"
        >
          {part}
        </a>
      );
    }

    // Standard plain text
    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}
