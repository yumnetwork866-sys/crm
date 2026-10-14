import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QuickTemplate } from '../types';
import { api } from '../../../utils/apiClient';
import { queryKeys } from '../../../lib/queryClient';
import { realtimeClient } from '../../../services/realtimeClient';

export const QUICK_TEMPLATES_STORAGE_KEY = 'yum_crm_quick_templates';

const LEGACY_HARDCODED_IDS = new Set([
  'tmpl-chao',
  'tmpl-gia',
  'tmpl-combo',
  'tmpl-stk',
  'tmpl-freeship',
  'tmpl-voucher',
  'tmpl-xacnhan',
  'tmpl-hdsd',
]);

export interface InterpolationContext {
  customerName?: string;
  customerPhone?: string;
  brandName?: string;
}

export function interpolateTemplate(content: string, context?: InterpolationContext): string {
  if (!content) return '';
  const customerName = context?.customerName?.trim() || 'Quý khách';
  const customerPhone = context?.customerPhone?.trim() || '';
  const brandName = context?.brandName?.trim() || 'YumNetwork';

  return content
    .replace(/{ten_khach}|{customer_name}|\[Tên khách\]/gi, customerName)
    .replace(/{sdt}|{phone}|\[SĐT\]/gi, customerPhone)
    .replace(/{thuong_hieu}|{brand_name}|\[Thương hiệu\]|{ten_nv}|{agent_name}|\[Tên NV\]/gi, brandName);
}

function normalizeQuickTemplateCode(rawCode: string): string {
  const clean = rawCode.trim().replace(/^\/+/, '');
  return clean ? `/${clean}` : '';
}

function readAndPurgeLegacyTemplates(): QuickTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUICK_TEMPLATES_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(QUICK_TEMPLATES_STORAGE_KEY);
      return [];
    }
    const customTemplates = parsed.filter(
      (item): item is QuickTemplate =>
        Boolean(
          item
          && typeof item === 'object'
          && typeof (item as QuickTemplate).id === 'string'
          && !LEGACY_HARDCODED_IDS.has((item as QuickTemplate).id)
          && typeof (item as QuickTemplate).code === 'string'
          && typeof (item as QuickTemplate).title === 'string'
          && typeof (item as QuickTemplate).content === 'string',
        ),
    );
    if (customTemplates.length === 0) {
      localStorage.removeItem(QUICK_TEMPLATES_STORAGE_KEY);
    }
    return customTemplates;
  } catch {
    return [];
  }
}

export function useQuickTemplates() {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.messageQuickTemplates;

  const templatesQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const dbTemplates = await api.get<QuickTemplate[]>('/meta/messages/preferences/quick-templates');
      const legacyCustom = readAndPurgeLegacyTemplates();
      if (legacyCustom.length === 0) return dbTemplates;

      const existingCodes = new Set(dbTemplates.map((t) => t.code.toLowerCase()));
      const migrated: QuickTemplate[] = [...dbTemplates];
      for (const item of legacyCustom) {
        const normalizedCode = normalizeQuickTemplateCode(item.code);
        if (!normalizedCode || existingCodes.has(normalizedCode.toLowerCase())) continue;
        try {
          const created = await api.post<QuickTemplate>('/meta/messages/preferences/quick-templates', {
            code: normalizedCode,
            title: item.title.trim(),
            content: item.content.trim(),
          });
          migrated.push(created);
          existingCodes.add(created.code.toLowerCase());
        } catch {
          // Ignore individual conflict during legacy migration
        }
      }
      localStorage.removeItem(QUICK_TEMPLATES_STORAGE_KEY);
      return migrated;
    },
  });

  const templates = templatesQuery.data ?? [];

  useEffect(() => {
    return realtimeClient.subscribe({
      'message:preferences:quick_templates': () => {
        void queryClient.invalidateQueries({ queryKey });
      },
    });
  }, [queryClient, queryKey]);

  const createMutation = useMutation({
    mutationFn: (input: Omit<QuickTemplate, 'id'>) =>
      api.post<QuickTemplate>('/meta/messages/preferences/quick-templates', {
        code: normalizeQuickTemplateCode(input.code),
        title: input.title.trim() || 'Mẫu tin nhắn',
        content: input.content.trim(),
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuickTemplate[]>(queryKey);
      const optimistic: QuickTemplate = {
        id: `temp-${Date.now()}`,
        code: normalizeQuickTemplateCode(input.code),
        title: input.title.trim() || 'Mẫu tin nhắn',
        content: input.content.trim(),
      };
      queryClient.setQueryData<QuickTemplate[]>(queryKey, (current = []) => [...current, optimistic]);
      return { previous, optimisticId: optimistic.id };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (created, _input, context) => {
      queryClient.setQueryData<QuickTemplate[]>(queryKey, (current = []) => {
        const filtered = current.filter((item) => item.id !== context?.optimisticId && item.id !== created.id);
        return [...filtered, created];
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<QuickTemplate> }) =>
      api.patch<QuickTemplate>(`/meta/messages/preferences/quick-templates/${encodeURIComponent(id)}`, {
        ...(patch.code !== undefined ? { code: normalizeQuickTemplateCode(patch.code) } : {}),
        ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
        ...(patch.content !== undefined ? { content: patch.content.trim() } : {}),
      }),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuickTemplate[]>(queryKey);
      queryClient.setQueryData<QuickTemplate[]>(queryKey, (current = []) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                code: patch.code !== undefined ? normalizeQuickTemplateCode(patch.code) : item.code,
                title: patch.title !== undefined ? patch.title.trim() : item.title,
                content: patch.content !== undefined ? patch.content.trim() : item.content,
              }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<QuickTemplate[]>(queryKey, (current = []) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete<{ id: string }>(`/meta/messages/preferences/quick-templates/${encodeURIComponent(id)}`),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<QuickTemplate[]>(queryKey);
      queryClient.setQueryData<QuickTemplate[]>(queryKey, (current = []) =>
        current.filter((item) => item.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
  });

  const addTemplate = useCallback(
    (newTmpl: Omit<QuickTemplate, 'id'>) => {
      createMutation.mutate(newTmpl);
    },
    [createMutation],
  );

  const updateTemplate = useCallback(
    (id: string, patch: Partial<QuickTemplate>) => {
      updateMutation.mutate({ id, patch });
    },
    [updateMutation],
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  return {
    templates,
    isLoading: templatesQuery.isLoading,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    interpolateTemplate,
  };
}
