import {
  ArrowLeft,
  BarChart3,
  Bell,
  CalendarDays,
  Copy,
  ExternalLink,
  Info,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import type {
  WhatsAppApprovedTemplate,
  WhatsAppTemplateAnalytics,
} from '../../../../types';
import { getTemplateLanguageLabel } from '../constants/languages';
import {
  STATUS_CLASSES,
  WHATSAPP_INSIGHTS_URL,
  WHATSAPP_MANAGER_URL,
} from '../constants/templateConstants';

interface TemplateDetailViewProps {
  template: WhatsAppApprovedTemplate;
  analytics?: WhatsAppTemplateAnalytics;
  isAnalyticsLoading: boolean;
  analyticsError: string;
  onBack: () => void;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[_\s-])\w/g, (character) => character.toUpperCase())
    .replace(/_/g, ' ');
}

function getUpdatedTimestamp(template: WhatsAppApprovedTemplate) {
  const value = template.quality_score?.date;
  if (!value) return 0;
  return value < 10_000_000_000 ? value * 1000 : value;
}

function formatDate(timestamp: number) {
  if (!timestamp) return '--';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function getStatusLabel(template: WhatsAppApprovedTemplate) {
  const labels: Record<string, string> = {
    APPROVED: 'Active',
    PENDING: 'Pending',
    REJECTED: 'Rejected',
    PAUSED: 'Paused',
    DISABLED: 'Disabled',
  };
  const status = labels[template.status] || titleCase(template.status);
  const quality = template.quality_score?.score;
  if (template.status !== 'APPROVED' || !quality || quality === 'UNKNOWN') return status;
  return `${status} – Quality ${quality.toLowerCase()}`;
}

export function TemplateDetailView({
  template,
  analytics,
  isAnalyticsLoading,
  analyticsError,
  onBack,
}: TemplateDetailViewProps) {
  const header = template.components.find((component) => component.type?.toUpperCase() === 'HEADER');
  const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY');
  const footer = template.components.find((component) => component.type?.toUpperCase() === 'FOOTER');
  const buttonComponent = template.components.find((component) => component.type?.toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonComponent?.buttons)
    ? buttonComponent.buttons as Array<{ text?: string; type?: string }>
    : [];
  const updatedTimestamp = getUpdatedTimestamp(template);
  const statusClass = STATUS_CLASSES[template.status]
    || 'border-slate-300 bg-slate-100 text-slate-700';
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 30);
  const rangeLabel = `${formatDate(rangeStart.getTime())} – ${formatDate(today.getTime())}`;
  const readRate = analytics?.delivered ? (analytics.read / analytics.delivered) * 100 : 0;
  const clickRate = analytics?.delivered ? (analytics.clicked / analytics.delivered) * 100 : 0;
  const hasAnalytics = Boolean(
    analytics && (
      analytics.sent > 0
      || analytics.delivered > 0
      || analytics.read > 0
      || analytics.clicked > 0
    ),
  );
  const maxDailyDelivered = Math.max(
    1,
    ...(analytics?.dataPoints.map((point) => point.delivered) || []),
  );

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-linear-to-r from-rose-50 via-indigo-50 to-sky-50 p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              aria-label="Quay lại danh sách template"
              className="mt-1 rounded-lg border border-slate-300 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            </button>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Bell aria-hidden="true" className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold text-slate-900">
                {template.name} · {getTemplateLanguageLabel(template.language)}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <span className={`rounded-full border px-2 py-0.5 font-bold ${statusClass}`}>
                  {getStatusLabel(template)}
                </span>
                <span>· {titleCase(template.category)}</span>
                <span>· Updated on {formatDate(updatedTimestamp)}</span>
                <span className="inline-flex items-center gap-1">
                  · ID: {template.id || '--'}
                  {template.id ? (
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard?.writeText(template.id || '')}
                      aria-label="Sao chép ID template"
                      className="rounded p-0.5 hover:bg-white/70"
                    >
                      <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-400 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-white"
            >
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              Auto-detected: {rangeLabel}
            </button>
            <a
              href={WHATSAPP_MANAGER_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-400 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-white"
            >
              <Pencil aria-hidden="true" className="h-4 w-4" />
              Edit template
            </a>
            <button
              type="button"
              aria-label="Tùy chọn khác"
              className="rounded-lg border border-slate-400 bg-white/70 p-2 text-slate-700 hover:bg-white"
            >
              <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {updatedTimestamp ? (
        <section className="flex items-start gap-3 rounded-lg border border-slate-200 border-l-4 border-l-amber-500 bg-white p-4 shadow-sm">
          <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-bold text-slate-800">Template này đã được chỉnh sửa trong khoảng ngày đang chọn</p>
            <p className="mt-1 text-xs text-slate-600">
              Insights sẽ bao gồm tổng mức độ tương tác của các phiên bản template trong khoảng thời gian đã chọn.
            </p>
          </div>
        </section>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <h2 className="px-4 py-4 text-sm font-bold text-slate-800">Template của bạn</h2>
            <div className="bg-[#efeae2] p-6">
              <div className="rounded-lg bg-white p-3 shadow-sm">
                {header ? (
                  <p className="mb-2 text-sm font-bold text-slate-800">
                    {header.format && header.format !== 'TEXT' ? `[${header.format}]` : header.text}
                  </p>
                ) : null}
                {body?.text ? (
                  <p className="whitespace-pre-wrap text-xs leading-5 text-slate-700">{body.text}</p>
                ) : template.category === 'AUTHENTICATION' ? (
                  <p className="text-xs leading-5 text-slate-700">Nội dung xác thực do Meta tạo tự động.</p>
                ) : null}
                {footer?.text ? <p className="mt-2 text-[11px] text-slate-400">{footer.text}</p> : null}
                {buttons.length > 0 ? (
                  <div className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
                    {buttons.map((button, index) => (
                      <p key={`${button.type || 'button'}-${index}`} className="py-2 text-center text-xs font-semibold text-emerald-600">
                        {button.text || button.type}
                      </p>
                    ))}
                  </div>
                ) : null}
                <p className="mt-1 text-right text-[10px] text-slate-400">02:44</p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-800">Xem toàn bộ dữ liệu</h2>
                <p className="mt-1 text-xs leading-5 text-slate-600">Theo dõi hiệu suất trên toàn bộ tài khoản.</p>
              </div>
              <BarChart3 aria-hidden="true" className="h-5 w-5 text-sky-600" />
            </div>
            <a
              href={WHATSAPP_INSIGHTS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-400 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Xem account insights
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
            </a>
          </section>
        </aside>

        <main className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                Messages delivered <Info aria-hidden="true" className="h-3.5 w-3.5" />
              </h2>
              <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-800">
                {analytics ? analytics.delivered.toLocaleString() : isAnalyticsLoading ? '...' : '--'}
              </p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                Read rate <Info aria-hidden="true" className="h-3.5 w-3.5" />
              </h2>
              <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-800">
                {analytics ? `${readRate.toFixed(1)}%` : isAnalyticsLoading ? '...' : '--'}
              </p>
            </section>
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="inline-flex items-center gap-1 text-xs font-bold text-slate-800">
                Click rate <Info aria-hidden="true" className="h-3.5 w-3.5" />
              </h2>
              <p className="mt-4 text-2xl font-semibold tabular-nums text-slate-800">
                {analytics ? `${clickRate.toFixed(1)}%` : isAnalyticsLoading ? '...' : '--'}
              </p>
            </section>
          </div>

          <section className="min-h-72 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="inline-flex items-center gap-1 text-base font-bold text-slate-800">
              Performance <Info aria-hidden="true" className="h-4 w-4" />
            </h2>
            {isAnalyticsLoading ? (
              <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500">
                <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                Đang tải dữ liệu từ Meta...
              </div>
            ) : analyticsError ? (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-rose-600">Không thể tải Meta Analytics.</p>
                <p className="mt-1 max-w-xl text-xs text-slate-500">{analyticsError}</p>
              </div>
            ) : hasAnalytics && analytics ? (
              <div className="mt-6">
                <div className="flex items-center gap-4 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" /> Delivered</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Read</span>
                </div>
                <div className="mt-4 overflow-x-auto pb-2">
                  <div className="flex h-48 min-w-max items-end gap-2 border-b border-slate-200 px-2">
                    {analytics.dataPoints.map((point) => {
                      const deliveredHeight = Math.max(2, (point.delivered / maxDailyDelivered) * 160);
                      const readHeight = Math.max(2, (point.read / maxDailyDelivered) * 160);
                      return (
                        <div
                          key={`${point.start}:${point.end}`}
                          title={`${formatDate(point.start * 1000)} · Delivered: ${point.delivered} · Read: ${point.read}`}
                          className="flex w-8 shrink-0 items-end justify-center gap-0.5"
                        >
                          <span className="w-3 rounded-t bg-sky-500" style={{ height: deliveredHeight }} />
                          <span className="w-3 rounded-t bg-emerald-500" style={{ height: readHeight }} />
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600 sm:grid-cols-4">
                  <p>Sent: <strong className="text-slate-800">{analytics.sent.toLocaleString()}</strong></p>
                  <p>Delivered: <strong className="text-slate-800">{analytics.delivered.toLocaleString()}</strong></p>
                  <p>Read: <strong className="text-slate-800">{analytics.read.toLocaleString()}</strong></p>
                  <p>Clicked: <strong className="text-slate-800">{analytics.clicked.toLocaleString()}</strong></p>
                </div>
              </div>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center text-center">
                <BarChart3 aria-hidden="true" className="h-8 w-8 text-slate-400" />
                <p className="mt-3 text-lg font-bold text-slate-800">Chưa có insights.</p>
                <p className="mt-1 max-w-xl text-sm text-slate-600">
                  Hãy đảm bảo khoảng ngày đã chọn có ngày mà template này được sử dụng để gửi tin nhắn.
                </p>
              </div>
            )}
          </section>

          <p className="text-xs text-slate-500">
            Analytics được tải trực tiếp từ Meta cho 30 ngày gần nhất.
          </p>
        </main>
      </div>
    </div>
  );
}

export default TemplateDetailView;
