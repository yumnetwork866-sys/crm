import { describe, expect, it } from 'vitest';
import { conversationRetrievalQuery } from './conversationRetrieval';

describe('conversation retrieval context', () => {
  it('preserves a standalone question', () => {
    expect(conversationRetrievalQuery([{ sender: 'customer', content: 'Giá sản phẩm X?' }])).toBe(
      'Giá sản phẩm X?',
    );
  });
  it('includes the product mentioned earlier for a follow-up and excludes later messages', () => {
    const query = conversationRetrievalQuery([
      { sender: 'customer', content: 'Có sản phẩm X không?' },
      { sender: 'agent', content: 'Có sản phẩm X.' },
      { sender: 'customer', content: 'Giá bao nhiêu?' },
      { sender: 'agent', content: 'Do not include this answer' },
    ]);
    expect(query.startsWith('Giá bao nhiêu?')).toBe(true);
    expect(query).toContain('Có sản phẩm X không?');
    expect(query).not.toContain('Do not include');
  });
  it('bounds context and preserves the latest question', () => {
    const query = conversationRetrievalQuery([
      ...Array.from({ length: 20 }, () => ({ sender: 'agent', content: 'x'.repeat(10000) })),
      { sender: 'customer', content: 'Giá bao nhiêu?' },
    ]);
    expect(query.length).toBeLessThanOrEqual(2000);
    expect(query.startsWith('Giá bao nhiêu?')).toBe(true);
    expect(query.split('\n')).toHaveLength(5);
  });
  it('returns no query without a customer question', () => {
    expect(conversationRetrievalQuery([])).toBe('');
    expect(conversationRetrievalQuery([{ sender: 'agent', content: 'Hello' }])).toBe('');
    expect(conversationRetrievalQuery([{ sender: 'customer', content: '  ' }])).toBe('');
  });
});
