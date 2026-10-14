import type { Dispatch, SetStateAction } from 'react';
import type { WhatsAppTemplateCategory } from '../../../../../types';
import { CATEGORY_DESCRIPTIONS, sectionClass } from '../../constants/templateConstants';
import type { TemplateFormData, TemplateType } from '../../types';
import {
  CATEGORY_ICONS,
  MARKETING_TEMPLATE_TYPES,
  UTILITY_TEMPLATE_TYPES,
} from './templateWizardUtils';

interface TemplateTypeStepProps {
  form: TemplateFormData;
  setForm: Dispatch<SetStateAction<TemplateFormData>>;
  updateField: <K extends keyof TemplateFormData>(key: K, value: TemplateFormData[K]) => void;
}

export function TemplateTypeStep({
  form,
  setForm,
  updateField,
}: TemplateTypeStepProps) {
  const templateTypes: Array<[TemplateType, string, string]> =
    form.category === 'UTILITY' ? UTILITY_TEMPLATE_TYPES : MARKETING_TEMPLATE_TYPES;

  return (
    <>
      <section className={sectionClass}>
        <h3 className="text-xl font-bold text-slate-900">Thiết lập template</h3>
        <div
          className="grid grid-cols-1 gap-2 rounded-xl bg-slate-100 p-1 sm:grid-cols-3"
          role="tablist"
          aria-label="Template category"
        >
          {(['MARKETING', 'UTILITY', 'AUTHENTICATION'] as WhatsAppTemplateCategory[]).map((category) => {
            const CategoryIcon = CATEGORY_ICONS[category];
            const isSelected = form.category === category;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setForm((current) => ({
                  ...current,
                  category,
                  templateType: 'DEFAULT',
                }))}
                className={`template-category-tab group relative flex items-center gap-2.5 rounded-lg px-3 py-3 text-left transition ${
                  isSelected
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200'
                    : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  <CategoryIcon
                    className="template-category-tab-icon h-4 w-4"
                    aria-hidden="true"
                    style={{
                      color: isSelected ? '#ffffff' : '#334155',
                      stroke: isSelected ? '#ffffff' : '#334155',
                    }}
                  />
                </span>
                <span className="block text-sm font-bold">
                  {category === 'MARKETING'
                    ? 'Marketing'
                    : category === 'UTILITY'
                      ? 'Utility'
                      : 'Authentication'}
                </span>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left text-xs font-normal leading-5 text-slate-900 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  {CATEGORY_DESCRIPTIONS[category]}
                  {category === 'AUTHENTICATION'
                    ? ' Meta tự tạo nội dung OTP theo ngôn ngữ và cài đặt ở bước tiếp theo.'
                    : ''}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {form.category !== 'AUTHENTICATION' ? (
        <section className={sectionClass}>
          <h3 className="font-bold text-slate-900">Loại template</h3>
          <div className="grid gap-3">
            {templateTypes.map(([value, title, description]) => {
              const unavailable = value !== 'DEFAULT';
              return (
                <label
                  key={value}
                  className={`relative flex cursor-pointer gap-3 rounded-xl border p-4 transition ${
                    form.templateType === value
                      ? 'border-indigo-300 bg-indigo-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="templateType"
                    value={value}
                    checked={form.templateType === value}
                    onChange={() => updateField('templateType', value)}
                    className="mt-1"
                  />
                  <span>
                    <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                      {title}
                      {unavailable ? (
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-600">
                          Chưa hỗ trợ
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ) : (
        <section className={sectionClass}>
          <div>
            <h3 className="font-bold text-slate-900">Loại template</h3>
            <p className="text-xs text-slate-500">Chọn cách gửi mã xác thực cho khách hàng.</p>
          </div>
          <label className="relative flex cursor-pointer gap-3 rounded-xl border border-indigo-300 bg-indigo-50 p-4">
            <input type="radio" name="authenticationTemplateType" checked readOnly className="mt-1" />
            <span>
              <span className="block text-sm font-bold text-slate-900">One-time passcode</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Gửi mã xác thực dùng một lần để đăng nhập hoặc xác minh tài khoản.
              </span>
            </span>
          </label>
        </section>
      )}
    </>
  );
}
