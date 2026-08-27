import { FileText, Image as ImageIcon, Loader2, LockKeyhole, MapPin, ShieldCheck, Video } from 'lucide-react';
import { memo, useState } from 'react';
import type {
  WhatsAppOtpType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateExample,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../../../types';
import {
  BUTTON_LABELS,
  CATEGORY_PREVIEW_GUIDANCE,
  MARKETING_SETUP_PREVIEW_IMAGES,
  UTILITY_SETUP_PREVIEW_IMAGES,
} from '../constants/templateConstants';
import type { EditableButton, TemplateType, WizardStep } from '../types';
import { substituteExamples } from '../utils/templateFormatters';
import { TemplateButtonIcon } from './common/TemplateButtonIcon';

interface TemplatePreviewProps {
  wizardStep: WizardStep;
  templateType: TemplateType;
  category: WhatsAppTemplateCategory;
  headerFormat: WhatsAppTemplateHeaderFormat;
  headerText: string;
  headerExamples: WhatsAppTemplateExample[];
  mediaFileName: string;
  mediaPreviewUrl: string;
  body: string;
  bodyExamples: WhatsAppTemplateExample[];
  footer: string;
  buttons: EditableButton[];
  parameterFormat: WhatsAppTemplateParameterFormat;
  otpType: WhatsAppOtpType;
  otpButtonText: string;
  otpExpiration: number;
  addSecurityRecommendation: boolean;
}

export const TemplatePreview = memo(function TemplatePreview({
  wizardStep,
  templateType,
  category,
  headerFormat,
  headerText,
  headerExamples,
  mediaFileName,
  mediaPreviewUrl,
  body,
  bodyExamples,
  footer,
  buttons,
  parameterFormat,
  otpType,
  otpButtonText,
  otpExpiration,
  addSecurityRecommendation,
}: TemplatePreviewProps) {
  const [loadedSrc, setLoadedSrc] = useState<string>('');
  const previewHeader = substituteExamples(headerText, headerExamples, parameterFormat);
  const previewBody = substituteExamples(body, bodyExamples, parameterFormat);
  const showSetupIllustration = wizardStep === 1;
  const setupPreviewImage = category === 'AUTHENTICATION'
    ? '/images/template-types/otp.webp'
    : category === 'UTILITY' && templateType !== 'CATALOGUE'
      ? UTILITY_SETUP_PREVIEW_IMAGES[templateType]
      : MARKETING_SETUP_PREVIEW_IMAGES[templateType];
  const isImageReady = loadedSrc === setupPreviewImage;
  const previewTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  return (
    <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-bold text-slate-900">Template preview</h3>
      </div>
      <div
        className={`min-h-107.5 bg-[#efeae2] ${showSetupIllustration ? 'p-0' : 'p-4'}`}
        style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(255,255,255,.55) 0 1px, transparent 1px)',
          backgroundSize: '16px 16px',
        }}
      >
        {showSetupIllustration ? (
          <div className="relative flex min-h-107.5 w-full items-center justify-center overflow-hidden bg-[#f7f2e9]">
            {!isImageReady ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-xs text-slate-400">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                <span>Đang tải minh họa...</span>
              </div>
            ) : null}
            <img
              key={setupPreviewImage}
              src={setupPreviewImage}
              alt={`Minh họa ${templateType.toLowerCase()} template`}
              className={`relative z-10 block h-auto w-full bg-[#f7f2e9] transition-opacity duration-150 ${
                isImageReady ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setLoadedSrc(setupPreviewImage)}
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="ml-auto max-w-[94%] overflow-hidden rounded-lg rounded-tr-none bg-white shadow-sm">
            {category === 'AUTHENTICATION' ? (
              <>
                <div className="space-y-3 p-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <LockKeyhole className="h-4 w-4 text-emerald-600" /> Mã xác thực của bạn
                  </div>
                  <p className="text-sm leading-5 text-slate-700">Mã xác thực của bạn là <strong>123456</strong>.</p>
                  {addSecurityRecommendation ? <p className="text-xs text-slate-600">Để bảo mật, đừng chia sẻ mã này.</p> : null}
                  <p className="text-[11px] text-slate-500">Mã này sẽ hết hạn sau {otpExpiration} phút.</p>
                  <div className="text-right text-[10px] text-slate-400">{previewTime}</div>
                </div>
                <div className="border-t border-slate-100 p-2">
                  <div className="flex items-center justify-center gap-2 rounded-md py-1.5 text-xs font-semibold text-emerald-600" style={{ color: '#059669' }}>
                    {otpType === 'COPY_CODE'
                      ? <TemplateButtonIcon type="COPY_CODE" />
                      : <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 template-preview-button-icon" style={{ color: '#059669', stroke: '#059669' }} />}
                    <span className="text-emerald-600" style={{ color: '#059669' }}>
                      {otpButtonText || (otpType === 'COPY_CODE' ? 'Sao chép mã' : 'Tự động điền')}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                {headerFormat !== 'NONE' ? (
                  <div>
                    {headerFormat === 'TEXT' ? (
                      <div className="px-3 pt-3 text-sm font-bold text-slate-900">{previewHeader || 'Nội dung header'}</div>
                    ) : headerFormat === 'LOCATION' ? (
                      <div className="flex h-32 flex-col items-center justify-center gap-1.5 bg-slate-100 px-3 text-center text-xs text-slate-600">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <MapPin className="h-4.5 w-4.5 text-rose-600" />
                          <span>Vị trí (Location)</span>
                        </div>
                        <span className="text-[11px] text-slate-400">Vị trí địa lý sẽ được đính kèm khi gửi</span>
                      </div>
                    ) : (
                      <div className="flex h-36 flex-col items-center justify-center gap-2 bg-slate-100 px-3 text-center text-xs text-slate-500">
                        {headerFormat === 'IMAGE' && mediaPreviewUrl ? (
                          <img src={mediaPreviewUrl} alt={mediaFileName || 'Ảnh mẫu template'} className="h-full w-full object-cover" />
                        ) : headerFormat === 'VIDEO' ? (
                          <><Video className="h-8 w-8" /><span className="max-w-full truncate">{mediaFileName || 'video mẫu'}</span></>
                        ) : (
                          <>
                            {headerFormat === 'IMAGE' ? <Image className="h-8 w-8" /> : <FileText className="h-8 w-8" />}
                            <span className="max-w-full truncate">{mediaFileName || `${headerFormat.toLowerCase()} mẫu`}</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
                <div className="space-y-2 px-3 pb-2 pt-3">
                  {previewBody ? <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">{previewBody}</p> : null}
                  {footer ? <p className="text-[11px] text-slate-500">{footer}</p> : null}
                  <div className="text-right text-[10px] text-slate-400">{previewTime}</div>
                </div>
                {buttons.length > 0 ? (
                  <div className="divide-y divide-slate-100 border-t border-slate-100 px-2">
                    {buttons.map((button) => (
                      <div key={button.id} className="flex items-center justify-center gap-2 py-2 text-center text-xs font-semibold text-emerald-600" style={{ color: '#059669' }}>
                        <TemplateButtonIcon type={button.type} />
                        <span className="font-semibold text-emerald-600" style={{ color: '#059669' }}>
                          {button.text || BUTTON_LABELS[button.type]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}
      </div>
      {showSetupIllustration ? (
        <div className="space-y-4 border-t border-slate-200 bg-white p-4">
          <div>
            <p className="text-xs font-bold text-slate-900">Template này phù hợp cho</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{CATEGORY_PREVIEW_GUIDANCE[category].suitableFor}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Khu vực có thể tùy chỉnh</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{CATEGORY_PREVIEW_GUIDANCE[category].customizable}</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
});
