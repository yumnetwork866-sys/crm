import ExcelJS from 'exceljs';

export interface ExportCustomerRecord {
  id: string;
  name: string;
  phone: string;
  whatsappRecipientId: string | null;
  gender: string;
  address: string;
  email: string | null;
  note: string | null;
  source: string;
  campaign: string;
  adSet: string | null;
  landingPage: string | null;
  firstContact: Date;
  lastContact: Date;
  ownerUser: { name: string } | null;
  status: string;
  group: string | null;
  totalOrders: number;
  totalSpent: { toNumber?: () => number } | number;
}

export interface ExportWorkspace {
  id: string;
  verifiedName: string | null;
  displayPhoneNumber: string | null;
}

export interface CustomerWorkspaceLink {
  customerId: string | null;
  businessPhoneNumberId: string | null;
}

const GROUP_LABELS: Record<string, string> = {
  group_1: 'Khách mới',
  group_2: 'Đã hỏi giá',
  group_3: 'Đã mua 1 lần',
  group_4: 'Đã mua từ 2 lần trở lên (VIP)',
};

const HEADERS = [
  'ID',
  'Tên khách hàng',
  'Số điện thoại',
  'WhatsApp ID',
  'Giới tính',
  'Địa chỉ',
  'Email',
  'Ghi chú',
  'Nguồn',
  'Chiến dịch',
  'Ad Set',
  'Landing Page',
  'Liên hệ đầu tiên',
  'Liên hệ gần nhất',
  'Sales phụ trách',
  'Trạng thái',
  'Nhóm CRM',
  'Tổng đơn',
  'Tổng chi tiêu',
] as const;

function resolveGroup(customer: ExportCustomerRecord): string {
  if (customer.group && GROUP_LABELS[customer.group]) return GROUP_LABELS[customer.group];
  if (customer.totalOrders >= 2) return GROUP_LABELS.group_4;
  if (customer.totalOrders === 1) return GROUP_LABELS.group_3;
  if (customer.status === 'Quoted' || customer.status === 'Contacted') return GROUP_LABELS.group_2;
  return GROUP_LABELS.group_1;
}

function decimalToNumber(value: ExportCustomerRecord['totalSpent']): number {
  if (typeof value === 'number') return value;
  if (value && typeof value.toNumber === 'function') return value.toNumber();
  return Number(value || 0);
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

export function sanitizeExcelSheetName(value: string): string {
  const clean = value
    .replace(/[\\/*?:]/g, ' ')
    .replaceAll('[', ' ')
    .replaceAll(']', ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (clean || 'Workspace').slice(0, 31);
}

export function createUniqueSheetName(value: string, usedNames: Set<string>): string {
  const base = sanitizeExcelSheetName(value);
  let candidate = base;
  let suffix = 2;
  while (usedNames.has(candidate.toLocaleLowerCase('vi'))) {
    const ending = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - ending.length)}${ending}`;
    suffix += 1;
  }
  usedNames.add(candidate.toLocaleLowerCase('vi'));
  return candidate;
}

function getWorkspaceLabel(workspace: ExportWorkspace): string {
  const name = workspace.verifiedName?.trim();
  const displayPhone = workspace.displayPhoneNumber?.trim();
  if (name && displayPhone) {
    const phoneSuffix = displayPhone.replace(/\D/g, '').slice(-4);
    return phoneSuffix ? `${name} - ${phoneSuffix}` : name;
  }
  return name || displayPhone || workspace.id;
}

function addCustomerSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  customers: ExportCustomerRecord[],
): void {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.addRow([...HEADERS]);
  for (const customer of customers) {
    sheet.addRow([
      customer.id,
      customer.name,
      customer.phone,
      customer.whatsappRecipientId || '',
      customer.gender || '',
      customer.address || '',
      customer.email || '',
      customer.note || '',
      customer.source || '',
      customer.campaign || '',
      customer.adSet || '',
      customer.landingPage || '',
      formatDate(customer.firstContact),
      formatDate(customer.lastContact),
      customer.ownerUser?.name || 'Chưa phân công',
      customer.status,
      resolveGroup(customer),
      customer.totalOrders,
      decimalToNumber(customer.totalSpent),
    ]);
  }

  const header = sheet.getRow(1);
  header.height = 24;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  header.alignment = { vertical: 'middle', horizontal: 'center' };

  sheet.autoFilter = { from: 'A1', to: `S${Math.max(1, sheet.rowCount)}` };
  sheet.columns.forEach((column, index) => {
    const preferredWidths = [38, 24, 18, 25, 12, 28, 25, 35, 14, 20, 20, 25, 18, 18, 20, 16, 28, 12, 18];
    column.width = preferredWidths[index] || 18;
    column.alignment = { vertical: 'top', wrapText: true };
  });
  sheet.getColumn(18).numFmt = '0';
  sheet.getColumn(19).numFmt = '#,##0.00';
}

export async function buildCustomerWorkspaceWorkbook(input: {
  customers: ExportCustomerRecord[];
  workspaces: ExportWorkspace[];
  links: CustomerWorkspaceLink[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'YumNetwork CRM';
  workbook.created = new Date();

  const customersById = new Map(input.customers.map((customer) => [customer.id, customer]));
  const linkedCustomerIds = new Set<string>();
  const customerIdsByWorkspace = new Map<string, Set<string>>();

  for (const link of input.links) {
    if (!link.customerId || !link.businessPhoneNumberId || !customersById.has(link.customerId)) continue;
    if (!customerIdsByWorkspace.has(link.businessPhoneNumberId)) {
      customerIdsByWorkspace.set(link.businessPhoneNumberId, new Set());
    }
    customerIdsByWorkspace.get(link.businessPhoneNumberId)!.add(link.customerId);
    linkedCustomerIds.add(link.customerId);
  }

  const workspaceById = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));
  const usedSheetNames = new Set<string>();
  for (const [workspaceId, customerIds] of customerIdsByWorkspace) {
    const workspace = workspaceById.get(workspaceId) || {
      id: workspaceId,
      verifiedName: null,
      displayPhoneNumber: null,
    };
    const sheetCustomers = input.customers.filter((customer) => customerIds.has(customer.id));
    addCustomerSheet(
      workbook,
      createUniqueSheetName(getWorkspaceLabel(workspace), usedSheetNames),
      sheetCustomers,
    );
  }

  const unassignedCustomers = input.customers.filter((customer) => !linkedCustomerIds.has(customer.id));
  if (unassignedCustomers.length > 0 || workbook.worksheets.length === 0) {
    addCustomerSheet(
      workbook,
      createUniqueSheetName('Chưa xác định WS', usedSheetNames),
      unassignedCustomers,
    );
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
