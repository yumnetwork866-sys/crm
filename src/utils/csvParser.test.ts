import { describe, it, expect } from 'vitest';
import { parseCsvContent, removeVietnameseTones, normalizeHeaderKey } from './csvParser';

describe('csvParser', () => {
  it('correctly strips Vietnamese tones', () => {
    expect(removeVietnameseTones('Mã SP')).toBe('Ma SP');
    expect(removeVietnameseTones('Tên Sản Phẩm')).toBe('Ten San Pham');
    expect(removeVietnameseTones('Giá Bán')).toBe('Gia Ban');
    expect(removeVietnameseTones('Tồn Kho')).toBe('Ton Kho');
    expect(removeVietnameseTones('Mô Tả')).toBe('Mo Ta');
  });

  it('normalizes header keys for synonym comparison', () => {
    expect(normalizeHeaderKey('Mã SP')).toBe('masp');
    expect(normalizeHeaderKey('Tên Sản Phẩm')).toBe('tensanpham');
    expect(normalizeHeaderKey('Giá Bán')).toBe('giaban');
    expect(normalizeHeaderKey('Tồn Kho')).toBe('tonkho');
    expect(normalizeHeaderKey('Mô Tả')).toBe('mota');
  });

  it('parses comma-separated CSV with Vietnamese characters and quotes', () => {
    const csv = `Mã SP,Tên Sản Phẩm,Danh Mục,Giá Bán,Giá Vốn,Tồn Kho,SKU,Mô Tả
8936048693640,Serum Sẹo Actiscar Ultra Serum 15g,Mỹ Phẩm,,,100,8936048693640,"Giảm Sẹo Lồi, Sẹo Rỗ Và Mờ Thâm"`;

    const result = parseCsvContent(csv);
    expect(result.errors).toHaveLength(0);
    expect(result.headers).toEqual([
      'Mã SP',
      'Tên Sản Phẩm',
      'Danh Mục',
      'Giá Bán',
      'Giá Vốn',
      'Tồn Kho',
      'SKU',
      'Mô Tả',
    ]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['Mã SP']).toBe('8936048693640');
    expect(result.rows[0]['Tên Sản Phẩm']).toBe('Serum Sẹo Actiscar Ultra Serum 15g');
    expect(result.rows[0]['Mô Tả']).toBe('Giảm Sẹo Lồi, Sẹo Rỗ Và Mờ Thâm');
    expect(result.rows[0]['Tồn Kho']).toBe('100');
  });

  it('handles tab-separated values (TSV) from Excel copy-paste', () => {
    const tsv = `Mã SP\tTên Sản Phẩm\tGiá Bán
SP-01\tSerum Trị Mụn\t350000`;

    const result = parseCsvContent(tsv);
    expect(result.errors).toHaveLength(0);
    expect(result.headers).toEqual(['Mã SP', 'Tên Sản Phẩm', 'Giá Bán']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]['Tên Sản Phẩm']).toBe('Serum Trị Mụn');
  });
});
