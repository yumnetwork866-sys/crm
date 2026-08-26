import { describe, expect, it } from 'vitest';
import { extractVariables, getMetaTemplateBodyErrors } from './templateValidation';

describe('extractVariables', () => {
  it('deduplicates and numerically sorts positional variables', () => {
    expect(
      extractVariables('Mã {{10}}, tên {{ 2 }}, lặp lại {{2}}.', 'POSITIONAL'),
    ).toEqual(['2', '10']);
  });

  it('preserves the first-seen order of named variables', () => {
    expect(
      extractVariables(
        'Xin chào {{ customer_name }}, đơn {{order_id}}, {{customer_name}}.',
        'NAMED',
      ),
    ).toEqual(['customer_name', 'order_id']);
  });

  it('ignores incomplete placeholders', () => {
    expect(extractVariables('Không hợp lệ {1} và {{2}.', 'POSITIONAL')).toEqual([]);
  });
});

describe('getMetaTemplateBodyErrors', () => {
  it('accepts empty text and text without variables', () => {
    expect(getMetaTemplateBodyErrors('   ', 'POSITIONAL')).toEqual([]);
    expect(getMetaTemplateBodyErrors('Nội dung không có biến.', 'NAMED')).toEqual([]);
  });

  it('accepts an interior variable when the surrounding text is long enough', () => {
    expect(
      getMetaTemplateBodyErrors(
        'Xin chào bạn {{1}}, đơn hàng của bạn đã sẵn sàng để nhận.',
        'POSITIONAL',
      ),
    ).toEqual([]);
  });

  it('reports too many variables for the non-variable text length', () => {
    expect(getMetaTemplateBodyErrors('Mã {{1}}.', 'POSITIONAL')).toContain(
      'Mẫu tin nhắn này có quá nhiều biến so với độ dài nội dung. Hãy giảm số lượng biến hoặc tăng độ dài tin nhắn.',
    );
  });

  it.each([
    '{{1}} Nội dung đủ dài để kiểm tra vị trí của biến.',
    'Nội dung đủ dài để kiểm tra vị trí của biến {{1}}',
    'Nội dung đủ dài {{1}}{{2}} để kiểm tra hai biến liền nhau trong mẫu.',
  ])('reports an invalid boundary or adjacent variables in %s', (body) => {
    expect(getMetaTemplateBodyErrors(body, 'POSITIONAL')).toContain(
      'Biến không được đặt ở đầu hoặc cuối mẫu tin nhắn.',
    );
  });
});
