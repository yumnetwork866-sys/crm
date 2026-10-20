import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import {
  buildCustomerWorkspaceWorkbook,
  createUniqueSheetName,
  sanitizeExcelSheetName,
  type ExportCustomerRecord,
} from './customerExcelExport';

function customer(id: string, name: string): ExportCustomerRecord {
  return {
    id,
    name,
    phone: '+60123456789',
    whatsappRecipientId: null,
    gender: 'Khác',
    address: '',
    email: null,
    note: null,
    source: 'WhatsApp',
    campaign: 'N/A',
    adSet: null,
    landingPage: null,
    firstContact: new Date('2026-10-01T00:00:00Z'),
    lastContact: new Date('2026-10-20T00:00:00Z'),
    ownerUser: null,
    status: 'New Lead',
    group: 'group_1',
    totalOrders: 0,
    totalSpent: 0,
  };
}

describe('customerExcelExport', () => {
  it('creates valid, unique Excel sheet names', () => {
    expect(sanitizeExcelSheetName('Yum/WS:*?[]')).toBe('Yum WS');
    expect(sanitizeExcelSheetName('a'.repeat(40))).toHaveLength(31);

    const used = new Set<string>();
    expect(createUniqueSheetName('Yum WS', used)).toBe('Yum WS');
    expect(createUniqueSheetName('Yum WS', used)).toBe('Yum WS (2)');
  });

  it('creates one sheet per workspace and a sheet for unassigned customers', async () => {
    const buffer = await buildCustomerWorkspaceWorkbook({
      customers: [customer('customer-1', 'Khách A'), customer('customer-2', 'Khách B')],
      workspaces: [
        { id: 'ws-1', verifiedName: 'Yum WS', displayPhoneNumber: '+60111111111' },
        { id: 'ws-2', verifiedName: 'Yum WS', displayPhoneNumber: '+60222222222' },
      ],
      links: [
        { customerId: 'customer-1', businessPhoneNumberId: 'ws-1' },
        { customerId: 'customer-1', businessPhoneNumberId: 'ws-2' },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Yum WS - 1111',
      'Yum WS - 2222',
      'Chưa xác định WS',
    ]);
    expect(workbook.getWorksheet('Yum WS - 1111')?.getCell('B2').value).toBe('Khách A');
    expect(workbook.getWorksheet('Yum WS - 2222')?.getCell('B2').value).toBe('Khách A');
    expect(workbook.getWorksheet('Chưa xác định WS')?.getCell('B2').value).toBe('Khách B');
  });
});
