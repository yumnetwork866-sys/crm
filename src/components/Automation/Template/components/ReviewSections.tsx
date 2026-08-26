import { ShieldCheck } from 'lucide-react';
import { memo } from 'react';
import type {
  WhatsAppOtpType,
  WhatsAppTemplateCategory,
  WhatsAppTemplateHeaderFormat,
  WhatsAppTemplateParameterFormat,
} from '../../../../types';
import { sectionClass } from '../constants/templateConstants';
import type { EditableButton } from '../types';
import { toE164Phone } from '../utils/templateFormatters';

interface ReviewRowProps {
  label: string;
  value: React.ReactNode;
}

const ReviewRow = ({ label, value }: ReviewRowProps) => (
  <div className="grid gap-1 border-b border-slate-100 py-3 last:border-0 sm:grid-cols-[160px_1fr]">
    <dt className="text-xs font-semibold text-slate-500">{label}</dt>
    <dd className="whitespace-pre-wrap wrap-break-word text-sm text-slate-800">{value || '—'}</dd>
  </div>
);

interface ReviewSectionsProps {
  category: WhatsAppTemplateCategory;
  name: string;
  language: string;
  parameterFormat: WhatsAppTemplateParameterFormat;
  headerFormat: WhatsAppTemplateHeaderFormat;
  headerText: string;
  mediaFileName: string;
  body: string;
  footer: string;
  buttons: EditableButton[];
  otpType: WhatsAppOtpType;
  otpButtonText: string;
  otpExpiration: number;
  addSecurityRecommendation: boolean;
}

export const ReviewSections = memo(function ReviewSections({
  category,
  name,
  language,
  parameterFormat,
  headerFormat,
  headerText,
  mediaFileName,
  body,
  footer,
  buttons,
  otpType,
  otpButtonText,
  otpExpiration,
  addSecurityRecommendation,
}: ReviewSectionsProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-sm font-bold text-amber-900">Sẵn sàng gửi Meta xét duyệt</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">
              Meta sẽ kiểm tra nội dung, category và định dạng của template. Quá trình xét duyệt có thể mất đến 24 giờ và template chỉ sử dụng được sau khi được phê duyệt.
            </p>
          </div>
        </div>
      </div>
      <section className={sectionClass}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Submit for Review</p>
          <h3 className="mt-1 font-bold text-slate-900">Thiết lập template</h3>
        </div>
        <dl>
          <ReviewRow label="Tên" value={<span className="font-mono">{name}</span>} />
          <ReviewRow label="Category" value={category} />
          <ReviewRow label="Ngôn ngữ" value={language} />
          {category !== 'AUTHENTICATION' ? <ReviewRow label="Parameter format" value={parameterFormat} /> : null}
        </dl>
      </section>
      {category === 'AUTHENTICATION' ? (
        <section className={sectionClass}>
          <h3 className="font-bold text-slate-900">Authentication và OTP</h3>
          <dl>
            <ReviewRow label="Loại OTP" value={otpType} />
            <ReviewRow label="Nội dung button" value={otpButtonText} />
            <ReviewRow label="Thời gian hết hạn" value={`${otpExpiration} phút`} />
            <ReviewRow label="Khuyến nghị bảo mật" value={addSecurityRecommendation ? 'Có' : 'Không'} />
          </dl>
        </section>
      ) : (
        <>
          <section className={sectionClass}>
            <h3 className="font-bold text-slate-900">Nội dung</h3>
            <dl>
              <ReviewRow
                label="Header"
                value={headerFormat === 'NONE'
                  ? 'Không có'
                  : headerFormat === 'LOCATION'
                    ? 'LOCATION · Vị trí'
                    : `${headerFormat}${headerFormat === 'TEXT' ? ` · ${headerText}` : ` · ${mediaFileName}`}`}
              />
              <ReviewRow label="Body" value={body} />
              <ReviewRow label="Footer" value={footer} />
            </dl>
          </section>
          <section className={sectionClass}>
            <h3 className="font-bold text-slate-900">Buttons ({buttons.length})</h3>
            {buttons.length ? (
              <dl>
                {buttons.map((button, index) => (
                  <ReviewRow
                    key={button.id}
                    label={`Button ${index + 1} · ${button.type}`}
                    value={`${button.text}${
                      button.type === 'URL'
                        ? ` · ${button.url}`
                        : button.type === 'PHONE_NUMBER'
                          ? ` · ${toE164Phone(button.phoneCountryIso, button.phoneNumber)}`
                          : ''
                    }`}
                  />
                ))}
              </dl>
            ) : (
              <p className="text-sm text-slate-500">Không có button.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
});
