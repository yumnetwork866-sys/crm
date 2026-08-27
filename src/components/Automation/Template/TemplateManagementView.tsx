import { FileText, Plus, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { TemplateManagementViewProps } from './types';
import { TemplateCard } from './components/TemplateCard';
import { TemplateWizardModal } from './components/TemplateWizardModal';
import { WHATSAPP_MANAGER_URL } from './constants/templateConstants';
import { TEMPLATE_DRAFT_STORAGE_KEY } from './hooks/useTemplateForm';

export function TemplateManagementView({
  templates,
  isLoading,
  error,
  onRefetch,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
}: TemplateManagementViewProps) {
  const [isFormOpen, setIsFormOpen] = useState(() => {
    try {
      return Boolean(localStorage.getItem(TEMPLATE_DRAFT_STORAGE_KEY));
    } catch {
      return false;
    }
  });
  const [successMessage, setSuccessMessage] = useState('');

  const openForm = useCallback(() => {
    onResetCreateError();
    setSuccessMessage('');
    setIsFormOpen(true);
  }, [onResetCreateError]);

  const closeForm = useCallback(() => setIsFormOpen(false), []);
  const handleSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setIsFormOpen(false);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a
            href={WHATSAPP_MANAGER_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition"
          >
            <FileText className="h-4 w-4" />
            <span>WhatsApp Manager</span>
          </a>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Quản lý Message Template</h2>
          <p className="mt-1 text-xs text-slate-500">Tạo component và gửi trực tiếp sang WABA để Meta xét duyệt.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefetch}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> Tải lại
          </button>
          <button
            type="button"
            onClick={openForm}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4 text-white" aria-hidden="true" style={{ color: '#ffffff', stroke: '#ffffff' }} /> Tạo template
          </button>
        </div>
      </div>

      {successMessage ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isFormOpen ? (
        <TemplateWizardModal
          onClose={closeForm}
          onCreateTemplate={onCreateTemplate}
          isCreatePending={isCreatePending}
          createError={createError}
          onResetCreateError={onResetCreateError}
          onSuccess={handleSuccess}
        />
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error.message}
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {templates.map((template) => (
          <TemplateCard key={`${template.name}::${template.language}`} template={template} />
        ))}
      </div>
      {!isLoading && !error && templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
          WABA chưa có template nào.
        </div>
      ) : null}
    </div>
  );
}
