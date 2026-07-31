/**
 * Utility functions for parsing CSV content cleanly in browser
 */

export interface ParsedCsvResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

export function parseCsvContent(csvString: string): ParsedCsvResult {
  const result: ParsedCsvResult = {
    headers: [],
    rows: [],
    errors: [],
  };

  if (!csvString || !csvString.trim()) {
    result.errors.push('File CSV rỗng.');
    return result;
  }

  // Remove UTF-8 BOM if present
  let cleanText = csvString.replace(/^\uFEFF/, '').trim();

  // Determine delimiter: ',' or ';'
  const firstLine = cleanText.split(/\r?\n/)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const delimiter = semicolonCount > commaCount ? ';' : ',';

  // Parse lines considering quotes
  const lines: string[][] = [];
  let currentToken = '';
  let inQuotes = false;
  let currentLine: string[] = [];

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      currentLine.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentLine.push(currentToken.trim());
      if (currentLine.some((cell) => cell.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentToken = '';
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0 || currentLine.length > 0) {
    currentLine.push(currentToken.trim());
    if (currentLine.some((cell) => cell.length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length === 0) {
    result.errors.push('Không tìm thấy dòng dữ liệu nào trong file CSV.');
    return result;
  }

  // Extract headers
  const rawHeaders = lines[0].map((h) => h.replace(/^["']|["']$/g, '').trim());
  result.headers = rawHeaders;

  // Process data rows
  for (let r = 1; r < lines.length; r++) {
    const line = lines[r];
    const rowObj: Record<string, string> = {};

    rawHeaders.forEach((header, idx) => {
      const val = line[idx] !== undefined ? line[idx].replace(/^["']|["']$/g, '').trim() : '';
      rowObj[header] = val;
    });

    result.rows.push(rowObj);
  }

  return result;
}

export function downloadCsvFile(filename: string, csvContent: string) {
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
