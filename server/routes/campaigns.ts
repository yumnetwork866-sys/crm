import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requirePermission } from '../middleware/authMiddleware';
import { Permission } from '../auth/permissions';
import { prisma } from '../lib/prisma';
import { kickCampaignWorker } from '../services/campaignWorker';
import { getRouteParam } from '../utils/requestParams';
import { getIntegrationSetting, getMetaAccessToken, verifyApprovedMessageTemplate } from '../services/metaApiClient';
import { isWhatsAppSessionOpen } from '../services/whatsappSessionWindow';
import templateRoutes, { categorySchema } from './templates';

const router = Router();

router.use(authenticateToken);

// Mount template routes as a sub-router preserving /api/campaigns/templates/* endpoints
router.use('/templates', templateRoutes);

const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(160),
  targetGroup: z.enum([
    'Tất cả khách hàng',
    'Khách mới',
    'Đã hỏi giá',
    'Đã mua 1 lần',
    'VIP',
    'VIP (Mua ≥ 2 lần)',
  ]),
  targetProduct: z.string().trim().min(1).max(200).optional(),
  targetGender: z.enum(['Nam', 'Nữ', 'Khác']).optional(),
  category: categorySchema,
  templateName: z.string().trim().regex(/^[a-z0-9_]+$/, 'Tên template chỉ gồm chữ thường, số và dấu gạch dưới.'),
  templateLanguage: z.string().trim().min(2).max(12).default('vi'),
  templateParameterSources: z.array(
    z.enum(['customer_name', 'phone', 'product', 'voucher_code'])
  ).max(20).default([]),
  messageTemplate: z.string().trim().min(1).max(4096),
  voucherCode: z.string().trim().max(100).optional(),
});

type CampaignInput = z.infer<typeof campaignInputSchema>;

function getGroupId(targetGroup: string) {
  if (targetGroup === 'Khách mới') return 'group_1';
  if (targetGroup === 'Đã hỏi giá') return 'group_2';
  if (targetGroup === 'Đã mua 1 lần') return 'group_3';
  if (targetGroup === 'VIP' || targetGroup === 'VIP (Mua ≥ 2 lần)') return 'group_4';
  return undefined;
}

function normalizeWhatsAppPhone(phone: string): string | null {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) {
    const defaultCountryCode = (process.env.DEFAULT_PHONE_COUNTRY_CODE || '60').replace(/\D/g, '');
    digits = `${defaultCountryCode}${digits.slice(1)}`;
  }
  return digits.length >= 8 && digits.length <= 15 ? digits : null;
}

function validateTemplateStructure(
  template: Awaited<ReturnType<typeof verifyApprovedMessageTemplate>>,
  parameterSources: CampaignInput['templateParameterSources'],
) {
  if (template.parameter_format?.toUpperCase() === 'NAMED') {
    throw new Error('Template dùng biến NAMED chưa được hỗ trợ. Hãy chọn template dùng biến positional {{1}}, {{2}}, ...');
  }
  const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY');
  if (!body?.text) throw new Error('Template không có nội dung BODY để gửi.');
  const positions = Array.from(body.text.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
  const parameterCount = positions.length > 0 ? Math.max(...positions) : 0;
  if (parameterCount !== parameterSources.length) {
    throw new Error(`Template yêu cầu ${parameterCount} biến BODY nhưng cấu hình nhận được ${parameterSources.length} biến.`);
  }
  const hasUnsupportedComponent = template.components.some((component) => {
    const type = component.type?.toUpperCase();
    if (type === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(component.format?.toUpperCase() || '')) {
      return true;
    }
    return type !== 'BODY' && /\{\{\d+\}\}/.test(JSON.stringify(component));
  });
  if (hasUnsupportedComponent) {
    throw new Error('Template có biến HEADER/BUTTON hoặc media động chưa được hỗ trợ bởi Broadcast.');
  }
}

function matchesGender(customerGender: string, targetGender?: string) {
  if (!targetGender) return true;
  const gender = customerGender.trim().toLowerCase();
  if (targetGender === 'Nam') return ['nam', 'male', 'm'].includes(gender);
  if (targetGender === 'Nữ') return ['nữ', 'nu', 'female', 'f'].includes(gender);
  return !['nam', 'male', 'm', 'nữ', 'nu', 'female', 'f'].includes(gender);
}

function resolveTemplateData(
  messageTemplate: string,
  customer: { name: string; phone: string; interestedProducts: string[] },
  targetProduct?: string,
  voucherCode = 'VOUCHER30OFF',
  parameterSources: CampaignInput['templateParameterSources'] = [],
) {
  const product = targetProduct || customer.interestedProducts[0] || 'Sản phẩm của VietCRM';
  const values: Record<string, string> = {
    'Customer Name': customer.name,
    Phone: customer.phone,
    Product: product,
    'Voucher Code': voucherCode,
  };
  const sourceValues: Record<CampaignInput['templateParameterSources'][number], string> = {
    customer_name: values['Customer Name'],
    phone: values.Phone,
    product: values.Product,
    voucher_code: values['Voucher Code'],
  };
  const bodyParameters: string[] = parameterSources.map((source) => sourceValues[source]);
  const renderedMessage = messageTemplate.replace(
    /\{\{(Customer Name|Phone|Product|Voucher Code)\}\}/g,
    (_match, key: string) => {
      const value = values[key] || '';
      if (parameterSources.length === 0) bodyParameters.push(value);
      return value;
    },
  );
  return { bodyParameters, renderedMessage };
}

async function loadAudience(input: CampaignInput) {
  const group = getGroupId(input.targetGroup);
  const customers = await prisma.customer.findMany({
    where: {
      ...(group ? { group } : {}),
      ...(input.targetProduct
        ? { interestedProducts: { has: input.targetProduct } }
        : {}),
    },
    select: {
      id: true,
      name: true,
      phone: true,
      gender: true,
      interestedProducts: true,
    },
  });
  const targeted = customers.filter((customer) => matchesGender(customer.gender, input.targetGender));
  const customerIds = targeted.map((customer) => customer.id);
  const inboundGroups = customerIds.length > 0
    ? await prisma.whatsAppMessage.groupBy({
      by: ['customerId'],
      where: {
        customerId: { in: customerIds },
        sender: 'customer',
        channel: 'WhatsApp',
      },
      _max: { timestamp: true },
    })
    : [];
  const lastInboundByCustomer = new Map(
    inboundGroups.flatMap((group) => group.customerId && group._max.timestamp
      ? [[group.customerId, group._max.timestamp] as const]
      : []),
  );
  const seenPhones = new Set<string>();
  const recipients = targeted.flatMap((customer) => {
    const normalizedPhone = normalizeWhatsAppPhone(customer.phone);
    if (!normalizedPhone || seenPhones.has(normalizedPhone)) return [];
    seenPhones.add(normalizedPhone);
    const lastInboundAt = lastInboundByCustomer.get(customer.id) ?? null;
    const plannedMessageType = isWhatsAppSessionOpen(lastInboundAt) ? 'Text' : 'Template';
    return [{
      customer,
      normalizedPhone,
      lastInboundAt,
      plannedMessageType,
      templateData: resolveTemplateData(
        input.messageTemplate,
        customer,
        input.targetProduct,
        input.voucherCode,
        input.templateParameterSources,
      ),
    }];
  });
  return {
    totalTargeted: targeted.length,
    eligibleCount: recipients.length,
    sessionOpenCount: recipients.filter((recipient) => recipient.plannedMessageType === 'Text').length,
    templateRequiredCount: recipients.filter((recipient) => recipient.plannedMessageType === 'Template').length,
    invalidOrDuplicateCount: targeted.length - recipients.length,
    recipients,
  };
}

// GET /api/campaigns
router.get('/', requirePermission(Permission.AUTOMATION_VIEW), async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.broadcastCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(campaigns);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách chiến dịch' });
  }
});

// POST /api/campaigns/preview - Authoritative audience count from the server
router.post('/preview', requirePermission(Permission.CAMPAIGNS_MANAGE), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = campaignInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu chiến dịch không hợp lệ.' });
  }
  try {
    const audience = await loadAudience(parsed.data);
    return res.json({
      totalTargeted: audience.totalTargeted,
      eligibleCount: audience.eligibleCount,
      sessionOpenCount: audience.sessionOpenCount,
      templateRequiredCount: audience.templateRequiredCount,
      invalidOrDuplicateCount: audience.invalidOrDuplicateCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Không thể tính tập khách hàng mục tiêu.' });
  }
});

// POST /api/campaigns/launch - Snapshot recipients and enqueue messages selected by the 24-hour session window
router.post(
  '/launch',
  requirePermission(Permission.CAMPAIGNS_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = campaignInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu chiến dịch không hợp lệ.' });
    }

    try {
      const input = parsed.data;
      const setting = await getIntegrationSetting();
      const wabaId = setting.whatsappWabaId?.trim();
      const token = await getMetaAccessToken(setting);
      if (!wabaId || !token) {
        return res.status(409).json({ error: 'Chưa cấu hình WhatsApp Business Account ID hoặc access token.' });
      }

      try {
        const approvedTemplate = await verifyApprovedMessageTemplate({
          wabaId,
          token,
          templateName: input.templateName,
          languageCode: input.templateLanguage,
        });
        validateTemplateStructure(approvedTemplate, input.templateParameterSources);
      } catch (error: any) {
        return res.status(400).json({
          error: error?.message || 'WhatsApp template chưa được Meta phê duyệt.',
        });
      }

      const audience = await loadAudience(input);
      if (audience.recipients.length === 0) {
        return res.status(400).json({ error: 'Không có khách hàng với số điện thoại hợp lệ trong tập lựa chọn.' });
      }

      const maxRecipients = Math.max(1, Number(process.env.MAX_CAMPAIGN_RECIPIENTS) || 5_000);
      if (audience.recipients.length > maxRecipients) {
        return res.status(400).json({
          error: `Chiến dịch vượt giới hạn ${maxRecipients} người nhận. Hãy thu hẹp tập khách hàng.`,
        });
      }

      const campaign = await prisma.$transaction(async (tx) => {
        const created = await tx.broadcastCampaign.create({
          data: {
            name: input.name,
            targetGroup: input.targetGroup,
            targetProduct: input.targetProduct || null,
            targetGender: input.targetGender || null,
            category: input.category,
            templateName: input.templateName,
            templateLanguage: input.templateLanguage,
            messageTemplate: input.messageTemplate,
            status: 'Pending',
            totalTargeted: audience.totalTargeted,
            eligibleCount: audience.eligibleCount,
            sessionOpenCount: audience.sessionOpenCount,
            templateRequiredCount: audience.templateRequiredCount,
            launchedById: req.user?.id,
            launchedAt: new Date(),
          },
        });
        await tx.broadcastRecipient.createMany({
          data: audience.recipients.map(({
            customer,
            normalizedPhone,
            templateData,
            plannedMessageType,
            lastInboundAt,
          }) => ({
            campaignId: created.id,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            normalizedPhone,
            templateParams: templateData,
            plannedMessageType,
            lastInboundAtSnapshot: lastInboundAt,
            status: 'Pending',
          })),
          skipDuplicates: true,
        });
        return created;
      });

      kickCampaignWorker();
      return res.status(202).json(campaign);
    } catch (error: any) {
      console.error('[CAMPAIGN LAUNCH ERROR]', error);
      return res.status(500).json({ error: error?.message || 'Không thể khởi chạy chiến dịch.' });
    }
  },
);

// GET /api/campaigns/:id/recipients - Auditable per-recipient delivery state
router.get('/:id/recipients', requirePermission(Permission.AUTOMATION_VIEW), async (req: AuthenticatedRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  try {
    const campaignId = getRouteParam(req.params.id);
    const where = { campaignId, ...(status ? { status } : {}) };
    const [total, recipients] = await Promise.all([
      prisma.broadcastRecipient.count({ where }),
      prisma.broadcastRecipient.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          customerId: true,
          customerName: true,
          customerPhone: true,
          status: true,
          plannedMessageType: true,
          actualMessageType: true,
          lastInboundAtSnapshot: true,
          windowEvaluatedAt: true,
          attemptCount: true,
          metaMessageId: true,
          lastErrorCode: true,
          lastErrorMessage: true,
          sentAt: true,
          deliveredAt: true,
          readAt: true,
          respondedAt: true,
        },
      }),
    ]);
    return res.json({
      data: recipients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Không thể tải kết quả người nhận của chiến dịch.' });
  }
});

// POST /api/campaigns/:id/cancel - Stop recipients that have not been sent
router.post(
  '/:id/cancel',
  requirePermission(Permission.CAMPAIGNS_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaignId = getRouteParam(req.params.id);
      const campaign = await prisma.broadcastCampaign.findUnique({ where: { id: campaignId } });
      if (!campaign) return res.status(404).json({ error: 'Không tìm thấy chiến dịch.' });
      if (!['Pending', 'Sending'].includes(campaign.status)) {
        return res.status(409).json({ error: 'Chỉ có thể hủy chiến dịch đang chờ hoặc đang gửi.' });
      }
      await prisma.$transaction([
        prisma.broadcastRecipient.updateMany({
          where: { campaignId: campaign.id, status: { in: ['Pending', 'Retry'] } },
          data: { status: 'Cancelled', nextAttemptAt: null },
        }),
        prisma.broadcastCampaign.update({
          where: { id: campaign.id },
          data: { status: 'Cancelled', completedAt: new Date() },
        }),
      ]);
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: 'Không thể hủy chiến dịch.' });
    }
  },
);

// POST /api/campaigns - Retained as a draft endpoint for compatibility
router.post(
  '/',
  requirePermission(Permission.CAMPAIGNS_MANAGE),
  async (req: AuthenticatedRequest, res: Response) => {
  const parsed = campaignInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu chiến dịch không hợp lệ.' });
  }
  try {
    const input = parsed.data;
    const campaign = await prisma.broadcastCampaign.create({
      data: {
        name: input.name,
        targetGroup: input.targetGroup,
        targetProduct: input.targetProduct || null,
        targetGender: input.targetGender || null,
        category: input.category,
        templateName: input.templateName,
        templateLanguage: input.templateLanguage,
        messageTemplate: input.messageTemplate,
        status: 'Draft',
      },
    });
    return res.status(201).json(campaign);
    } catch (error) {
      return res.status(500).json({ error: 'Lỗi khi tạo chiến dịch mới' });
    }
  },
);

export default router;
