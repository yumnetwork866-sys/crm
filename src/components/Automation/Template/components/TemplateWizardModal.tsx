import { ArrowLeft } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from 'react';
import type {
  CreateWhatsAppTemplateInput,
  WhatsAppTemplateHeaderFormat,
} from '../../../../types';
import { ALL_SETUP_PREVIEW_IMAGES } from '../constants/templateConstants';
import { useMediaUpload, type MediaFormPatch } from '../hooks/useMediaUpload';
import { persistTemplateDraft, useTemplateForm } from '../hooks/useTemplateForm';
import type { EditableButton, WizardStep } from '../types';
import { ReviewSections } from './ReviewSections';
import { WizardProgress } from './WizardProgress';
import { TemplateContentStep } from './wizard/TemplateContentStep';
import { TemplatePreviewPane } from './wizard/TemplatePreviewPane';
import { TemplateTypeStep } from './wizard/TemplateTypeStep';
import {
  buildCreateTemplateInput,
  loadDraftWizardStep,
} from './wizard/templateWizardUtils';

interface TemplateWizardModalProps {
  onClose: () => void;
  onCreateTemplate: (input: CreateWhatsAppTemplateInput) => Promise<unknown>;
  isCreatePending: boolean;
  createError: Error | null;
  onResetCreateError: () => void;
  onSuccess: (message: string) => void;
}

export function TemplateWizardModal({
  onClose,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
  onSuccess,
}: TemplateWizardModalProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>(loadDraftWizardStep);
  const formRef = useRef<HTMLFormElement>(null);

  const {
    form,
    setForm,
    updateField,
    resetForm,
    bodyVariables,
    headerVariables,
    bodyValidationErrors,
    hasDuplicateButtonText,
    isDuplicateButtonText,
  } = useTemplateForm();

  const handleMediaFormChange = useCallback((patch: MediaFormPatch) => {
    setForm((current) => ({ ...current, ...patch }));
  }, [setForm]);
  const {
    clearMediaError,
    isUploadingMedia,
    mediaAccept,
    mediaError,
    setMediaError,
    uploadMedia,
  } = useMediaUpload({
    headerFormat: form.headerFormat,
    mediaPreviewUrl: form.mediaPreviewUrl,
    onFormChange: handleMediaFormChange,
  });

  const setButtons = useCallback<Dispatch<SetStateAction<EditableButton[]>>>((nextButtons) => {
    setForm((current) => ({
      ...current,
      buttons: typeof nextButtons === 'function' ? nextButtons(current.buttons) : nextButtons,
    }));
  }, [setForm]);

  useEffect(() => {
    // Preload all template setup preview images in memory cache for instant switching
    ALL_SETUP_PREVIEW_IMAGES.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  useEffect(() => {
    persistTemplateDraft({ wizardStep });
  }, [wizardStep]);

  const handleHeaderExampleChange = useCallback((index: number, value: string) => {
    setForm((current) => ({
      ...current,
      headerExamples: current.headerExamples.map((item, itemIndex) =>
        itemIndex === index ? { ...item, value } : item),
    }));
  }, [setForm]);

  const handleBodyExampleChange = useCallback((index: number, value: string) => {
    setForm((current) => ({
      ...current,
      bodyExamples: current.bodyExamples.map((item, itemIndex) =>
        itemIndex === index ? { ...item, value } : item),
    }));
  }, [setForm]);

  const handleHeaderFormatChange = useCallback((format: WhatsAppTemplateHeaderFormat) => {
    updateField('headerFormat', format === 'NONE' && form.headerText.trim() ? 'TEXT' : format);
    clearMediaError();
  }, [clearMediaError, form.headerText, updateField]);

  const submitTemplate = useCallback(async () => {
    if (form.category !== 'AUTHENTICATION' && hasDuplicateButtonText) return;
    onResetCreateError();
    try {
      const input = buildCreateTemplateInput(form);
      await onCreateTemplate(input);
      const message = 'Template đã được gửi sang Meta và đang chờ xét duyệt.';
      resetForm();
      onSuccess(message);
      onClose();
    } catch {
      // Mutation error is rendered inline.
    }
  }, [form, hasDuplicateButtonText, onClose, onCreateTemplate, onResetCreateError, onSuccess, resetForm]);

  const continueToEditor = useCallback(() => {
    if (form.templateType !== 'DEFAULT' && form.category !== 'AUTHENTICATION') return;
    setWizardStep(2);
  }, [form.category, form.templateType]);

  const continueToReview = useCallback(() => {
    if (form.category !== 'AUTHENTICATION' && (bodyValidationErrors.length > 0 || hasDuplicateButtonText)) return;
    if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(form.headerFormat) && !form.mediaHandle) {
      setMediaError('Vui lòng upload file mẫu trước khi tiếp tục.');
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    setWizardStep(3);
  }, [bodyValidationErrors.length, form.category, form.headerFormat, form.mediaHandle, hasDuplicateButtonText, setMediaError]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (wizardStep === 3) void submitTemplate();
  }, [submitTemplate, wizardStep]);

  return (
    <div className="w-full space-y-4">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="space-y-5 bg-linear-to-br from-slate-50 via-white to-indigo-50/50 p-3 pb-28 sm:p-5 sm:pb-24"
      >
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <WizardProgress step={wizardStep} />
            {wizardStep === 1 ? (
              <TemplateTypeStep
                form={form}
                setForm={setForm}
                updateField={updateField}
              />
            ) : null}

            {wizardStep === 2 ? (
              <TemplateContentStep
                form={form}
                setForm={setForm}
                updateField={updateField}
                bodyVariables={bodyVariables}
                headerVariables={headerVariables}
                bodyValidationErrors={bodyValidationErrors}
                hasDuplicateButtonText={hasDuplicateButtonText}
                isDuplicateButtonText={isDuplicateButtonText}
                setButtons={setButtons}
                isUploadingMedia={isUploadingMedia}
                mediaAccept={mediaAccept}
                mediaError={mediaError}
                uploadMedia={uploadMedia}
                onHeaderFormatChange={handleHeaderFormatChange}
                onHeaderExampleChange={handleHeaderExampleChange}
                onBodyExampleChange={handleBodyExampleChange}
              />
            ) : null}

            {wizardStep === 3 ? (
              <ReviewSections
                category={form.category}
                name={form.name}
                language={form.language}
                parameterFormat={form.parameterFormat}
                headerFormat={form.headerFormat}
                headerText={form.headerText}
                mediaFileName={form.mediaFileName}
                body={form.body}
                footer={form.footer}
                buttons={form.buttons}
                otpType={form.otpType}
                otpButtonText={form.otpButtonText}
                otpExpiration={form.otpExpiration}
                addSecurityRecommendation={form.addSecurityRecommendation}
              />
            ) : null}

            {createError ? (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
                {createError.message}
              </div>
            ) : null}
            <div className="fixed inset-x-4 bottom-3 z-40 mx-auto flex max-w-384 flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:inset-x-6 lg:inset-x-8">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
                Hủy
              </button>
              <div className="ml-auto flex items-center gap-2">
                {wizardStep > 1 ? (
                  <button
                    type="button"
                    onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" /> Quay lại
                  </button>
                ) : null}
                {wizardStep === 1 ? (
                  <button
                    type="button"
                    onClick={continueToEditor}
                    disabled={form.templateType !== 'DEFAULT' && form.category !== 'AUTHENTICATION'}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Tiếp tục
                  </button>
                ) : null}
                {wizardStep === 2 ? (
                  <button
                    type="button"
                    onClick={continueToReview}
                    disabled={isUploadingMedia || (form.category !== 'AUTHENTICATION' && (bodyValidationErrors.length > 0 || hasDuplicateButtonText))}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Tiếp tục
                  </button>
                ) : null}
                {wizardStep === 3 ? (
                  <button
                    type="submit"
                    disabled={isCreatePending || isUploadingMedia}
                    className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isCreatePending ? 'Đang gửi Meta...' : 'Gửi xét duyệt'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <TemplatePreviewPane wizardStep={wizardStep} form={form} />
        </div>
      </form>
    </div>
  );
}

export default TemplateWizardModal;
