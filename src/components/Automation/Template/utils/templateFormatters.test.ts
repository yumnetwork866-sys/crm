import { describe, expect, it } from 'vitest';
import {
  extractApprovedTemplateVariables,
  getAutomationParameterMappingKey,
  getAutomationParameterPreviewValue,
  substituteExamples,
  syncExamples,
  toE164Phone,
} from './templateFormatters';

describe('syncExamples', () => {
  it('preserves the same array when no example changed', () => {
    const current = [{ value: 'An' }];

    expect(syncExamples(current, ['1'], 'POSITIONAL')).toBe(current);
  });

  it('preserves named values when variables are reordered', () => {
    expect(
      syncExamples(
        [
          { name: 'first_name', value: 'An' },
          { name: 'order_id', value: 'A-123' },
        ],
        ['order_id', 'first_name', 'status'],
        'NAMED',
      ),
    ).toEqual([
      { name: 'order_id', value: 'A-123' },
      { name: 'first_name', value: 'An' },
      { name: 'status', value: '' },
    ]);
  });

  it('preserves positional values by index', () => {
    expect(
      syncExamples([{ value: 'An' }, { value: 'A-123' }], ['1', '2', '3'], 'POSITIONAL'),
    ).toEqual([{ value: 'An' }, { value: 'A-123' }, { value: '' }]);
  });
});

describe('substituteExamples', () => {
  it('substitutes named variables by name regardless of example order', () => {
    expect(
      substituteExamples(
        'Xin chào {{ customer_name }}, đơn {{order_id}}.',
        [
          { name: 'order_id', value: ' A-123 ' },
          { name: 'customer_name', value: ' An ' },
        ],
        'NAMED',
      ),
    ).toBe('Xin chào An, đơn A-123.');
  });

  it('substitutes positional variables by their numeric order', () => {
    expect(
      substituteExamples(
        'Mã {{2}}, tên {{1}}.',
        [{ value: 'An' }, { value: 'SALE20' }],
        'POSITIONAL',
      ),
    ).toBe('Mã SALE20, tên An.');
  });

  it('keeps placeholders whose examples are missing or blank', () => {
    expect(
      substituteExamples(
        'Xin chào {{name}}, mã {{code}}.',
        [{ name: 'name', value: 'An' }],
        'NAMED',
      ),
    ).toBe('Xin chào An, mã {{code}}.');
  });
});

describe('approved automation template variables', () => {
  it('extracts scoped positional variables and their Meta examples', () => {
    const variables = extractApprovedTemplateVariables({
      name: 'order_update',
      language: 'vi',
      category: 'UTILITY',
      status: 'APPROVED',
      parameter_format: 'POSITIONAL',
      components: [
        {
          type: 'HEADER',
          format: 'TEXT',
          text: 'Đơn hàng {{1}}',
          example: { header_text: ['DH001'] },
        },
        {
          type: 'BODY',
          text: 'Xin chào {{1}}, tổng tiền {{2}}.',
          example: { body_text: [['An', '500.000 ₫']] },
        },
      ],
    });

    expect(variables).toEqual([
      {
        component: 'HEADER',
        componentIndex: 0,
        variable: '1',
        token: '{{1}}',
        example: 'DH001',
      },
      {
        component: 'BODY',
        componentIndex: 1,
        variable: '1',
        token: '{{1}}',
        example: 'An',
      },
      {
        component: 'BODY',
        componentIndex: 1,
        variable: '2',
        token: '{{2}}',
        example: '500.000 ₫',
      },
    ]);
    expect(getAutomationParameterMappingKey(variables[0])).toBe('HEADER:0:-:1');
  });

  it('extracts named body and URL button variables without key collisions', () => {
    const variables = extractApprovedTemplateVariables({
      name: 'order_link',
      language: 'vi',
      category: 'UTILITY',
      status: 'APPROVED',
      parameter_format: 'NAMED',
      components: [
        {
          type: 'BODY',
          text: 'Xin chào {{customer_name}}',
          example: {
            body_text_named_params: [{ param_name: 'customer_name', example: 'An' }],
          },
        },
        {
          type: 'BUTTONS',
          buttons: [{ type: 'URL', text: 'Xem đơn', url: 'https://example.com/{{order_code}}' }],
        },
      ],
    });

    expect(variables.map(getAutomationParameterMappingKey)).toEqual([
      'BODY:0:-:customer_name',
      'BUTTON:1:0:order_code',
    ]);
  });

  it('uses the assigned CRM sample or constant value in previews', () => {
    expect(getAutomationParameterPreviewValue({
      component: 'BODY',
      componentIndex: 0,
      variable: '1',
      source: 'customer_name',
    })).toBe('Nguyễn Văn A');
    expect(getAutomationParameterPreviewValue({
      component: 'BODY',
      componentIndex: 0,
      variable: '2',
      source: 'constant',
      value: 'VIP20',
    })).toBe('VIP20');
  });
});

describe('toE164Phone', () => {
  it.each([
    ['VN', '0901 234 567', '+84901234567'],
    ['VN', '+84 901-234-567', '+84901234567'],
    ['US', '(415) 555-0100', '+14155550100'],
  ])('formats %s phone number %s as E.164', (countryIso, phoneNumber, expected) => {
    expect(toE164Phone(countryIso, phoneNumber)).toBe(expected);
  });
});
