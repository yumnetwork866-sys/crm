import type {
  WhatsAppApprovedTemplate,
  WhatsAppTemplateButtonType,
} from '../../types';
import { TemplateButtonIcon } from './Template/components/common/TemplateButtonIcon';

type PreviewButton = {
  type?: string;
  text?: string;
  otp_type?: string;
};

function getPreviewButtonType(button: PreviewButton): WhatsAppTemplateButtonType {
  if (button.type === 'COPY_CODE' || button.otp_type === 'COPY_CODE') return 'COPY_CODE';
  const supportedTypes: WhatsAppTemplateButtonType[] = [
    'QUICK_REPLY',
    'URL',
    'PHONE_NUMBER',
    'VOICE_CALL',
    'FLOW',
    'CONTACT',
  ];
  return supportedTypes.includes(button.type as WhatsAppTemplateButtonType)
    ? button.type as WhatsAppTemplateButtonType
    : 'QUICK_REPLY';
}

interface AutomationMessagePreviewProps {
  template?: WhatsAppApprovedTemplate;
  fallbackBody?: string;
}

export function AutomationMessagePreview({
  template,
  fallbackBody = '',
}: AutomationMessagePreviewProps) {
  const header = template?.components.find((component) => component.type?.toUpperCase() === 'HEADER');
  const body = template?.components.find((component) => component.type?.toUpperCase() === 'BODY');
  const footer = template?.components.find((component) => component.type?.toUpperCase() === 'FOOTER');
  const buttonComponent = template?.components.find((component) => component.type?.toUpperCase() === 'BUTTONS');
  const buttons = Array.isArray(buttonComponent?.buttons)
    ? buttonComponent.buttons as PreviewButton[]
    : [];
  const headerFormat = header?.format?.toUpperCase();
  const visibleButtons = buttons.length >= 3 ? buttons.slice(0, 2) : buttons;
  const previewTime = new Date().toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="rounded-xl border border-slate-200 bg-[#efeae2] p-4"
      style={{
        backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55) 0 1px, transparent 1px)',
        backgroundSize: '16px 16px',
      }}
    >
      <div className="ml-auto max-w-xl overflow-hidden rounded-lg rounded-tr-none bg-white shadow-sm">
        {header ? (
          headerFormat === 'TEXT' ? (
            <p className="px-3 pt-3 text-sm font-bold text-slate-900">{header.text}</p>
          ) : (
            <div className="flex h-28 items-center justify-center bg-slate-100 text-xs font-semibold text-slate-500">
              {headerFormat ? `${headerFormat} template` : 'Media template'}
            </div>
          )
        ) : null}
        <div className="space-y-2 px-3 pb-2 pt-3">
          <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">
            {body?.text || fallbackBody || 'Chọn template để xem nội dung'}
          </p>
          {footer?.text ? <p className="text-[11px] font-normal text-slate-400">{footer.text}</p> : null}
          <div className="text-right text-[10px] text-slate-300">{previewTime}</div>
        </div>
        {buttons.length > 0 ? (
          <div className="divide-y divide-slate-100 border-t border-slate-100 px-2">
            {visibleButtons.map((button, index) => {
              const buttonType = getPreviewButtonType(button);
              return (
                <div
                  key={`${button.type || 'button'}-${index}`}
                  className="flex items-center justify-center gap-2 py-2 text-center text-xs font-semibold text-emerald-600"
                >
                  <TemplateButtonIcon type={buttonType} />
                  <span>{button.text || button.otp_type || 'Thao tác'}</span>
                </div>
              );
            })}
            {buttons.length >= 3 ? (
              <div className="py-2 text-center text-xs font-semibold text-emerald-600">
                See all options
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
