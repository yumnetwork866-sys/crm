import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Info,
  LoaderCircle,
  Trash2,
} from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import type { WhatsAppApprovedTemplate, WhatsAppTemplateAnalytics } from '../../../../types';
import { getTemplateLanguageLabel } from '../constants/languages';
import { STATUS_CLASSES } from '../constants/templateConstants';

type SortKey = 'name' | 'category' | 'language' | 'status' | 'delivered' | 'readRate' | 'lastEdited';
type SortDirection = 'asc' | 'desc';

interface TemplateTableProps {
  templates: WhatsAppApprovedTemplate[];
  analyticsByTemplateId: Record<string, WhatsAppTemplateAnalytics>;
  isAnalyticsLoading: boolean;
  onDeleteTemplates: (templates: WhatsAppApprovedTemplate[]) => Promise<void>;
  onSelectTemplate: (template: WhatsAppApprovedTemplate) => void;
}

const STATUS_LABELS: Record<string, string> = {
  APPROVED: 'Active',
  PENDING: 'Pending',
  REJECTED: 'Rejected',
  PAUSED: 'Paused',
  DISABLED: 'Disabled',
  IN_APPEAL: 'In appeal',
};

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[_\s-])\w/g, (character) => character.toUpperCase())
    .replace(/_/g, ' ');
}

function getBodyPreview(template: WhatsAppApprovedTemplate) {
  return template.components.find((component) => component.type?.toUpperCase() === 'BODY')?.text || '';
}

function getLastEditedTimestamp(template: WhatsAppApprovedTemplate) {
  const value = template.quality_score?.date;
  if (!value) return 0;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function formatLastEdited(template: WhatsAppApprovedTemplate) {
  const timestamp = getLastEditedTimestamp(template);
  if (!timestamp) return '--';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function getStatusLabel(template: WhatsAppApprovedTemplate) {
  const status = STATUS_LABELS[template.status] || titleCase(template.status);
  const quality = template.quality_score?.score;
  if (template.status !== 'APPROVED' || !quality || quality === 'UNKNOWN') return status;
  return `${status} – Quality ${quality.toLowerCase()}`;
}

function getTemplateKey(template: WhatsAppApprovedTemplate) {
  return template.id || `${template.name}::${template.language}`;
}

export const TemplateTable = memo(function TemplateTable({
  templates,
  analyticsByTemplateId,
  isAnalyticsLoading,
  onDeleteTemplates,
  onSelectTemplate,
}: TemplateTableProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('lastEdited');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedTemplates = useMemo(() => {
    const valueFor = (template: WhatsAppApprovedTemplate): string | number => {
      switch (sortKey) {
        case 'name':
          return template.name;
        case 'category':
          return template.category;
        case 'language':
          return getTemplateLanguageLabel(template.language);
        case 'status':
          return template.status;

        case 'lastEdited':
          return getLastEditedTimestamp(template);
        case 'delivered':
          return template.id ? analyticsByTemplateId[template.id]?.delivered ?? -1 : -1;
        case 'readRate': {
          const analytics = template.id ? analyticsByTemplateId[template.id] : undefined;
          return analytics?.delivered
            ? (analytics.read / analytics.delivered) * 100
            : analytics ? 0 : -1;
        }
      }
    };

    return [...templates].sort((left, right) => {
      const leftValue = valueFor(left);
      const rightValue = valueFor(right);
      const comparison = typeof leftValue === 'number' && typeof rightValue === 'number'
        ? leftValue - rightValue
        : String(leftValue).localeCompare(String(rightValue));
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [analyticsByTemplateId, sortDirection, sortKey, templates]);

  const selectedTemplates = templates.filter((template) => selectedKeys.has(getTemplateKey(template)));
  const allSelected = templates.length > 0
    && templates.every((template) => selectedKeys.has(getTemplateKey(template)));
  const someSelected = !allSelected
    && templates.some((template) => selectedKeys.has(getTemplateKey(template)));

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'lastEdited' ? 'desc' : 'asc');
  };

  const toggleAll = () => {
    setSelectedKeys((current) => {
      if (allSelected) return new Set();
      const next = new Set(current);
      templates.forEach((template) => next.add(getTemplateKey(template)));
      return next;
    });
  };

  const toggleTemplate = (template: WhatsAppApprovedTemplate) => {
    const key = getTemplateKey(template);
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!selectedTemplates.length || isDeleting) return;
    const confirmed = window.confirm(
      `Xóa ${selectedTemplates.length} template đã chọn khỏi Meta? Hành động này không thể hoàn tác.`,
    );
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDeleteTemplates(selectedTemplates);
      setSelectedKeys(new Set());
    } catch {
      // The parent displays the API error while preserving the selection for retry.
    } finally {
      setIsDeleting(false);
    }
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <ArrowUpDown aria-hidden="true" className="h-3.5 w-3.5" />;
    return sortDirection === 'asc'
      ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5 text-sky-600" />
      : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 text-sky-600" />;
  };

  const SortHeader = ({
    column,
    children,
    info,
  }: {
    column: SortKey;
    children: string;
    info?: string;
  }) => (
    <th scope="col" className="px-4 py-3 text-left align-middle transition-colors hover:bg-slate-100">
      <span className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => toggleSort(column)}
          className="-mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-bold text-slate-800 transition-colors hover:text-sky-700"
        >
          <span>{children}</span>
          <SortIcon column={column} />
        </button>
        {info ? (
          <span title={info} aria-label={info} className="inline-flex text-slate-600">
            <Info aria-hidden="true" className="h-3.5 w-3.5 text-slate-700" />
          </span>
        ) : null}
      </span>
    </th>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {selectedTemplates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
          <span className="mr-1 text-sm font-medium text-slate-800">
            {selectedTemplates.length} templates selected
          </span>
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={isDeleting || selectedTemplates.some((template) => !template.id)}
            className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDeleting
              ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              : <Trash2 className="h-4 w-4" aria-hidden="true" />}
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            disabled
            title="Meta Graph API không hỗ trợ chủ động archive message template."
            className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Archive className="h-4 w-4" aria-hidden="true" /> Archive
          </button>
          <button
            type="button"
            disabled
            title="Meta Graph API không hỗ trợ chủ động unarchive message template."
            className="inline-flex h-9 items-center gap-2 rounded border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> Unarchive
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-310 border-collapse text-sm">
          <thead className="border-b border-slate-200 bg-white text-xs">
            <tr>
              <th scope="col" className="w-16 px-5 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Chọn tất cả template"
                  className="h-5 w-5 rounded border-slate-300 accent-sky-600"
                />
              </th>
              <SortHeader column="name">Template name</SortHeader>
              <SortHeader column="category">Category</SortHeader>
              <SortHeader column="language">Language</SortHeader>
              <SortHeader column="status">Status</SortHeader>
              <SortHeader column="delivered" info="Số tin nhắn đã gửi thành công bằng template này.">
                Messages delivered
              </SortHeader>
              <SortHeader column="readRate" info="Tỷ lệ tin nhắn đã gửi được người nhận đọc.">
                Read rate
              </SortHeader>

              <SortHeader column="lastEdited">Last edited</SortHeader>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sortedTemplates.map((template) => {
              const key = getTemplateKey(template);
              const isSelected = selectedKeys.has(key);
              const bodyPreview = getBodyPreview(template);
              const analytics = template.id ? analyticsByTemplateId[template.id] : undefined;
              const readRate = analytics?.delivered
                ? (analytics.read / analytics.delivered) * 100
                : analytics ? 0 : null;
              const statusClass = STATUS_CLASSES[template.status]
                || 'border-slate-300 bg-slate-100 text-slate-700';

              return (
                <tr
                  key={key}
                  onClick={() => onSelectTemplate(template)}
                  className={`cursor-pointer ${isSelected ? 'bg-sky-50/60' : 'hover:bg-slate-50/70'}`}
                >
                  <td className="px-5 py-4 align-top">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(event) => event.stopPropagation()}
                      onChange={() => toggleTemplate(template)}
                      aria-label={`Chọn template ${template.name}`}
                      className="h-5 w-5 rounded border-slate-300 accent-sky-600"
                    />
                  </td>
                  <td className="px-4 py-4 align-top font-medium text-slate-900">
                    <span className="block max-w-52 truncate" title={template.name}>{template.name}</span>
                  </td>
                  <td className="px-4 py-4 align-top text-slate-700">{titleCase(template.category)}</td>
                  <td className="px-4 py-4 align-top">
                    <span className="font-medium text-slate-800">{getTemplateLanguageLabel(template.language)}</span>
                    {bodyPreview ? (
                      <span className="mt-1 block max-w-52 truncate text-xs text-slate-500" title={bodyPreview}>
                        {bodyPreview}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className={`inline-flex max-w-52 truncate rounded-full border px-2 py-1 text-[11px] font-bold ${statusClass}`}>
                      {getStatusLabel(template)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top tabular-nums text-slate-700">
                    {analytics
                      ? analytics.delivered.toLocaleString()
                      : isAnalyticsLoading ? '...' : '--'}
                  </td>
                  <td className="px-4 py-4 align-top tabular-nums text-slate-700">
                    {readRate !== null
                      ? `${readRate.toFixed(1)}%`
                      : isAnalyticsLoading ? '...' : '--'}
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 align-top text-slate-700">
                    {formatLastEdited(template)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default TemplateTable;
