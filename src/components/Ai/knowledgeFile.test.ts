import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { readKnowledgeFile } from './knowledgeFile';

describe('knowledge file import', () => {
  it('extracts Vietnamese paragraphs and table cells from a DOCX file', async () => {
    const bytes = await readFile(new URL('./__fixtures__/knowledge.docx', import.meta.url));
    const content = await readKnowledgeFile(new File([bytes], 'Kiến thức.DOCX'));
    expect(content).toContain('Kiến thức sản phẩm\n\nChính sách đổi trả trong 7 ngày.');
    expect(content).toContain('Thương hiệu');
    expect(content).toContain('Follicas');
    expect(content).not.toContain('<w:');
  });

  it.each(['txt', 'md'])('preserves UTF-8 text from %s files', async (extension) => {
    const content = '# Kiến thức\n\nChính sách đổi trả.';
    expect(await readKnowledgeFile(new File([content], `document.${extension}`))).toBe(content);
  });

  it('reports corrupt DOCX files instead of importing binary content', async () => {
    await expect(readKnowledgeFile(new File(['invalid zip'], 'broken.docx'))).rejects.toThrow(
      'Không đọc được file DOCX',
    );
  });

  it('rejects legacy DOC and unsupported file types', async () => {
    await expect(readKnowledgeFile(new File(['content'], 'document.doc'))).rejects.toThrow(
      'Chọn file TXT, MD hoặc DOCX.',
    );
  });
});
