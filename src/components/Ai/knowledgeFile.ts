export const knowledgeFileAccept =
  '.txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export async function readKnowledgeFile(file: File): Promise<string> {
  if (!/\.(txt|md|docx)$/i.test(file.name)) {
    throw new Error('Chọn file TXT, MD hoặc DOCX.');
  }
  try {
    if (/\.docx$/i.test(file.name)) {
      const { default: mammoth } = await import('mammoth/mammoth.browser');
      const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      return result.value;
    }
    return await file.text();
  } catch {
    throw new Error(
      /\.docx$/i.test(file.name)
        ? 'Không đọc được file DOCX. Kiểm tra file không bị hỏng hoặc được bảo vệ bằng mật khẩu.'
        : 'Không đọc được file tài liệu.',
    );
  }
}
