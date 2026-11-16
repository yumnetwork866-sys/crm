import { z } from 'zod';
import { retrievalModes, hybridStrategies } from '../../../shared/knowledgeRetrievalSettings';
import {
  defaultChunkSettings,
  chunkSettingsError,
  normalizeKnowledgeText,
} from '../../../shared/knowledgeChunking';
export { splitKnowledge, normalizeKnowledgeText } from '../../../shared/knowledgeChunking';

export const retrievalSettingsSchema = z.object({
  mode: z.enum(retrievalModes),
  topK: z.number().int().min(1).max(20),
  scoreThresholdEnabled: z.boolean(),
  scoreThreshold: z.number().min(0).max(1),
  hybridStrategy: z.enum(hybridStrategies).optional(),
  semanticWeight: z.number().min(0).max(1).optional(),
  rerankEnabled: z.boolean().optional(),
  rerankModel: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\w.:/-]+$/)
    .optional(),
});

export const chunkSettingsSchema = z
  .object({
    delimiter: z.string().max(100).default(defaultChunkSettings.delimiter),
    maxLength: z.number().int().min(64).max(10000).default(defaultChunkSettings.maxLength),
    overlap: z.number().int().min(0).default(defaultChunkSettings.overlap),
    normalizeWhitespace: z
      .boolean()
      .default(true)
      .transform((): boolean => true),
    removeUrlsAndEmails: z.boolean().default(defaultChunkSettings.removeUrlsAndEmails),
  })
  .refine((settings) => !chunkSettingsError(settings), {
    message: 'Thiết lập chia đoạn không hợp lệ.',
  });

export const aiConfigSchema = z.object({
  model: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\w.:/-]+$/),
  embeddingModel: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(/^[\w.:/-]+$/)
    .optional(),
  suggestionsEnabled: z.boolean(),
  autoReplyEnabled: z.boolean(),
  ragEnabled: z.boolean(),
  timeoutMs: z.number().int().min(5000).max(120000),
  instructions: z.string().trim().max(6000),
  retrievalSettings: retrievalSettingsSchema.optional(),
  aiProfile: z
    .object({
      name: z.string().trim().min(1).max(80),
      avatarUrl: z
        .string()
        .trim()
        .max(2000)
        .nullable()
        .refine((value) => !value || value.startsWith('/uploads/ai/'), {
          message: 'Ảnh đại diện phải được tải lên hệ thống.',
        }),
    })
    .optional(),
});
export const assistantConfigSchema = aiConfigSchema.pick({
  model: true,
  suggestionsEnabled: true,
  autoReplyEnabled: true,
  timeoutMs: true,
  instructions: true,
  aiProfile: true,
});
export const ragConfigSchema = aiConfigSchema.pick({
  embeddingModel: true,
  ragEnabled: true,
  retrievalSettings: true,
});

export const knowledgeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  content: z.string().trim().min(10),
  chunkSettings: chunkSettingsSchema.default(defaultChunkSettings),
  enabled: z.boolean().default(true),
});
export const generationInputSchema = z.object({
  force: z.boolean().optional(),
  phone: z.string().trim().max(160).optional(),
  customerName: z.string().trim().max(160).optional(),
  customerId: z.string().trim().max(160).optional(),
  businessPhoneNumberId: z.string().trim().max(100).optional(),
  brandName: z.string().trim().max(120).optional(),
  messages: z
    .array(
      z.object({
        sender: z.enum(['customer', 'agent']),
        content: z.string().max(10000),
        timestamp: z.string().optional(),
      }),
    )
    .max(30)
    .optional(),
});
export type GenerationInput = z.infer<typeof generationInputSchema>;
export const aiOutputSchema = z
  .object({
    suggestions: z.array(z.string().trim().min(1).max(1200)).min(1).max(3),
    answer: z.string().trim().max(2000),
    shouldAutoReply: z.boolean(),
    sourceIds: z.array(z.string().max(100)).max(6),
    reason: z.string().trim().max(400),
  })
  .strict();

export class AiFailure extends Error {
  constructor(
    public code: string,
    public stage: string,
    message: string,
    public status = 502,
    public runId?: string,
  ) {
    super(message);
  }
}

const STOP_WORDS = new Set(
  'la va cua cho minh toi ban anh chi em oi da a co khong nay voi ve duoc the nao mot nhung cac hay thi khi xin chao shop hello hi please the a an of for and is are to in it this that i you can could would saya nak boleh dan ini tu'.split(
    ' ',
  ),
);
export function knowledgeQuery(text: string) {
  return [...new Set(normalizeKnowledgeText(text).match(/[\p{L}\p{N}]{2,}/gu) || [])]
    .filter((word) => !STOP_WORDS.has(word))
    .slice(0, 24)
    .join(' | ');
}
