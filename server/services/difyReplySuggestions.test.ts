import { afterEach, describe, it, expect, vi } from 'vitest';
import { generateReplySuggestions } from './difyService';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('generateReplySuggestions', () => {
  it('returns welcome suggestion when message list is empty', async () => {
    const result = await generateReplySuggestions({
      phone: '84912345678',
      customerName: 'Nguyễn Văn A',
      messages: [],
      brandName: 'Yum Network',
    });

    expect(result.suggestions).toBeDefined();
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.source).toBe('smart_suggestions');
    expect(result.suggestions[0]).toContain('Yum Network');
  });

  it('suggests price-related replies for Vietnamese pricing inquiry (fallback smart)', async () => {
    // Mock fetch to simulate network error or timeout
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await generateReplySuggestions({
      phone: '84987654321',
      customerName: 'Chị Mai',
      messages: [
        { sender: 'customer', content: 'Sản phẩm này giá bao nhiêu một hộp vậy shop?' },
      ],
      brandName: 'Yum Network',
    });

    expect(result.source).toBe('smart_suggestions');
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions.some((s) => s.toLowerCase().includes('giá') || s.toLowerCase().includes('báo giá'))).toBe(true);
  });

  it('suggests shipping-related replies for shipping inquiry (fallback smart)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await generateReplySuggestions({
      phone: '84987654321',
      customerName: 'Anh Tuấn',
      messages: [
        { sender: 'customer', content: 'Bên mình có ship về Cần Thơ không, bao lâu nhận được?' },
      ],
      brandName: 'Yum Network',
    });

    expect(result.source).toBe('smart_suggestions');
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions.some((s) => s.toLowerCase().includes('ship') || s.toLowerCase().includes('giao hàng'))).toBe(true);
  });

  it('suggests Malay language replies for Malaysia (+60) customers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await generateReplySuggestions({
      phone: '601110716895',
      customerName: 'Nurul',
      messages: [
        { sender: 'customer', content: 'Berapa harga barang ni?' },
      ],
      brandName: 'Yum Network',
    });

    expect(result.source).toBe('smart_suggestions');
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions.some((s) => s.toLowerCase().includes('hai') || s.toLowerCase().includes('harga') || s.toLowerCase().includes('rm'))).toBe(true);
  });

  it('suggests polite closing reply when customer says thank you', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const result = await generateReplySuggestions({
      phone: '84911223344',
      customerName: 'Hoàng',
      messages: [
        { sender: 'agent', content: 'Dạ đơn hàng của anh đã được gửi đi rồi ạ.' },
        { sender: 'customer', content: 'Dạ em cảm ơn shop nhiều nha!' },
      ],
      brandName: 'Yum Network',
    });

    expect(result.source).toBe('smart_suggestions');
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    expect(result.suggestions.some((s) => s.toLowerCase().includes('cảm ơn') || s.toLowerCase().includes('niềm vui') || s.toLowerCase().includes('sẵn sàng'))).toBe(true);
  });

  it('parses and returns AI suggestions when Dify returns valid answers', async () => {
    const mockDifyAnswer = `1. Dạ em chào anh/chị, mẫu này bên em đang có giá ưu đãi đặc biệt hôm nay ạ!\n2. Dạ em gửi anh/chị thông số chi tiết của sản phẩm nhé ạ.\n3. Anh/chị cần ship về địa chỉ nào để em hỗ trợ lên đơn ngay ạ?`;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ answer: mockDifyAnswer }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    const result = await generateReplySuggestions({
      phone: '84987654321',
      customerName: 'Lan Anh',
      messages: [
        { sender: 'customer', content: 'Tư vấn giúp mình mẫu váy này nhé' },
      ],
      brandName: 'Yum Network',
    });

    expect(result.source).toBe('ai');
    expect(result.suggestions).toHaveLength(3);
    expect(result.suggestions[0]).toBe('Dạ em chào anh/chị, mẫu này bên em đang có giá ưu đãi đặc biệt hôm nay ạ!');
    expect(result.suggestions[1]).toBe('Dạ em gửi anh/chị thông số chi tiết của sản phẩm nhé ạ.');
  });
});
