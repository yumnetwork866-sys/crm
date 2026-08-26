import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { kickCampaignWorker } from '../services/campaignWorker';
import {
  createMessageTemplate,
  fetchMessageTemplates,
  getIntegrationSetting,
  uploadTemplateSampleMedia,
  verifyApprovedMessageTemplate,
} from '../services/metaApiClient';

const router = Router();

router.use(authenticateToken);

const categorySchema = z.enum(['MARKETING', 'UTILITY', 'AUTHENTICATION']);

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

const namedParameterRegex = /^[a-z][a-z0-9_]*$/;
const variableRegex = /\{\{\s*([^{}]+?)\s*\}\}/g;
const exampleSchema = z.object({
  name: z.string().trim().regex(namedParameterRegex, 'Tên biến phải là định danh chữ thường.').optional(),
  value: z.string().trim().min(1).max(1024),
}).strict();

const headerSchema = z.object({
  format: z.enum(['NONE', 'TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION']),
  text: z.string().trim().max(60).optional(),
  examples: z.array(exampleSchema).max(1).default([]),
  mediaHandle: z.string().trim().min(1).max(2048).optional(),
}).strict();

const templateButtonSchema = z.object({
  type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'VOICE_CALL', 'FLOW', 'COPY_CODE', 'CONTACT']),
  text: z.string().trim().min(1).max(40),
  url: z.string().trim().max(2000).optional(),
  urlExample: z.string().trim().max(2000).optional(),
  phoneNumber: z.string().trim().regex(/^\+[1-9]\d{7,14}$/, 'Số điện thoại phải theo chuẩn E.164.').optional(),
  activeForDays: z.number().int().min(1).max(30).optional(),
}).strict();

const authenticationButtonSchema = z.object({
  text: z.string().trim().min(1).max(40).optional(),
  autofill: z.string().trim().min(1).max(40).optional(),
  package: z.string().trim().min(1).max(255).optional(),
  signature: z.string().trim().min(1).max(255).optional(),
  zeroTapTermsAccepted: z.boolean().optional(),
}).strict();

const authenticationSchema = z.object({
  addSecurityRecommendation: z.boolean().optional(),
  codeExpirationMinutes: z.number().int().min(1).max(90).optional(),
  otpType: z.enum(['COPY_CODE', 'ONE_TAP', 'ZERO_TAP']),
  button: authenticationButtonSchema.default({}),
}).strict();

function getTemplateVariables(text: string): string[] {
  return Array.from(text.matchAll(variableRegex), (match) => match[1].trim());
}

function validateExamplesForText(options: {
  text: string;
  examples: Array<{ name?: string; value: string }>;
  parameterFormat: 'POSITIONAL' | 'NAMED';
  textPath: (string | number)[];
  examplesPath: (string | number)[];
  context: z.RefinementCtx;
  maxVariables?: number;
}) {
  const { text, examples, parameterFormat, textPath, examplesPath, context, maxVariables } = options;
  const variables = getTemplateVariables(text);
  const uniqueVariables = Array.from(new Set(variables));

  if (maxVariables !== undefined && uniqueVariables.length > maxVariables) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: textPath,
      message: `Chỉ được dùng tối đa ${maxVariables} biến.`,
    });
  }

  if (parameterFormat === 'POSITIONAL') {
    const positions = uniqueVariables.map(Number).sort((a, b) => a - b);
    const valid = positions.every((position, index) => Number.isInteger(position) && position === index + 1);
    if (!valid) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: textPath,
        message: 'Biến positional phải liên tục từ {{1}}, {{2}}, ...',
      });
    }
    if (examples.length !== uniqueVariables.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: examplesPath,
        message: `Nội dung có ${uniqueVariables.length} biến nhưng nhận được ${examples.length} ví dụ.`,
      });
    }
    return;
  }

  if (uniqueVariables.some((name) => !namedParameterRegex.test(name))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: textPath,
      message: 'Biến named phải là định danh chữ thường, ví dụ {{customer_name}}.',
    });
  }
  const exampleNames = examples.map((example) => example.name).filter((name): name is string => Boolean(name));
  const hasMatchingExamples = examples.length === uniqueVariables.length
    && exampleNames.length === examples.length
    && new Set(exampleNames).size === exampleNames.length
    && uniqueVariables.every((name) => exampleNames.includes(name));
  if (!hasMatchingExamples) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: examplesPath,
      message: 'Mỗi biến named phải có đúng một ví dụ với name khớp tên biến.',
    });
  }
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const templateCreateSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9_]+$/, 'Tên template chỉ gồm chữ thường, số và dấu gạch dưới.').max(512),
  language: z.string().trim().min(2).max(12),
  category: categorySchema,
  parameterFormat: z.enum(['POSITIONAL', 'NAMED']).optional(),
  allowCategoryChange: z.boolean().optional(),
  header: headerSchema.optional(),
  body: z.string().trim().max(1024).optional(),
  bodyExamples: z.array(exampleSchema).max(20).default([]),
  footer: z.string().trim().max(60).optional(),
  buttons: z.array(templateButtonSchema).max(10).default([]),
  authentication: authenticationSchema.optional(),
}).strict().superRefine((data, context) => {
  if (data.category === 'AUTHENTICATION') {
    if (!data.authentication) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['authentication'], message: 'Thiếu cấu hình authentication.' });
      return;
    }
    if (data.parameterFormat || data.header || data.body || data.bodyExamples.length || data.footer || data.buttons.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category'],
        message: 'Template AUTHENTICATION chỉ nhận cấu hình authentication.',
      });
    }
    const { otpType, button } = data.authentication;
    if (otpType === 'COPY_CODE') {
      if (button.autofill || button.package || button.signature || button.zeroTapTermsAccepted !== undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['authentication', 'button'], message: 'COPY_CODE không nhận cấu hình ứng dụng.' });
      }
    } else {
      if (!button.autofill || !button.package || !button.signature) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['authentication', 'button'],
          message: `${otpType} yêu cầu autofill, package và signature.`,
        });
      }
      if (otpType === 'ONE_TAP' && button.zeroTapTermsAccepted !== undefined) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['authentication', 'button', 'zeroTapTermsAccepted'], message: 'ONE_TAP không nhận zeroTapTermsAccepted.' });
      }
      if (otpType === 'ZERO_TAP' && button.zeroTapTermsAccepted !== true) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['authentication', 'button', 'zeroTapTermsAccepted'], message: 'ZERO_TAP yêu cầu chấp nhận điều khoản zero tap.' });
      }
    }
    return;
  }

  if (data.authentication) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['authentication'], message: 'authentication chỉ dùng cho category AUTHENTICATION.' });
  }
  if (!data.body) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['body'], message: 'BODY là bắt buộc.' });
  }
  const parameterFormat = data.parameterFormat || 'POSITIONAL';
  if (data.body) {
    validateExamplesForText({
      text: data.body,
      examples: data.bodyExamples,
      parameterFormat,
      textPath: ['body'],
      examplesPath: ['bodyExamples'],
      context,
    });
  }
  if (data.footer && getTemplateVariables(data.footer).length > 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['footer'], message: 'FOOTER không được chứa biến.' });
  }

  if (data.header) {
    const { format, text, examples, mediaHandle } = data.header;
    if (format === 'TEXT') {
      if (!text) context.addIssue({ code: z.ZodIssueCode.custom, path: ['header', 'text'], message: 'HEADER TEXT yêu cầu text.' });
      if (mediaHandle) context.addIssue({ code: z.ZodIssueCode.custom, path: ['header', 'mediaHandle'], message: 'HEADER TEXT không nhận mediaHandle.' });
      if (text) {
        validateExamplesForText({
          text,
          examples,
          parameterFormat,
          textPath: ['header', 'text'],
          examplesPath: ['header', 'examples'],
          context,
          maxVariables: 1,
        });
      }
    } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(format)) {
      if (!mediaHandle) context.addIssue({ code: z.ZodIssueCode.custom, path: ['header', 'mediaHandle'], message: `HEADER ${format} yêu cầu mediaHandle.` });
      if (text || examples.length) context.addIssue({ code: z.ZodIssueCode.custom, path: ['header'], message: `HEADER ${format} không nhận text hoặc examples.` });
    } else if (text || examples.length || mediaHandle) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['header'], message: 'HEADER NONE không nhận nội dung.' });
    }
  }

  const normalizedButtonTexts = data.buttons.map((button) => button.text.trim().replace(/\s+/g, ' ').toLocaleLowerCase());
  const duplicateButtonText = normalizedButtonTexts.find(
    (text, index) => text && normalizedButtonTexts.indexOf(text) !== index,
  );
  if (duplicateButtonText) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['buttons'],
      message: 'Không thể dùng cùng nội dung cho nhiều button.',
    });
  }

  const urlButtons = data.buttons.filter((button) => button.type === 'URL');
  const phoneButtons = data.buttons.filter((button) => button.type === 'PHONE_NUMBER');
  if (urlButtons.length > 2) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons'], message: 'Chỉ được có tối đa 2 button URL.' });
  if (phoneButtons.length > 1) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons'], message: 'Chỉ được có tối đa 1 button PHONE_NUMBER.' });

  data.buttons.forEach((button, index) => {
    if (button.type === 'URL') {
      if (!button.url || !isHttpsUrl(button.url)) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'url'], message: 'Button URL yêu cầu URL https hợp lệ.' });
      }
      const variables = button.url ? getTemplateVariables(button.url) : [];
      const uniqueVariables = Array.from(new Set(variables));
      if (uniqueVariables.length > 1) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'url'], message: 'Button URL chỉ được chứa tối đa 1 biến.' });
      }
      if (parameterFormat === 'POSITIONAL' && uniqueVariables.some((name) => name !== '1')) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'url'], message: 'Biến URL positional phải là {{1}}.' });
      }
      if (parameterFormat === 'NAMED' && uniqueVariables.some((name) => !namedParameterRegex.test(name))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'url'], message: 'Biến URL named phải là định danh chữ thường.' });
      }
      if (uniqueVariables.length === 1 && (!button.urlExample || !isHttpsUrl(button.urlExample))) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'urlExample'], message: 'URL động yêu cầu urlExample https hợp lệ.' });
      }
      if (uniqueVariables.length === 0 && button.urlExample) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'urlExample'], message: 'URL tĩnh không nhận urlExample.' });
      }
      if (button.phoneNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'phoneNumber'], message: 'Button URL không nhận phoneNumber.' });
      if (button.activeForDays !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'activeForDays'], message: 'Button URL không nhận activeForDays.' });
    } else if (button.type === 'PHONE_NUMBER') {
      if (!button.phoneNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'phoneNumber'], message: 'Button PHONE_NUMBER yêu cầu phoneNumber.' });
      if (button.url || button.urlExample || button.activeForDays !== undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index], message: 'Button PHONE_NUMBER không nhận URL hoặc activeForDays.' });
    } else if (button.type === 'VOICE_CALL') {
      if (button.activeForDays === undefined) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index, 'activeForDays'], message: 'Button VOICE_CALL yêu cầu hiệu lực từ 1 đến 30 ngày.' });
      if (button.url || button.urlExample || button.phoneNumber) context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index], message: 'Button VOICE_CALL chỉ nhận type, text và activeForDays.' });
    } else if (button.url || button.urlExample || button.phoneNumber || button.activeForDays !== undefined) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['buttons', index], message: 'Button này chỉ nhận type và text.' });
    }
  });
});

const templateMediaUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.enum(['image/jpeg', 'image/png', 'video/mp4', 'application/pdf']),
  dataBase64: z.string().min(1).max(25_000_000).regex(
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/,
    'dataBase64 không hợp lệ.',
  ),
}).strict().superRefine((data, context) => {
  const byteLength = Buffer.byteLength(data.dataBase64, 'base64');
  if (data.mimeType.startsWith('image/') && byteLength > 5 * 1024 * 1024) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dataBase64'], message: 'Ảnh mẫu (JPEG/PNG) không được vượt quá 5 MB theo chuẩn Meta.' });
  } else if (byteLength > 16 * 1024 * 1024) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dataBase64'], message: 'File mẫu không được vượt quá 16 MB.' });
  }
});

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
      whatsappOptIn: true,
    },
  });
  const targeted = customers.filter((customer) => matchesGender(customer.gender, input.targetGender));
  const eligible = targeted.filter((customer) => customer.whatsappOptIn);
  const seenPhones = new Set<string>();
  const recipients = eligible.flatMap((customer) => {
    const normalizedPhone = normalizeWhatsAppPhone(customer.phone);
    if (!normalizedPhone || seenPhones.has(normalizedPhone)) return [];
    seenPhones.add(normalizedPhone);
    return [{
      customer,
      normalizedPhone,
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
    optedInCount: eligible.length,
    invalidOrDuplicateCount: eligible.length - recipients.length,
    recipients,
  };
}

// GET /api/campaigns
router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const campaigns = await prisma.broadcastCampaign.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return res.json(campaigns);
  } catch (error) {
    return res.status(500).json({ error: 'Lỗi khi lấy danh sách chiến dịch' });
  }
});

// GET /api/campaigns/templates - All templates loaded directly from WABA
router.get('/templates', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const setting = await getIntegrationSetting();
    const wabaId = setting.whatsappWabaId?.trim();
    const token = setting.whatsappAccessToken?.trim();
    if (!wabaId || !token) {
      return res.status(409).json({
        error: 'Chưa cấu hình WhatsApp Business Account ID hoặc access token.',
      });
    }
    const templates = await fetchMessageTemplates({ wabaId, token });
    return res.json(templates);
  } catch (error: any) {
    return res.status(502).json({
      error: error?.message || 'Không thể tải template từ WABA.',
    });
  }
});

// POST /api/campaigns/templates - Submit a WhatsApp template to Meta for review
router.post(
  '/templates',
  requireRole(['Admin', 'Marketing Lead']),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dữ liệu template không hợp lệ.',
      });
    }
    try {
      const setting = await getIntegrationSetting();
      const wabaId = setting.whatsappWabaId?.trim();
      const token = setting.whatsappAccessToken?.trim();
      if (!wabaId || !token) {
        return res.status(409).json({
          error: 'Chưa cấu hình WhatsApp Business Account ID hoặc access token.',
        });
      }
      const result = await createMessageTemplate({
        wabaId,
        token,
        ...parsed.data,
      });
      return res.status(201).json(result);
    } catch (error: any) {
      return res.status(502).json({
        error: error?.message || 'Không thể gửi template sang Meta xét duyệt.',
      });
    }
  },
);

// POST /api/campaigns/templates/media - Upload a template sample through Meta resumable uploads
router.post(
  '/templates/media',
  requireRole(['Admin', 'Marketing Lead']),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = templateMediaUploadSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Dữ liệu file không hợp lệ.',
      });
    }
    try {
      const setting = await getIntegrationSetting();
      const appId = setting.whatsappAppId?.trim();
      const token = setting.whatsappAccessToken?.trim();
      if (!appId || !token) {
        return res.status(409).json({
          error: 'Chưa cấu hình WhatsApp App ID hoặc access token.',
        });
      }
      const handle = await uploadTemplateSampleMedia({
        appId,
        token,
        fileName: parsed.data.fileName,
        mimeType: parsed.data.mimeType,
        buffer: Buffer.from(parsed.data.dataBase64, 'base64'),
      });
      return res.status(201).json({ handle });
    } catch (error: any) {
      return res.status(502).json({
        error: error?.message || 'Không thể tải file mẫu lên Meta.',
      });
    }
  },
);

// POST /api/campaigns/preview - Authoritative audience count from the server
router.post('/preview', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = campaignInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu chiến dịch không hợp lệ.' });
  }
  try {
    const audience = await loadAudience(parsed.data);
    return res.json({
      totalTargeted: audience.totalTargeted,
      optedInCount: audience.optedInCount,
      eligibleCount: audience.recipients.length,
      invalidOrDuplicateCount: audience.invalidOrDuplicateCount,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Không thể tính tập khách hàng mục tiêu.' });
  }
});

// POST /api/campaigns/launch - Snapshot recipients and enqueue approved template messages
router.post(
  '/launch',
  requireRole(['Admin', 'Marketing Lead', 'Sales Manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    const parsed = campaignInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu chiến dịch không hợp lệ.' });
    }

    try {
      const input = parsed.data;
      const setting = await getIntegrationSetting();
      const wabaId = setting.whatsappWabaId?.trim();
      const token = setting.whatsappAccessToken?.trim();
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
        return res.status(400).json({ error: 'Không có khách hàng Opt-In với số điện thoại hợp lệ trong tập lựa chọn.' });
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
            optedInCount: audience.recipients.length,
            launchedById: req.user?.id,
            launchedAt: new Date(),
          },
        });
        await tx.broadcastRecipient.createMany({
          data: audience.recipients.map(({ customer, normalizedPhone, templateData }) => ({
            campaignId: created.id,
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            normalizedPhone,
            templateParams: templateData,
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
router.get('/:id/recipients', async (req: AuthenticatedRequest, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  try {
    const where = { campaignId: req.params.id, ...(status ? { status } : {}) };
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
  requireRole(['Admin', 'Marketing Lead', 'Sales Manager']),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const campaign = await prisma.broadcastCampaign.findUnique({ where: { id: req.params.id } });
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
  requireRole(['Admin', 'Marketing Lead', 'Sales Manager']),
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
