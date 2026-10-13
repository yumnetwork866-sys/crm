import { describe, it, expect } from 'vitest';
import { interpolateTemplate } from './useQuickTemplates';

describe('interpolateTemplate', () => {
  it('interpolates customerName, customerPhone, and agentName correctly', () => {
    const template = 'Chào {ten_khach}! SĐT: {sdt}. Em là {ten_nv}.';
    const result = interpolateTemplate(template, {
      customerName: 'Nguyễn Văn A',
      customerPhone: '0901234567',
      agentName: 'Trần Tư Vấn',
    });

    expect(result).toBe('Chào Nguyễn Văn A! SĐT: 0901234567. Em là Trần Tư Vấn.');
  });

  it('uses default fallback values when context is omitted', () => {
    const template = 'Chào {ten_khach}! Em là {ten_nv}.';
    const result = interpolateTemplate(template);

    expect(result).toBe('Chào Quý khách! Em là Tư vấn viên.');
  });

  it('handles alternative placeholder aliases like [Tên khách], {customer_name}, {phone}', () => {
    const template = 'Gửi {customer_name} qua số {phone}. Ký tên: {agent_name} ([Tên khách])';
    const result = interpolateTemplate(template, {
      customerName: 'Chị Mai',
      customerPhone: '0988776655',
      agentName: 'Hồng',
    });

    expect(result).toBe('Gửi Chị Mai qua số 0988776655. Ký tên: Hồng (Chị Mai)');
  });
});
