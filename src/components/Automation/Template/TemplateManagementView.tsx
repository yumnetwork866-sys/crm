import { Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { WhatsAppTemplateAnalytics } from '../../../types';
import { api } from '../../../utils/apiClient';
import type { TemplateManagementViewProps } from './types';
import { TemplateDetailView } from './components/TemplateDetailView';
import { TemplateTable } from './components/TemplateTable';
import { TemplateWizardModal } from './components/TemplateWizardModal';

export function TemplateManagementView({
  templates,
  isLoading,
  error,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
  onRefetch,
}: TemplateManagementViewProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [successMessage, setSuccessMessage] = useState('');
  const [bulkActionError, setBulkActionError] = useState('');
  const [analyticsByTemplateId, setAnalyticsByTemplateId] = useState<Record<string, WhatsAppTemplateAnalytics>>({});
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState('');
  const displayedTemplates = useMemo(() => templates.map((template) => (
    template.is_archived_locally ? { ...template, status: 'ARCHIVED' } : template
  )), [templates]);
  const templateIds = useMemo(
    () => displayedTemplates.flatMap((template) => template.id ? [template.id] : []),
    [displayedTemplates],
  );
  const templateIdsKey = templateIds.join(',');
  const normalizedPath = location.pathname.replace(/\/$/, '');
  const isCreatePage = normalizedPath === '/automation/templates/create';
  const detailPathPrefix = '/automation/templates/';
  const detailKey = !isCreatePage && normalizedPath.startsWith(detailPathPrefix)
    ? decodeURIComponent(normalizedPath.slice(detailPathPrefix.length))
    : '';
  const selectedTemplate = detailKey
    ? displayedTemplates.find((template) => (
      template.id === detailKey || `${template.name}::${template.language}` === detailKey
    ))
    : undefined;

  const openForm = useCallback(() => {
    onResetCreateError();
    setSuccessMessage('');
    void navigate('/automation/templates/create');
  }, [navigate, onResetCreateError]);

  const closeForm = useCallback(() => {
    onResetCreateError();
    void navigate('/automation/templates');
  }, [navigate, onResetCreateError]);

  const handleSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
  }, []);

  const archiveSelectedTemplates = useCallback(async (selectedTemplates: typeof templates) => {
    const archivePayload = selectedTemplates.flatMap((template) => template.id
      ? [{ id: template.id, name: template.name, language: template.language }]
      : []);
    if (archivePayload.length !== selectedTemplates.length) {
      throw new Error('Không thể archive template chưa có Meta ID.');
    }

    setBulkActionError('');
    setSuccessMessage('');
    try {
      await api.post('/campaigns/templates/bulk-archive', { templates: archivePayload });
      setSuccessMessage(`Đã lưu trữ ${archivePayload.length} template trong database.`);
    } catch (archiveError) {
      const message = archiveError instanceof Error
        ? archiveError.message
        : 'Không thể lưu trạng thái archive vào database.';
      setBulkActionError(message);
      throw archiveError;
    } finally {
      onRefetch();
    }
  }, [onRefetch, templates]);

  const unarchiveSelectedTemplates = useCallback(async (selectedTemplates: typeof templates) => {
    const unarchivePayload = selectedTemplates.flatMap((template) => template.id
      ? [{ id: template.id, name: template.name, language: template.language }]
      : []);
    if (unarchivePayload.length !== selectedTemplates.length) {
      throw new Error('Không thể unarchive template chưa có Meta ID.');
    }

    setBulkActionError('');
    setSuccessMessage('');
    try {
      await api.post('/campaigns/templates/bulk-unarchive', { templates: unarchivePayload });
      setSuccessMessage(`Đã bỏ lưu trữ ${unarchivePayload.length} template trong database.`);
    } catch (unarchiveError) {
      const message = unarchiveError instanceof Error
        ? unarchiveError.message
        : 'Không thể bỏ trạng thái archive trong database.';
      setBulkActionError(message);
      throw unarchiveError;
    } finally {
      onRefetch();
    }
  }, [onRefetch, templates]);

  const deleteSelectedTemplates = useCallback(async (selectedTemplates: typeof templates) => {
    const deletableTemplates = selectedTemplates.flatMap((template) => template.id
      ? [{ id: template.id, name: template.name, language: template.language }]
      : []);
    if (deletableTemplates.length !== selectedTemplates.length) {
      throw new Error('Không thể xóa template chưa có Meta ID.');
    }

    setBulkActionError('');
    setSuccessMessage('');
    try {
      await api.post<{ success: boolean; deleted: number }>('/campaigns/templates/bulk-delete', {
        templates: deletableTemplates,
      });
      setSuccessMessage(`Đã xóa ${deletableTemplates.length} template khỏi Meta.`);
    } catch (deleteError) {
      const message = deleteError instanceof Error
        ? deleteError.message
        : 'Không thể xóa template khỏi Meta.';
      setBulkActionError(message);
      throw deleteError;
    } finally {
      onRefetch();
    }
  }, [onRefetch, templates]);

  useEffect(() => {
    if (!templateIdsKey) {
      setAnalyticsByTemplateId({});
      setAnalyticsError('');
      return;
    }

    let isCurrent = true;
    const end = Math.floor(Date.now() / 1000);
    const start = end - (30 * 24 * 60 * 60);
    const query = new URLSearchParams({
      start: String(start),
      end: String(end),
      templateIds: templateIdsKey,
    });

    setIsAnalyticsLoading(true);
    setAnalyticsError('');
    void api.get<{ data: WhatsAppTemplateAnalytics[] }>(
      `/campaigns/templates/analytics?${query.toString()}`,
    ).then((response) => {
      if (!isCurrent) return;
      setAnalyticsByTemplateId(Object.fromEntries(
        response.data.map((analytics) => [analytics.templateId, analytics]),
      ));
    }).catch((analyticsRequestError: unknown) => {
      if (!isCurrent) return;
      setAnalyticsByTemplateId({});
      setAnalyticsError(
        analyticsRequestError instanceof Error
          ? analyticsRequestError.message
          : 'Không thể tải Template Analytics từ Meta.',
      );
    }).finally(() => {
      if (isCurrent) setIsAnalyticsLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [templateIdsKey]);

  if (isCreatePage) {
    return (
      <TemplateWizardModal
        onClose={closeForm}
        onCreateTemplate={onCreateTemplate}
        isCreatePending={isCreatePending}
        createError={createError}
        onResetCreateError={onResetCreateError}
        onSuccess={handleSuccess}
      />
    );
  }

  if (detailKey) {
    if (selectedTemplate) {
      return (
        <TemplateDetailView
          template={selectedTemplate}
          analytics={selectedTemplate.id ? analyticsByTemplateId[selectedTemplate.id] : undefined}
          isAnalyticsLoading={isAnalyticsLoading}
          analyticsError={analyticsError}
        />
      );
    }

    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold text-slate-700">
          {isLoading ? 'Đang tải thông tin template...' : 'Không tìm thấy template này.'}
        </p>
        <button
          type="button"
          onClick={() => void navigate('/automation/templates')}
          className="mt-4 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>

          <h2 className="mt-1 text-xl font-bold text-slate-900">Quản lý Message Template</h2>

        </div>
        <div className="flex gap-2">

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

      {error || bulkActionError ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {bulkActionError || error?.message}
        </div>
      ) : null}
      {displayedTemplates.length > 0 ? (
        <TemplateTable
          templates={displayedTemplates}
          analyticsByTemplateId={analyticsByTemplateId}
          isAnalyticsLoading={isAnalyticsLoading}
          onDeleteTemplates={deleteSelectedTemplates}
          onArchiveTemplates={archiveSelectedTemplates}
          onUnarchiveTemplates={unarchiveSelectedTemplates}
          onSelectTemplate={(template) => {
            const key = template.id || `${template.name}::${template.language}`;
            void navigate(`/automation/templates/${encodeURIComponent(key)}`);
          }}
        />
      ) : null}
      {analyticsError ? (
        <p role="status" className="text-xs text-amber-700">
          Không thể tải số liệu Meta Analytics: {analyticsError}
        </p>
      ) : null}
      {!isLoading && !error && displayedTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
          WABA chưa có template nào.
        </div>
      ) : null}
    </div>
  );
}
