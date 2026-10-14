import type { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { realtimeHub } from '../services/realtimeHub';
import { getRouteParam } from '../utils/requestParams';
import { getPhoneLookupVariants } from '../utils/phone';
import { matchCustomerByPhone } from '../services/webhookService';
import { createHash, randomUUID } from 'node:crypto';

const conversationStatuses = ['consulting', 'ordered', 'callback', 'completed'] as const;
const phoneNumberIdSchema = z.string().trim().min(1).max(128);
const threadIdSchema = z.string().trim().min(1).max(255);
const savedFilterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  filter: z.enum(['all', 'unread', 'vip', 'repeat', 'new']),
});

const updateThreadSchema = z.object({
  businessPhoneNumberId: phoneNumberIdSchema,
  threadId: threadIdSchema,
  status: z.enum(conversationStatuses).optional(),
  isPinned: z.boolean().optional(),
}).refine((data) => data.status !== undefined || data.isPinned !== undefined, {
  message: 'Cần cung cấp trạng thái hoặc giá trị ghim.',
});

const createNoteSchema = z.object({
  businessPhoneNumberId: phoneNumberIdSchema,
  threadId: threadIdSchema,
  content: z.string().trim().min(1, 'Ghi chú không được để trống').max(10_000),
});

const legacyNoteSchema = z.object({
  id: z.string().max(255).optional(),
  author: z.string().trim().min(1).max(255),
  content: z.string().trim().min(1).max(10_000),
  timestamp: z.string().optional(),
});

const importPreferencesSchema = z.object({
  businessPhoneNumberId: phoneNumberIdSchema,
  threadStatuses: z.record(threadIdSchema, z.enum(conversationStatuses)).default({}),
  pinnedThreadIds: z.array(threadIdSchema).max(2_000).default([]),
  internalNotes: z.record(threadIdSchema, z.array(legacyNoteSchema).max(1_000)).default({}),
});

async function resolveCustomerIdForThread(threadId: string, businessPhoneNumberId?: string): Promise<string | null> {
  const byId = await prisma.customer.findUnique({
    where: { id: threadId },
    select: { id: true },
  });
  if (byId) return byId.id;

  const variants = getPhoneLookupVariants(threadId);
  if (variants.length > 0) {
    const byPhone = await prisma.customer.findFirst({
      where: { phone: { in: variants } },
      select: { id: true },
    });
    if (byPhone) return byPhone.id;
  }

  if (threadId.replace(/\D/g, '').length >= 7) {
    const matched = await matchCustomerByPhone(threadId, 'Khách WhatsApp', businessPhoneNumberId);
    if (matched.isCrmCustomer) return matched.customerId;
  }

  return null;
}

export async function getMessagePreferences(req: AuthenticatedRequest, res: Response) {
  const parsedPhoneNumberId = phoneNumberIdSchema.safeParse(req.query.phoneNumberId);
  if (!parsedPhoneNumberId.success) {
    return res.status(400).json({ error: 'Thiếu số WhatsApp doanh nghiệp.' });
  }

  try {
    const businessPhoneNumberId = parsedPhoneNumberId.data;
    const states = await prisma.messageThreadState.findMany({
      where: { businessPhoneNumberId },
      select: { threadId: true, status: true, isPinned: true },
    });

    const threadStatuses: Record<string, string> = {};
    const pinnedThreadIds: string[] = [];

    states.forEach((state) => {
      threadStatuses[state.threadId] = state.status;
      if (state.isPinned) pinnedThreadIds.push(state.threadId);
    });

    return res.json({ threadStatuses, pinnedThreadIds, internalNotes: {} });
  } catch (error) {
    console.error('[MESSAGE PREFERENCES GET ERROR]', error);
    return res.status(500).json({ error: 'Không thể tải trạng thái hội thoại.' });
  }
}

export async function updateMessageThreadState(req: AuthenticatedRequest, res: Response) {
  const parsed = updateThreadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
  }

  try {
    const { businessPhoneNumberId, threadId, status, isPinned } = parsed.data;
    const state = await prisma.messageThreadState.upsert({
      where: { businessPhoneNumberId_threadId: { businessPhoneNumberId, threadId } },
      create: {
        businessPhoneNumberId,
        threadId,
        status: status ?? 'consulting',
        isPinned: isPinned ?? false,
        updatedById: req.user?.id,
      },
      update: {
        ...(status !== undefined ? { status } : {}),
        ...(isPinned !== undefined ? { isPinned } : {}),
        updatedById: req.user?.id,
      },
      select: { threadId: true, status: true, isPinned: true, updatedAt: true },
    });

    const event = {
      businessPhoneNumberId,
      ...state,
      updatedAt: state.updatedAt.toISOString(),
    };
    realtimeHub.broadcast('message:preferences:thread', event);
    return res.json(event);
  } catch (error) {
    console.error('[MESSAGE THREAD STATE UPDATE ERROR]', error);
    return res.status(500).json({ error: 'Không thể cập nhật hội thoại.' });
  }
}

export async function importLegacyMessagePreferences(req: AuthenticatedRequest, res: Response) {
  const parsed = importPreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu cũ không hợp lệ.' });
  }

  try {
    const { businessPhoneNumberId, threadStatuses, pinnedThreadIds, internalNotes } = parsed.data;
    const pinnedIds = new Set(pinnedThreadIds);
    const threadIds = new Set([...Object.keys(threadStatuses), ...pinnedThreadIds]);
    const stateRows = Array.from(threadIds).map((threadId) => ({
      id: randomUUID(),
      businessPhoneNumberId,
      threadId,
      status: threadStatuses[threadId] || 'consulting',
      isPinned: pinnedIds.has(threadId),
      updatedById: req.user?.id,
    }));

    const customerNoteRows: Array<{
      id: string;
      customerId: string;
      author: string;
      content: string;
      createdAt: Date;
      type: string;
    }> = [];

    for (const [threadId, notes] of Object.entries(internalNotes)) {
      if (!notes.length) continue;
      const customerId = await resolveCustomerIdForThread(threadId, businessPhoneNumberId);
      if (!customerId) continue;
      for (const note of notes) {
        const timestamp = note.timestamp ? new Date(note.timestamp) : new Date();
        const stableKey = `${customerId}\u0000${note.id || ''}\u0000${note.content}`;
        customerNoteRows.push({
          id: `legacy_${createHash('sha256').update(stableKey).digest('hex')}`,
          customerId,
          author: note.author,
          content: note.content,
          createdAt: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
          type: 'note',
        });
      }
    }

    if (customerNoteRows.length > 10_000) {
      return res.status(400).json({ error: 'Có quá nhiều ghi chú cũ để nhập trong một lần.' });
    }

    const [statesResult, notesResult] = await prisma.$transaction([
      prisma.messageThreadState.createMany({ data: stateRows, skipDuplicates: true }),
      prisma.customerNote.createMany({ data: customerNoteRows, skipDuplicates: true }),
    ]);
    realtimeHub.broadcast('message:preferences:sync', { businessPhoneNumberId });
    if (notesResult.count > 0) {
      realtimeHub.broadcast('customers:sync', { source: 'legacy-notes-imported' });
    }
    return res.json({ importedThreadStates: statesResult.count, importedNotes: notesResult.count });
  } catch (error) {
    console.error('[MESSAGE PREFERENCES IMPORT ERROR]', error);
    return res.status(500).json({ error: 'Không thể nhập dữ liệu hội thoại cũ.' });
  }
}

export async function createMessageInternalNote(req: AuthenticatedRequest, res: Response) {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Dữ liệu không hợp lệ.' });
  }

  try {
    const { businessPhoneNumberId, threadId, content } = parsed.data;
    const customerId = await resolveCustomerIdForThread(threadId, businessPhoneNumberId);
    if (!customerId) {
      return res.status(404).json({ error: 'Không tìm thấy khách hàng để lưu ghi chú.' });
    }

    const note = await prisma.customerNote.create({
      data: {
        customerId,
        author: req.user?.name || 'Tư vấn viên',
        content,
        type: 'note',
      },
    });
    await prisma.customer.update({
      where: { id: customerId },
      data: { lastContact: new Date() },
    }).catch(() => {});

    realtimeHub.broadcast('customers:sync', { source: 'customer-note-created', customerId });
    return res.status(201).json({
      id: note.id,
      threadId: customerId,
      author: note.author,
      content: note.content,
      timestamp: note.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('[MESSAGE INTERNAL NOTE CREATE ERROR]', error);
    return res.status(500).json({ error: 'Không thể lưu ghi chú nội bộ.' });
  }
}

export async function deleteMessageInternalNote(req: AuthenticatedRequest, res: Response) {
  const noteId = getRouteParam(req.params.noteId);
  if (!noteId) {
    return res.status(400).json({ error: 'Dữ liệu xóa ghi chú không hợp lệ.' });
  }

  try {
    const existingNote = await prisma.customerNote.findUnique({
      where: { id: noteId },
      select: { id: true, customerId: true },
    });
    if (!existingNote) return res.status(404).json({ error: 'Không tìm thấy ghi chú.' });

    await prisma.customerNote.delete({ where: { id: existingNote.id } });
    realtimeHub.broadcast('customers:sync', {
      source: 'customer-note-deleted',
      customerId: existingNote.customerId,
      noteId: existingNote.id,
    });
    return res.json({ threadId: existingNote.customerId, noteId: existingNote.id });
  } catch (error) {
    console.error('[MESSAGE INTERNAL NOTE DELETE ERROR]', error);
    return res.status(500).json({ error: 'Không thể xóa ghi chú nội bộ.' });
  }
}

export async function getMessageSavedFilters(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Chưa xác thực người dùng.' });
  const filters = await prisma.messageSavedFilter.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, filter: true },
  });
  return res.json(filters);
}

export async function createMessageSavedFilter(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Chưa xác thực người dùng.' });
  const parsed = savedFilterSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Bộ lọc không hợp lệ.' });
  const filter = await prisma.messageSavedFilter.create({
    data: { userId: req.user.id, ...parsed.data },
    select: { id: true, name: true, filter: true },
  });
  return res.status(201).json(filter);
}

export async function deleteMessageSavedFilter(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ error: 'Chưa xác thực người dùng.' });
  const id = getRouteParam(req.params.id);
  const result = await prisma.messageSavedFilter.deleteMany({ where: { id, userId: req.user.id } });
  if (result.count === 0) return res.status(404).json({ error: 'Không tìm thấy bộ lọc.' });
  return res.json({ id });
}

const quickTemplateCodeSchema = z
  .string()
  .trim()
  .min(1, 'Phím tắt không được để trống')
  .max(64)
  .transform((val) => `/${val.replace(/^\/+/, '')}`);

const createQuickTemplateSchema = z.object({
  code: quickTemplateCodeSchema,
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(120),
  content: z.string().trim().min(1, 'Nội dung không được để trống').max(5_000),
});

const updateQuickTemplateSchema = z.object({
  code: quickTemplateCodeSchema.optional(),
  title: z.string().trim().min(1, 'Tiêu đề không được để trống').max(120).optional(),
  content: z.string().trim().min(1, 'Nội dung không được để trống').max(5_000).optional(),
}).refine((data) => data.code !== undefined || data.title !== undefined || data.content !== undefined, {
  message: 'Cần cung cấp thông tin cập nhật.',
});

export async function getMessageQuickTemplates(_req: AuthenticatedRequest, res: Response) {
  try {
    const templates = await prisma.messageQuickTemplate.findMany({
      orderBy: { createdAt: 'asc' },
      select: { id: true, code: true, title: true, content: true },
    });
    return res.json(templates);
  } catch (error) {
    console.error('[QUICK TEMPLATES GET ERROR]', error);
    return res.status(500).json({ error: 'Không thể tải danh sách mẫu tin nhắn nhanh.' });
  }
}

export async function createMessageQuickTemplate(req: AuthenticatedRequest, res: Response) {
  const parsed = createQuickTemplateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Mẫu tin nhắn không hợp lệ.' });
  }

  try {
    const existing = await prisma.messageQuickTemplate.findFirst({
      where: { code: { equals: parsed.data.code, mode: 'insensitive' } },
      select: { id: true, title: true },
    });
    if (existing) {
      return res.status(409).json({
        error: `Phím tắt ${parsed.data.code} đã được dùng cho mẫu “${existing.title}”.`,
      });
    }

    const created = await prisma.messageQuickTemplate.create({
      data: {
        ...parsed.data,
        createdById: req.user?.id,
      },
      select: { id: true, code: true, title: true, content: true },
    });
    realtimeHub.broadcast('message:preferences:quick_templates', { action: 'created', template: created });
    return res.status(201).json(created);
  } catch (error) {
    console.error('[QUICK TEMPLATE CREATE ERROR]', error);
    return res.status(500).json({ error: 'Không thể tạo mẫu tin nhắn nhanh.' });
  }
}

export async function updateMessageQuickTemplate(req: AuthenticatedRequest, res: Response) {
  const id = getRouteParam(req.params.id);
  const parsed = updateQuickTemplateSchema.safeParse(req.body);
  if (!id || !parsed.success) {
    return res.status(400).json({ error: parsed.error?.issues[0]?.message || 'Dữ liệu cập nhật không hợp lệ.' });
  }

  try {
    if (parsed.data.code) {
      const duplicate = await prisma.messageQuickTemplate.findFirst({
        where: {
          code: { equals: parsed.data.code, mode: 'insensitive' },
          id: { not: id },
        },
        select: { id: true, title: true },
      });
      if (duplicate) {
        return res.status(409).json({
          error: `Phím tắt ${parsed.data.code} đã được dùng cho mẫu “${duplicate.title}”.`,
        });
      }
    }

    const updated = await prisma.messageQuickTemplate.update({
      where: { id },
      data: parsed.data,
      select: { id: true, code: true, title: true, content: true },
    });
    realtimeHub.broadcast('message:preferences:quick_templates', { action: 'updated', template: updated });
    return res.json(updated);
  } catch (error) {
    console.error('[QUICK TEMPLATE UPDATE ERROR]', error);
    return res.status(500).json({ error: 'Không thể cập nhật mẫu tin nhắn nhanh.' });
  }
}

export async function deleteMessageQuickTemplate(req: AuthenticatedRequest, res: Response) {
  const id = getRouteParam(req.params.id);
  if (!id) return res.status(400).json({ error: 'Thiếu ID mẫu tin nhắn.' });

  try {
    const result = await prisma.messageQuickTemplate.deleteMany({ where: { id } });
    if (result.count === 0) return res.status(404).json({ error: 'Không tìm thấy mẫu tin nhắn.' });
    realtimeHub.broadcast('message:preferences:quick_templates', { action: 'deleted', id });
    return res.json({ id });
  } catch (error) {
    console.error('[QUICK TEMPLATE DELETE ERROR]', error);
    return res.status(500).json({ error: 'Không thể xóa mẫu tin nhắn nhanh.' });
  }
}
