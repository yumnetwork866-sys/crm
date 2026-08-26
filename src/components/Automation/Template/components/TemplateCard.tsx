import { CheckCircle2, Clock3, XCircle } from 'lucide-react';
import { memo } from 'react';
import type { WhatsAppApprovedTemplate, WhatsAppTemplateButtonType } from '../../../../types';
import { BUTTON_LABELS, STATUS_CLASSES } from '../constants/templateConstants';
import { TemplateButtonIcon } from './common/TemplateButtonIcon';

interface TemplateCardProps {
  template: WhatsAppApprovedTemplate;
}

export const TemplateCard = memo(function TemplateCard({ template }: TemplateCardProps) {
  const statusClass = STATUS_CLASSES[template.status] || 'border-slate-300 bg-slate-100 text-slate-700';
  const StatusIcon = template.status === 'APPROVED' ? CheckCircle2 : template.status === 'REJECTED' ? XCircle : Clock3;
  const header = template.components.find((component) => component.type?.toUpperCase() === 'HEADER');
  const body = template.components.find((component) => component.type?.toUpperCase() === 'BODY');
  const footer = template.components.find((component) => component.type?.toUpperCase() === 'FOOTER');
  const buttonComponent = template.components.find((component) => component.type?.toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonComponent?.buttons)
    ? buttonComponent.buttons as Array<{ type?: string; text?: string; url?: string; phone_number?: string; otp_type?: string }>
    : [];
  const rejectionReason = template.status === 'REJECTED' && template.rejected_reason && template.rejected_reason !== 'NONE'
    ? template.rejected_reason
    : null;
  const qualityScore = template.quality_score?.score && template.quality_score.score !== 'UNKNOWN'
    ? template.quality_score.score
    : null;
  const isMetaSample = template.name === 'hello_world';

  return (
    <article className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-mono text-sm font-bold text-slate-900">{template.name}</h3>
            {isMetaSample ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Mẫu của Meta</span> : null}
          </div>
          <p className="mt-1 text-xs text-slate-500">{template.language} · {template.category} · {template.parameter_format || 'POSITIONAL'}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${statusClass}`}>
          <StatusIcon className="h-3.5 w-3.5" />
          {template.status}
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        {header ? <div className="border-b border-slate-200 px-3 py-2 text-xs font-bold text-slate-800">{header.format && header.format !== 'TEXT' ? `[${header.format}]` : header.text}</div> : null}
        {body?.text ? (
          <p className="whitespace-pre-wrap px-3 py-3 text-xs leading-relaxed text-slate-700">{body.text}</p>
        ) : template.category === 'AUTHENTICATION' ? (
          <p className="px-3 py-3 text-xs text-slate-700">Nội dung mã xác thực do Meta tạo tự động.</p>
        ) : null}
        {footer?.text ? <p className="border-t border-slate-200 px-3 py-2 text-[11px] text-slate-500">{footer.text}</p> : null}
        {buttons.length > 0 ? (
          <div className="grid gap-1 border-t border-slate-200 p-2">
            {buttons.map((button, index) => {
              const type = (button.type === 'COPY_CODE' || button.otp_type === 'COPY_CODE'
                ? 'COPY_CODE'
                : button.type || 'QUICK_REPLY') as WhatsAppTemplateButtonType;
              return (
                <div key={index} className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-center text-xs font-semibold text-emerald-600" style={{ color: '#059669' }}>
                  <TemplateButtonIcon type={type} />
                  <span className="font-semibold text-emerald-600" style={{ color: '#059669' }}>
                    {button.text || button.otp_type || BUTTON_LABELS[button.type as WhatsAppTemplateButtonType] || button.type}
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {rejectionReason ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><strong>Lý do từ chối:</strong> {rejectionReason}</div> : null}
      {qualityScore ? <p className="text-[11px] font-medium text-slate-500">Quality score: {qualityScore}</p> : null}
    </article>
  );
});
