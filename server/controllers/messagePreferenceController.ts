import type { Response } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware';
import { prisma } from '../lib/prisma';
import { realtimeHub } from '../services/realtimeHub';
import { getRouteParam } from '../utils/requestParams';
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

const toNoteResponse = (note: {
  id: string;
  threadId: string;
  author: string;
  content: string;
  createdAt: Date;
}) => ({
  id: note.id,
  threadId: note.threadId,
  author: note.author,
  content: note.content,
  timestamp: note.createdAt.toISOString(),
});

export async function getMessagePreferences(req: AuthenticatedRequest, res: Response) {
  const parsedPhoneNumberId = phoneNumberIdSchema.safeParse(req.query.phoneNumberId);
  if (!parsedPhoneNumberId.success) {
    return res.status(400).json({ error: 'Thiếu số WhatsApp doanh nghiệp.' });
  }

  try {
    const businessPhoneNumberId = parsedPhoneNumberId.data;
    const [states, notes] = await Promise.all([
      prisma.messageThreadState.findMany({
        where: { businessPhoneNumberId },
        select: { threadId: true, status: true, isPinned: true },
      }),
      prisma.messageInternalNote.findMany({
        where: { businessPhoneNumberId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, threadId: true, author: true, content: true, createdAt: true },
      }),
    ]);

    const threadStatuses: Record<string, string> = {};
    const pinnedThreadIds: string[] = [];
    const internalNotes: Record<string, ReturnType<typeof toNoteResponse>[]> = {};

    states.forEach((state) => {
      threadStatuses[state.threadId] = state.status;
      if (state.isPinned) pinnedThreadIds.push(state.threadId);
    });
    notes.forEach((note) => {
      (internalNotes[note.threadId] ||= []).push(toNoteResponse(note));
    });

    return res.json({ threadStatuses, pinnedThreadIds, internalNotes });
  } catch (error) {
    console.error('[MESSAGE PREFERENCES GET ERROR]', error);
    return res.status(500).json({ error: 'Không thể tải trạng thái và ghi chú hội thoại.' });
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
    const noteRows = Object.entries(internalNotes).flatMap(([threadId, notes]) => notes.map((note) => {
      const timestamp = note.timestamp ? new Date(note.timestamp) : new Date();
      const stableKey = `${businessPhoneNumberId}\u0000${threadId}\u0000${note.id || ''}\u0000${note.content}`;
      return {
        id: `legacy_${createHash('sha256').update(stableKey).digest('hex')}`,
        businessPhoneNumberId,
        threadId,
        author: note.author,
        content: note.content,
        createdAt: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
      };
    }));
    if (noteRows.length > 10_000) {
      return res.status(400).json({ error: 'Có quá nhiều ghi chú cũ để nhập trong một lần.' });
    }

    const [statesResult, notesResult] = await prisma.$transaction([
      prisma.messageThreadState.createMany({ data: stateRows, skipDuplicates: true }),
      prisma.messageInternalNote.createMany({ data: noteRows, skipDuplicates: true }),
    ]);
    realtimeHub.broadcast('message:preferences:sync', { businessPhoneNumberId });
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
    const note = await prisma.messageInternalNote.create({
      data: {
        businessPhoneNumberId,
        threadId,
        authorId: req.user?.id,
        author: req.user?.name || 'Tư vấn viên',
        content,
      },
      select: { id: true, threadId: true, author: true, content: true, createdAt: true },
    });
    const event = { businessPhoneNumberId, note: toNoteResponse(note) };
    realtimeHub.broadcast('message:preferences:note_created', event);
    return res.status(201).json(event.note);
  } catch (error) {
    console.error('[MESSAGE INTERNAL NOTE CREATE ERROR]', error);
    return res.status(500).json({ error: 'Không thể lưu ghi chú nội bộ.' });
  }
}

export async function deleteMessageInternalNote(req: AuthenticatedRequest, res: Response) {
  const noteId = getRouteParam(req.params.noteId);
  const parsedPhoneNumberId = phoneNumberIdSchema.safeParse(req.query.phoneNumberId);
  if (!noteId || !parsedPhoneNumberId.success) {
    return res.status(400).json({ error: 'Dữ liệu xóa ghi chú không hợp lệ.' });
  }

  try {
    const businessPhoneNumberId = parsedPhoneNumberId.data;
    const note = await prisma.messageInternalNote.findFirst({
      where: { id: noteId, businessPhoneNumberId },
      select: { id: true, threadId: true },
    });
    if (!note) return res.status(404).json({ error: 'Không tìm thấy ghi chú.' });

    await prisma.messageInternalNote.delete({ where: { id: note.id } });
    const event = { businessPhoneNumberId, threadId: note.threadId, noteId: note.id };
    realtimeHub.broadcast('message:preferences:note_deleted', event);
    return res.json(event);
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
