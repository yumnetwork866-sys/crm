import { Prisma } from '@prisma/client';
import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

const automationStepSelect = {
  id: true,
  step: true,
  dayOffset: true,
  title: true,
  defaultMsg: true,
  iconName: true,
  color: true,
  active: true,
  templateName: true,
  templateLanguage: true,
  templateParameterMappings: true,
} as const;

const parameterSourceSchema = z.enum([
  'customer_name',
  'customer_phone',
  'customer_email',
  'customer_address',
  'order_code',
  'order_date',
  'order_total',
  'product_name',
  'product_quantity',
  'constant',
]);

const templateParameterMappingSchema = z.object({
  component: z.enum(['HEADER', 'BODY', 'BUTTON']),
  componentIndex: z.number().int().nonnegative(),
  buttonIndex: z.number().int().nonnegative().optional(),
  variable: z.string().trim().regex(/^(?:\d+|[a-z][a-z0-9_]*)$/i, 'Tên biến template không hợp lệ.'),
  source: parameterSourceSchema,
  value: z.string().max(1024).optional(),
}).strict().superRefine((mapping, context) => {
  if (mapping.component === 'BUTTON' && mapping.buttonIndex === undefined) {
    context.addIssue({ code: 'custom', path: ['buttonIndex'], message: 'Biến nút phải có vị trí nút.' });
  }
  if (mapping.source === 'constant' && !mapping.value?.trim()) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'Vui lòng nhập giá trị cố định.' });
  }
});

const templateParameterMappingsSchema = z.array(templateParameterMappingSchema).max(50).superRefine((mappings, context) => {
  const keys = mappings.map((mapping) => [
    mapping.component,
    mapping.componentIndex,
    mapping.buttonIndex ?? '-',
    mapping.variable,
  ].join(':'));
  if (new Set(keys).size !== keys.length) {
    context.addIssue({ code: 'custom', message: 'Mỗi biến template chỉ được gán một lần.' });
  }
});

const automationStepSchema = z.object({
  id: z.string().trim().min(1).max(128),
  step: z.number().int().positive().optional(),
  dayOffset: z.number().int().min(0).max(3650),
  title: z.string().trim().min(1).max(160),
  defaultMsg: z.string().max(4096),
  iconName: z.string().trim().min(1).max(64),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Màu phải có định dạng #RRGGBB.'),
  active: z.boolean(),
  templateName: z.string().trim().min(1).max(512).optional().nullable(),
  templateLanguage: z.string().trim().min(2).max(32).optional().nullable(),
  templateParameterMappings: templateParameterMappingsSchema.optional().nullable(),
}).strict();

const replaceAutomationStepsSchema = z.object({
  steps: z.array(automationStepSchema).min(1, 'Quy trình phải có ít nhất một bước.').max(100),
}).strict();

router.use(authenticateToken);

router.get('/', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const steps = await prisma.automationStep.findMany({
      select: automationStepSelect,
      orderBy: [{ dayOffset: 'asc' }, { step: 'asc' }],
    });
    return res.json(steps);
  } catch (error) {
    console.error('Lỗi khi tải các bước automation:', error);
    return res.status(500).json({ error: 'Không thể tải cấu hình quy trình automation.' });
  }
});

router.put('/', async (req: AuthenticatedRequest, res: Response) => {
  const parsed = replaceAutomationStepsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: parsed.error.issues[0]?.message || 'Cấu hình quy trình automation không hợp lệ.',
    });
  }

  const ids = parsed.data.steps.map((item) => item.id);
  if (new Set(ids).size !== ids.length) {
    return res.status(400).json({ error: 'Mỗi bước automation phải có mã định danh riêng.' });
  }

  const normalizedSteps = [...parsed.data.steps]
    .sort((left, right) => left.dayOffset - right.dayOffset)
    .map((item, index) => ({
      id: item.id,
      step: index + 1,
      dayOffset: item.dayOffset,
      title: item.title.replace(/^Ngày\s*\+\d+\s*:\s*/i, '').trim(),
      defaultMsg: item.defaultMsg,
      iconName: item.iconName.trim(),
      color: item.color.toLowerCase(),
      active: item.active,
      templateName: item.templateName?.trim() || null,
      templateLanguage: item.templateLanguage?.trim() || null,
      templateParameterMappings: item.templateParameterMappings?.length
        ? item.templateParameterMappings.map((mapping) => ({
            ...mapping,
            variable: mapping.variable.trim(),
            ...(mapping.value !== undefined ? { value: mapping.value.trim() } : {}),
          }))
        : Prisma.JsonNull,
    }));

  try {
    const savedSteps = await prisma.$transaction(async (transaction) => {
      await transaction.automationStep.deleteMany();
      await transaction.automationStep.createMany({ data: normalizedSteps });
      return transaction.automationStep.findMany({
        select: automationStepSelect,
        orderBy: [{ dayOffset: 'asc' }, { step: 'asc' }],
      });
    });

    return res.json(savedSteps);
  } catch (error) {
    console.error('Lỗi khi lưu các bước automation:', error);
    return res.status(500).json({ error: 'Không thể lưu cấu hình quy trình automation.' });
  }
});

export default router;
