import { describe, expect, it } from 'vitest';
import { substituteExamples, syncExamples, toE164Phone } from './templateFormatters';

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

describe('toE164Phone', () => {
  it.each([
    ['VN', '0901 234 567', '+84901234567'],
    ['VN', '+84 901-234-567', '+84901234567'],
    ['US', '(415) 555-0100', '+14155550100'],
  ])('formats %s phone number %s as E.164', (countryIso, phoneNumber, expected) => {
    expect(toE164Phone(countryIso, phoneNumber)).toBe(expected);
  });
});
