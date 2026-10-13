import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from './useQuickTemplates';

describe('interpolateTemplate', () => {
  it('interpolates customerName, customerPhone, and brandName correctly', () => {
    const template = 'Chào {ten_khach}! SĐT: {sdt}. Thương hiệu: {thuong_hieu}.';
    const result = interpolateTemplate(template, {
      customerName: 'Nguyễn Văn A',
      customerPhone: '0901234567',
      brandName: 'Follicas',
    });

    expect(result).toBe('Chào Nguyễn Văn A! SĐT: 0901234567. Thương hiệu: Follicas.');
  });

  it('uses default fallback values when context is omitted', () => {
    const template = 'Chào {ten_khach}! Thương hiệu: {thuong_hieu}.';
    const result = interpolateTemplate(template);

    expect(result).toBe('Chào Quý khách! Thương hiệu: YumNetwork.');
  });

  it('handles alternative aliases and legacy agent placeholders', () => {
    const template = 'Gửi {customer_name} qua số {phone}. Thương hiệu: {brand_name}; cũ: {ten_nv} ([Tên khách])';
    const result = interpolateTemplate(template, {
      customerName: 'Chị Mai',
      customerPhone: '0988776655',
      brandName: 'Actiscar',
    });

    expect(result).toBe('Gửi Chị Mai qua số 0988776655. Thương hiệu: Actiscar; cũ: Actiscar (Chị Mai)');
  });
});
