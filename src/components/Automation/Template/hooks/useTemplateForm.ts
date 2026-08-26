import { useCallback, useEffect, useMemo, useState } from 'react';
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

function normalizeButtonText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function useTemplateForm() {
  const [form, setForm] = useState<TemplateFormData>(() => createInitialTemplateState());

  const updateField = useCallback(
    <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => {
      setForm((current) => Object.is(current[key], value) ? current : { ...current, [key]: value });
    },
    [],
  );

  const resetForm = useCallback(() => {
    setForm(createInitialTemplateState());
  }, []);

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
