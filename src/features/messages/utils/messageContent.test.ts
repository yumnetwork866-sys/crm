import { describe, expect, it } from 'vitest';
import {
  extractAudioInfo,
  extractDocumentInfo,
  extractImageInfo,
  extractProductInfo,
  formatMessagePreview,
  isAudioContent,
  isDocumentContent,
  isProductContent,
  parseMessageContent,
} from './messageContent';

describe('messageContent utility', () => {
  describe('isAudioContent and extractAudioInfo', () => {
    it('detects data:audio base64 data URLs', () => {
      const dataUrl = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJ7...';
      expect(isAudioContent(dataUrl)).toBe(true);

      const info = extractAudioInfo(dataUrl);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBe(dataUrl);
      expect(info.caption).toBeNull();
    });

    it('detects audio files in /uploads/ directory', () => {
      const audioPath = '/uploads/chat/voice_1710000000_abc.webm';
      expect(isAudioContent(audioPath)).toBe(true);

      const info = extractAudioInfo(audioPath);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBe(audioPath);
    });

    it('detects Meta proxy media with type=audio', () => {
      const metaAudio = '/api/meta/media/123456789?type=audio';
      expect(isAudioContent(metaAudio)).toBe(true);

      const info = extractAudioInfo(metaAudio);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBe(metaAudio);
    });

    it('detects audio placeholders without direct URLs', () => {
      const placeholder = '[Tin nhắn thoại (Audio)]';
      expect(isAudioContent(placeholder)).toBe(true);

      const info = extractAudioInfo(placeholder);
      expect(info.isAudio).toBe(true);
      expect(info.audioUrl).toBeNull();
    });

    it('ensures audio messages are not falsely classified as images by extractImageInfo', () => {
      const audioPath = '/uploads/chat/voice_1710000000_abc.webm';
      const imgInfo = extractImageInfo(audioPath);
      expect(imgInfo.isImage).toBe(false);
      expect(imgInfo.imgUrl).toBeNull();
    });

    it('ensures document files are not falsely classified as images by extractImageInfo', () => {
      const pdfPath = '/uploads/chat/doc_1710000000_quote.pdf';
      const imgInfo = extractImageInfo(pdfPath);
      expect(imgInfo.isImage).toBe(false);
      expect(imgInfo.imgUrl).toBeNull();
    });
  });

  describe('isDocumentContent and extractDocumentInfo', () => {
    it('detects [document:...] formatted message with caption', () => {
      const raw = '[document:{"url":"/uploads/chat/doc_123.pdf","filename":"BaoGia_2026.pdf","size":1048576}]\nXin gửi quý khách bảng báo giá';
      expect(isDocumentContent(raw)).toBe(true);

      const info = extractDocumentInfo(raw);
      expect(info.isDocument).toBe(true);
      expect(info.docUrl).toBe('/uploads/chat/doc_123.pdf');
      expect(info.filename).toBe('BaoGia_2026.pdf');
      expect(info.filesize).toBe(1048576);
      expect(info.fileExt).toBe('pdf');
      expect(info.caption).toBe('Xin gửi quý khách bảng báo giá');
    });

    it('detects document files in /uploads/ directory by extension', () => {
      const docPath = '/uploads/chat/doc_1710000000_invoice.xlsx\nĐính kèm hóa đơn';
      expect(isDocumentContent(docPath)).toBe(true);

      const info = extractDocumentInfo(docPath);
      expect(info.isDocument).toBe(true);
      expect(info.docUrl).toBe('/uploads/chat/doc_1710000000_invoice.xlsx');
      expect(info.fileExt).toBe('xlsx');
      expect(info.caption).toBe('Đính kèm hóa đơn');
    });

    it('detects Meta proxy media with type=document', () => {
      const metaDoc = '/api/meta/media/media_999?type=document&filename=HopDong.docx\nHợp đồng kinh tế';
      expect(isDocumentContent(metaDoc)).toBe(true);

      const info = extractDocumentInfo(metaDoc);
      expect(info.isDocument).toBe(true);
      expect(info.filename).toBe('HopDong.docx');
      expect(info.fileExt).toBe('docx');
      expect(info.caption).toBe('Hợp đồng kinh tế');
    });
  });

  describe('extractImageInfo', () => {
    it('still correctly detects images', () => {
      const imagePath = '/uploads/chat/image_123.jpg';
      const imgInfo = extractImageInfo(imagePath);
      expect(imgInfo.isImage).toBe(true);
      expect(imgInfo.imgUrl).toBe(imagePath);
    });

    it('does not treat web links as images', () => {
      const text = 'Go to your desktop: https://business.facebook.com/latest/whatsapp_manager/setup_guidance';
      const imgInfo = extractImageInfo(text);
      expect(imgInfo.isImage).toBe(false);
      expect(imgInfo.imgUrl).toBeNull();
    });
  });

  describe('parseMessageContent', () => {
    it('parses quoted replies correctly', () => {
      const replyData = { id: 'msg_1', senderName: 'Alice', content: 'Hello' };
      const raw = `[reply:${JSON.stringify(replyData)}]\nChào bạn!`;
      const parsed = parseMessageContent(raw);
      expect(parsed.replyTo).toEqual(replyData);
      expect(parsed.cleanContent).toBe('Chào bạn!');
    });
  });

  describe('isProductContent and extractProductInfo', () => {
    it('detects product with colon [product:...]', () => {
      const raw = '[product:{"catalog_id":"cat_1","product_retailer_id":"p_1","name":"Trà Shan Tuyết","price":200000,"currency":"VND"}]';
      expect(isProductContent(raw)).toBe(true);

      const info = extractProductInfo(raw);
      expect(info.isProduct).toBe(true);
      expect(info.catalogId).toBe('cat_1');
      expect(info.retailerId).toBe('p_1');
      expect(info.name).toBe('Trà Shan Tuyết');
      expect(info.price).toBe(200000);
      expect(info.caption).toBeNull();
    });

    it('detects product without colon [product{...]', () => {
      const raw = '[product{"catalog_id":"cat_1","product_retailer_id":"p_1","name":"Cà phê Arabica"}]\nXin chào';
      expect(isProductContent(raw)).toBe(true);

      const info = extractProductInfo(raw);
      expect(info.isProduct).toBe(true);
      expect(info.name).toBe('Cà phê Arabica');
      expect(info.caption).toBe('Xin chào');
    });

    it('detects product inside reply quote', () => {
      const replyData = { id: '1', senderName: 'Khách', content: 'Hỏi giá' };
      const raw = `[reply:${JSON.stringify(replyData)}]\n[product:{"catalog_id":"cat_1","name":"Trà Ô Long"}]`;
      expect(isProductContent(raw)).toBe(true);

      const info = extractProductInfo(raw);
      expect(info.isProduct).toBe(true);
      expect(info.name).toBe('Trà Ô Long');
    });

    it('handles malformed product tags gracefully', () => {
      const raw = '[product{"catalog_id":"cat_1","name":"Bột Cacao"';
      expect(isProductContent(raw)).toBe(true);

      const info = extractProductInfo(raw);
      expect(info.isProduct).toBe(true);
      expect(info.name).toBe('Bột Cacao');
    });
  });

  describe('formatMessagePreview', () => {
    it('formats single product message without showing raw [product{"catalog_id".. JSON', () => {
      const raw = '[product:{"catalog_id":"cat_999","product_retailer_id":"sku_123","name":"Trà Ô Long Cao Cấp","price":250000,"currency":"VND"}]';
      const preview = formatMessagePreview(raw);
      expect(preview).toBe('[Sản phẩm] Trà Ô Long Cao Cấp');
      expect(preview).not.toContain('catalog_id');
      expect(preview).not.toContain('[product');
    });

    it('formats single product with custom text / caption', () => {
      const raw = '[product:{"catalog_id":"cat_999","name":"Trà Ô Long"}]\nDạ shop gửi bạn thông tin sản phẩm ạ';
      const preview = formatMessagePreview(raw);
      expect(preview).toBe('[Sản phẩm] Trà Ô Long: Dạ shop gửi bạn thông tin sản phẩm ạ');
      expect(preview).not.toContain('catalog_id');
    });

    it('formats product without colon [product{"catalog_id"..', () => {
      const raw = '[product{"catalog_id":"cat_888","product_retailer_id":"sku_456","name":"Cà phê Robusta"}]';
      const preview = formatMessagePreview(raw);
      expect(preview).toBe('[Sản phẩm] Cà phê Robusta');
      expect(preview).not.toContain('catalog_id');
    });

    it('formats malformed product tag without leaking raw code', () => {
      const raw = '[product{"catalog_id":"cat_777", broken json...';
      const preview = formatMessagePreview(raw);
      expect(preview).toBe('[Sản phẩm]');
      expect(preview).not.toContain('catalog_id');
    });

    it('formats product message wrapped in a reply tag', () => {
      const replyData = { id: 'm1', senderName: 'Alice', content: 'Có mẫu này không?' };
      const raw = `[reply:${JSON.stringify(replyData)}]\n[product:{"catalog_id":"cat_1","name":"Váy dạ hội"}]`;
      const preview = formatMessagePreview(raw);
      expect(preview).toBe('[Sản phẩm] Váy dạ hội');
      expect(preview).not.toContain('[reply:');
    });

    it('formats image, audio, and document previews', () => {
      expect(formatMessagePreview('data:image/png;base64,abc\nẢnh mẫu')).toBe('📷 Ảnh mẫu');
      expect(formatMessagePreview('/uploads/test.jpg')).toBe('📷 [Hình ảnh]');
      expect(formatMessagePreview('data:audio/webm;base64,xyz')).toBe('🎙️ [Tin nhắn thoại]');
      expect(formatMessagePreview('[document:{"filename":"BaoGia.pdf"}]')).toBe('📄 [Tài liệu] BaoGia.pdf');
    });

    it('formats regular plain text flattening newlines', () => {
      expect(formatMessagePreview('Xin chào\nShop có ưu đãi gì không?')).toBe('Xin chào Shop có ưu đãi gì không?');
    });
  });
});
