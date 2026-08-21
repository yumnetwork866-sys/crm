import React, { useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Plus, RefreshCw, XCircle } from 'lucide-react';
import type {
  CreateWhatsAppTemplateInput,
  WhatsAppApprovedTemplate,
  WhatsAppTemplateCategory,
} from '../../types';

interface TemplateManagementViewProps {
  templates: WhatsAppApprovedTemplate[];
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onCreateTemplate: (input: CreateWhatsAppTemplateInput) => Promise<unknown>;
  isCreatePending: boolean;
  createError: Error | null;
  onResetCreateError: () => void;
}

const STATUS_CLASSES: Record<string, string> = {
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
  PAUSED: 'border-orange-200 bg-orange-50 text-orange-700',
  DISABLED: 'border-slate-300 bg-slate-100 text-slate-700',
};

const getVariableCount = (body: string) => {
  const positions = Array.from(body.matchAll(/\{\{(\d+)\}\}/g)).map((match) => Number(match[1]));
  return positions.length > 0 ? Math.max(...positions) : 0;
};

export const TemplateManagementView: React.FC<TemplateManagementViewProps> = ({
  templates,
  isLoading,
  error,
  onRefetch,
  onCreateTemplate,
  isCreatePending,
  createError,
  onResetCreateError,
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('vi');
  const [category, setCategory] = useState<Exclude<WhatsAppTemplateCategory, 'AUTHENTICATION'>>('MARKETING');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [bodyExamples, setBodyExamples] = useState<string[]>([]);
  const [successMessage, setSuccessMessage] = useState('');

  const variableCount = useMemo(() => getVariableCount(body), [body]);

  const handleBodyChange = (value: string) => {
    setBody(value);
    const count = getVariableCount(value);
    setBodyExamples((current) =>
      Array.from({ length: count }, (_, index) => current[index] || '')
    );
  };

  const resetForm = () => {
    setName('');
    setLanguage('vi');
    setCategory('MARKETING');
    setBody('');
    setFooter('');
    setBodyExamples([]);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    onResetCreateError();
    setSuccessMessage('');
    try {
      await onCreateTemplate({
        name: name.trim(),
        language: language.trim(),
        category,
        body: body.trim(),
        footer: footer.trim() || undefined,
        bodyExamples: bodyExamples.map((example) => example.trim()),
      });
      setSuccessMessage('Template đã được gửi sang Meta và đang chờ xét duyệt.');
      resetForm();
      setIsFormOpen(false);
    } catch {
      // Mutation error is rendered inline.
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600">
            <FileText className="h-4 w-4" />
            <span>WhatsApp Manager</span>
          </div>
          <h2 className="mt-1 text-xl font-bold text-slate-900">Quản lý Message Template</h2>

        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onRefetch}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Tải lại
          </button>
          <button
            type="button"
            onClick={() => setIsFormOpen((current) => !current)}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            Tạo template
          </button>
        </div>
      </div>

      {successMessage ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isFormOpen ? (
        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Tên template</label>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                placeholder="summer_flash_sale"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Ngôn ngữ</label>
              <input
                required
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                placeholder="vi hoặc en_US"
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">Meta Category</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value as Exclude<WhatsAppTemplateCategory, 'AUTHENTICATION'>)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="MARKETING">MARKETING</option>
                <option value="UTILITY">UTILITY</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Nội dung BODY</label>
            <textarea
              required
              rows={4}
              value={body}
              onChange={(event) => handleBodyChange(event.target.value)}
              placeholder="Chào {{1}}, mã ưu đãi của bạn là {{2}}."
              className="w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Dùng biến liên tục theo thứ tự: {'{{1}}'}, {'{{2}}'}, {'{{3}}'}, ...
            </p>
          </div>

          {variableCount > 0 ? (
            <div className="grid grid-cols-1 gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4 sm:grid-cols-2">
              {bodyExamples.map((example, index) => (
                <div key={index}>
                  <label className="mb-1 block text-xs font-semibold text-indigo-800">
                    Giá trị mẫu cho {`{{${index + 1}}}`}
                  </label>
                  <input
                    required
                    value={example}
                    onChange={(event) => setBodyExamples((current) =>
                      current.map((item, itemIndex) => itemIndex === index ? event.target.value : item)
                    )}
                    placeholder={`Ví dụ biến ${index + 1}`}
                    className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Footer tùy chọn</label>
            <input
              value={footer}
              onChange={(event) => setFooter(event.target.value)}
              maxLength={60}
              placeholder="Ưu đãi có thời hạn."
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {createError ? (
            <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
              {createError.message}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isCreatePending}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isCreatePending ? 'Đang gửi Meta...' : 'Gửi xét duyệt'}
            </button>
          </div>
        </form>
      ) : null}

      {error ? (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
          {error.message}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {templates.map((template) => {
          const bodyText = template.components.find((component) => component.type?.toUpperCase() === 'BODY')?.text;
          const statusClass = STATUS_CLASSES[template.status] || 'border-slate-300 bg-slate-100 text-slate-700';
          const StatusIcon = template.status === 'APPROVED'
            ? CheckCircle2
            : template.status === 'REJECTED'
              ? XCircle
              : Clock3;
          return (
            <article key={`${template.name}::${template.language}`} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-mono text-sm font-bold text-slate-900">{template.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {template.language} · {template.category} · {template.parameter_format || 'POSITIONAL'}
                  </p>
                </div>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {template.status}
                </span>
              </div>
              {bodyText ? (
                <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
                  {bodyText}
                </p>
              ) : null}
              {template.rejected_reason ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <strong>Lý do từ chối:</strong> {template.rejected_reason}
                </div>
              ) : null}
              {template.quality_score?.score ? (
                <p className="text-[11px] font-medium text-slate-500">
                  Quality score: {template.quality_score.score}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      {!isLoading && !error && templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
          WABA chưa có template nào.
        </div>
      ) : null}
    </div>
  );
};
