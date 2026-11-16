import { z } from 'zod';

const suggestionResponseSchema = z.object({
  success: z.literal(true),
  source: z.enum(['ai', 'smart_suggestions']),
  suggestions: z.array(z.string().trim().min(1)).min(1).max(3),
});

export function inspectSuggestionResponse(payload: unknown) {
  const parsed = suggestionResponseSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      valid: false as const,
      source: 'unknown' as const,
      suggestions: [] as string[],
      issues: parsed.error.issues.map(
        (issue) => `${issue.path.join('.') || 'response'}: ${issue.message}`,
      ),
    };
  }
  return { valid: true as const, ...parsed.data, issues: [] as string[] };
}
