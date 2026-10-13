import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_QUICK_TEMPLATES } from '../constants';
import type { QuickTemplate } from '../types';

export const QUICK_TEMPLATES_STORAGE_KEY = 'yum_crm_quick_templates';
const UPDATE_EVENT_NAME = 'yum_quick_templates_updated';

export interface InterpolationContext {
  customerName?: string;
  customerPhone?: string;
  agentName?: string;
}

export function interpolateTemplate(content: string, context?: InterpolationContext): string {
  if (!content) return '';
  const customerName = context?.customerName?.trim() || 'Quý khách';
  const customerPhone = context?.customerPhone?.trim() || '';
  const agentName = context?.agentName?.trim() || 'Tư vấn viên';

  return content
    .replace(/{ten_khach}|{customer_name}|\[Tên khách\]/gi, customerName)
    .replace(/{sdt}|{phone}|\[SĐT\]/gi, customerPhone)
    .replace(/{ten_nv}|{agent_name}|\[Tên NV\]/gi, agentName);
}

function loadStoredTemplates(): QuickTemplate[] {
  try {
    const raw = localStorage.getItem(QUICK_TEMPLATES_STORAGE_KEY);
    if (!raw) return DEFAULT_QUICK_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.error('Failed to parse quick templates from localStorage:', err);
  }
  return DEFAULT_QUICK_TEMPLATES;
}

function saveTemplates(templates: QuickTemplate[]) {
  try {
    localStorage.setItem(QUICK_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    window.dispatchEvent(new Event(UPDATE_EVENT_NAME));
  } catch (err) {
    console.error('Failed to save quick templates to localStorage:', err);
  }
}

export function useQuickTemplates() {
  const [templates, setTemplates] = useState<QuickTemplate[]>(loadStoredTemplates);

  useEffect(() => {
    const handleUpdate = () => {
      setTemplates(loadStoredTemplates());
    };

    window.addEventListener(UPDATE_EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(UPDATE_EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  const addTemplate = useCallback((newTmpl: Omit<QuickTemplate, 'id'>) => {
    let code = newTmpl.code.trim();
    if (!code.startsWith('/')) {
      code = `/${code}`;
    }
    const item: QuickTemplate = {
      ...newTmpl,
      id: `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      code,
      title: newTmpl.title.trim() || 'Mẫu tin nhắn',
      content: newTmpl.content.trim(),
    };

    const next = [...loadStoredTemplates(), item];
    saveTemplates(next);
    setTemplates(next);
    return item;
  }, []);

  const updateTemplate = useCallback((id: string, patch: Partial<QuickTemplate>) => {
    const current = loadStoredTemplates();
    const next = current.map((item) => {
      if (item.id !== id) return item;
      let code = patch.code !== undefined ? patch.code.trim() : item.code;
      if (code && !code.startsWith('/')) {
        code = `/${code}`;
      }
      return {
        ...item,
        ...patch,
        code,
        title: patch.title !== undefined ? patch.title.trim() : item.title,
        content: patch.content !== undefined ? patch.content.trim() : item.content,
      };
    });

    saveTemplates(next);
    setTemplates(next);
  }, []);

  const deleteTemplate = useCallback((id: string) => {
    const current = loadStoredTemplates();
    const next = current.filter((item) => item.id !== id);
    saveTemplates(next);
    setTemplates(next);
  }, []);

  const resetToDefaults = useCallback(() => {
    saveTemplates(DEFAULT_QUICK_TEMPLATES);
    setTemplates(DEFAULT_QUICK_TEMPLATES);
  }, []);

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    resetToDefaults,
    interpolateTemplate,
  };
}
