import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { syncExamples } from '../utils/templateFormatters';
import { extractVariables, getMetaTemplateBodyErrors } from '../utils/templateValidation';
import type { TemplateFormData } from '../types';

export function createInitialTemplateState(): TemplateFormData {
  return {
    templateType: 'DEFAULT',
    name: '',
    language: 'en',
    category: 'MARKETING',
    parameterFormat: 'POSITIONAL',
    allowCategoryChange: false,
    headerFormat: 'NONE',
    headerText: '',
    headerExamples: [],
    mediaHandle: '',
    mediaFileName: '',
    mediaPreviewUrl: '',
    body: '',
    bodyExamples: [],
    footer: '',
    buttons: [],
    otpType: 'COPY_CODE',
    otpButtonText: 'Sao chép mã',
    otpAutofillText: 'Tự động điền',
    otpPackage: '',
    otpSignature: '',
    otpExpiration: 10,
    addSecurityRecommendation: true,
    zeroTapTermsAccepted: false,
  };
}

export const INITIAL_TEMPLATE_STATE: TemplateFormData = createInitialTemplateState();
export const TEMPLATE_DRAFT_STORAGE_KEY = 'yumcrm_template_draft_v1';
export const TEMPLATE_DRAFT_TTL_MS = 60 * 60 * 1000;

type TemplateDraftRecord = Record<string, unknown>;

export function readTemplateDraft(): TemplateDraftRecord | null {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(TEMPLATE_DRAFT_STORAGE_KEY) || 'null');
    if (!saved || typeof saved !== 'object') return null;

    const expiresAt = 'expiresAt' in saved ? Number(saved.expiresAt) : 0;
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      localStorage.removeItem(TEMPLATE_DRAFT_STORAGE_KEY);
      return null;
    }

    return saved as TemplateDraftRecord;
  } catch {
    try {
      localStorage.removeItem(TEMPLATE_DRAFT_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }
    return null;
  }
}

export function persistTemplateDraft(patch: TemplateDraftRecord): void {
  try {
    const previousDraft = readTemplateDraft() || {};
    localStorage.setItem(TEMPLATE_DRAFT_STORAGE_KEY, JSON.stringify({
      ...previousDraft,
      ...patch,
      expiresAt: Date.now() + TEMPLATE_DRAFT_TTL_MS,
    }));
  } catch {
    // Draft persistence is best-effort when storage is unavailable or full.
  }
}

function loadTemplateDraft(): TemplateFormData {
  const saved = readTemplateDraft();
  if (!saved) return createInitialTemplateState();
  const draft = saved.form && typeof saved.form === 'object' ? saved.form : {};
  return { ...createInitialTemplateState(), ...draft } as TemplateFormData;
}

function normalizeButtonText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function useTemplateForm() {
  const [form, setForm] = useState<TemplateFormData>(loadTemplateDraft);
  const skipNextPersistRef = useRef(false);

  const updateField = useCallback(
    <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => {
      setForm((current) => Object.is(current[key], value) ? current : { ...current, [key]: value });
    },
    [],
  );

  const resetForm = useCallback(() => {
    skipNextPersistRef.current = true;
    localStorage.removeItem(TEMPLATE_DRAFT_STORAGE_KEY);
    setForm(createInitialTemplateState());
  }, []);

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false;
      return;
    }
    persistTemplateDraft({ form });
  }, [form]);

  const bodyVariables = useMemo(
    () => extractVariables(form.body, form.parameterFormat),
    [form.body, form.parameterFormat],
  );

  const headerVariables = useMemo(
    () => extractVariables(form.headerText, form.parameterFormat),
    [form.headerText, form.parameterFormat],
  );

  const bodyValidationErrors = useMemo(
    () =>
      form.category !== 'AUTHENTICATION'
        ? getMetaTemplateBodyErrors(form.body, form.parameterFormat)
        : [],
    [form.body, form.category, form.parameterFormat],
  );

  const duplicateButtonTextKeys = useMemo(() => {
    const counts = new Map<string, number>();

    form.buttons.forEach((button) => {
      const key = normalizeButtonText(button.text);
      if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key),
    );
  }, [form.buttons]);

  const hasDuplicateButtonText = duplicateButtonTextKeys.size > 0;

  const isDuplicateButtonText = useCallback(
    (text: string) => duplicateButtonTextKeys.has(normalizeButtonText(text)),
    [duplicateButtonTextKeys],
  );

  useEffect(() => {
    setForm((current) => {
      const bodyExamples = syncExamples(current.bodyExamples, bodyVariables, form.parameterFormat);
      return bodyExamples === current.bodyExamples ? current : { ...current, bodyExamples };
    });
  }, [bodyVariables, form.parameterFormat]);

  useEffect(() => {
    setForm((current) => {
      const headerExamples = syncExamples(current.headerExamples, headerVariables, form.parameterFormat);
      return headerExamples === current.headerExamples ? current : { ...current, headerExamples };
    });
  }, [form.parameterFormat, headerVariables]);

  return {
    form,
    setForm,
    updateField,
    resetForm,
    bodyVariables,
    headerVariables,
    bodyValidationErrors,
    validationErrors: bodyValidationErrors,
    duplicateButtonTextKeys,
    hasDuplicateButtonText,
    isDuplicateButtonText,
  };
}
