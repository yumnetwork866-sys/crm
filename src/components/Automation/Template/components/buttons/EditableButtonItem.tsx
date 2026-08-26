import { GripVertical, Info, Trash2 } from 'lucide-react';
import { memo, type KeyboardEvent } from 'react';
import type { WhatsAppTemplateButtonType } from '../../../../../types';
import {
  BUTTON_LABELS,
  DEFAULT_BUTTON_TEXT,
  WHATSAPP_CALLING_DOCS_URL,
  WHATSAPP_MANAGER_URL,
  inputClass,
  labelClass,
} from '../../constants/templateConstants';
import type { EditableButton, QuickReplyMode } from '../../types';
import { CircleOptionDropdown } from '../common/CircleOptionDropdown';
import { PhoneCountryDropdown } from '../common/PhoneCountryDropdown';

const QUICK_REPLY_OPTIONS = [
  { value: 'CUSTOM', label: 'Custom' },
  { value: 'PRE_CONFIGURED_RESPONSE', label: 'Pre-configured response' },
];

const ACTION_BUTTON_OPTIONS = [
  { value: 'URL', label: 'Visit website' },
  { value: 'VOICE_CALL', label: 'Call on WhatsApp' },
  { value: 'PHONE_NUMBER', label: 'Call Phone Number' },
  { value: 'FLOW', label: 'Complete flow' },
  { value: 'COPY_CODE', label: 'Copy offer code' },
  { value: 'CONTACT', label: 'Share contact info' },
];

const VOICE_CALL_VALIDITY_OPTIONS = Array.from({ length: 30 }, (_, dayIndex) => {
  const days = dayIndex + 1;
  return { value: String(days), label: `${days} ngày` };
});

export interface EditableButtonItemProps {
  button: EditableButton;
  index: number;
  totalButtons: number;
  onUpdate: (id: string, patch: Partial<EditableButton>) => void;
  onRemove: (id: string) => void;
  onMove: (fromIndex: number, toIndex: number) => void;
  isDuplicate: boolean;
}

export const EditableButtonItem = memo(function EditableButtonItem({
  button,
  index,
  totalButtons,
  onUpdate,
  onRemove,
  onMove,
  isDuplicate,
}: EditableButtonItemProps) {
  const handleReorderKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp' && index > 0) {
      event.preventDefault();
      onMove(index, index - 1);
    } else if (event.key === 'ArrowDown' && index < totalButtons - 1) {
      event.preventDefault();
      onMove(index, index + 1);
    }
  };

  const changeButtonType = (value: string) => {
    const nextType = value as WhatsAppTemplateButtonType;
    const isPreviousDefault =
      !button.text.trim() ||
      button.text === DEFAULT_BUTTON_TEXT[button.type] ||
      button.text === BUTTON_LABELS[button.type] ||
      Object.values(DEFAULT_BUTTON_TEXT).includes(button.text) ||
      Object.values(BUTTON_LABELS).includes(button.text);

    onUpdate(button.id, {
      type: nextType,
      text: isPreviousDefault ? DEFAULT_BUTTON_TEXT[nextType] || '' : button.text,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2.5">
        {totalButtons > 1 ? (
          <button
            type="button"
            onKeyDown={handleReorderKeyDown}
            aria-label={`Sắp xếp button ${index + 1} trên ${totalButtons}. Dùng phím mũi tên lên hoặc xuống để thay đổi thứ tự.`}
            aria-keyshortcuts="ArrowUp ArrowDown"
            title="Kéo thả hoặc dùng phím mũi tên lên, xuống để sắp xếp thứ tự"
            className="flex h-9 w-6 shrink-0 cursor-grab items-center justify-center text-slate-400 transition hover:text-slate-700 focus-visible:cursor-default focus-visible:rounded focus-visible:outline-2 focus-visible:outline-indigo-500 active:cursor-grabbing"
          >
            <GripVertical aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}

        <div
          className={`grid min-w-0 flex-1 grid-cols-1 items-end gap-2.5 ${
            button.type === 'URL'
              ? 'md:grid-cols-[10rem_minmax(10rem,1fr)_7rem_minmax(14rem,1.25fr)]'
              : button.type === 'PHONE_NUMBER'
                ? 'md:grid-cols-[10rem_minmax(10rem,1fr)_7rem_minmax(14rem,1fr)]'
                : button.type === 'VOICE_CALL'
                  ? 'md:grid-cols-[12rem_minmax(0,1fr)_8rem]'
                  : 'md:grid-cols-[12rem_minmax(0,1fr)]'
          }`}
        >
          <div className="min-w-0">
            <span className={labelClass}>Loại button</span>
            {button.type === 'QUICK_REPLY' ? (
              <CircleOptionDropdown
                value={button.quickReplyMode || 'CUSTOM'}
                options={QUICK_REPLY_OPTIONS}
                ariaLabel="Loại quick reply"
                onChange={(value) => {
                  const quickReplyMode = value as QuickReplyMode;
                  onUpdate(button.id, {
                    quickReplyMode,
                    text:
                      quickReplyMode === 'PRE_CONFIGURED_RESPONSE'
                        ? 'Preconfigured Response'
                        : 'Quick Reply',
                  });
                }}
              />
            ) : (
              <CircleOptionDropdown
                value={button.type}
                options={ACTION_BUTTON_OPTIONS}
                ariaLabel="Loại button hành động"
                onChange={changeButtonType}
              />
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor={`template-button-text-${button.id}`} className={labelClass}>Nội dung button</label>
            <div className="relative">
              <input
                required
                id={`template-button-text-${button.id}`}
                maxLength={40}
                value={button.text}
                onChange={(event) => onUpdate(button.id, { text: event.target.value })}
                placeholder="Nhập nội dung button..."
                className={`${inputClass} h-10 pr-12 ${
                  isDuplicate
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-100'
                    : ''
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                {button.text.length}/40
              </span>
            </div>
          </div>

          {button.type === 'PHONE_NUMBER' ? (
            <>
              <div className="min-w-0">
                <span className={labelClass}>Quốc gia</span>
                <PhoneCountryDropdown
                  value={button.phoneCountryIso}
                  onChange={(phoneCountryIso) => onUpdate(button.id, { phoneCountryIso })}
                />
              </div>
              <div className="min-w-0">
                <label htmlFor={`template-button-phone-${button.id}`} className={labelClass}>Số điện thoại</label>
                <input
                  required
                  id={`template-button-phone-${button.id}`}
                  type="tel"
                  value={button.phoneNumber}
                  onChange={(event) => onUpdate(button.id, { phoneNumber: event.target.value })}
                  className={`${inputClass} h-10`}
                />
              </div>
            </>
          ) : null}

          {button.type === 'VOICE_CALL' ? (
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-700">Hiệu lực</span>
                <span className="group relative inline-flex">
                  <button
                    type="button"
                    aria-label="Giải thích thời gian hiệu lực"
                    aria-describedby={`voice-call-validity-tooltip-${button.id}`}
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:text-sky-700 focus-visible:outline-2 focus-visible:outline-sky-500"
                  >
                    <Info aria-hidden="true" className="h-3.5 w-3.5" />
                  </button>
                  <span
                    id={`voice-call-validity-tooltip-${button.id}`}
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-5 text-slate-700 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                  >
                    Nút này sẽ duy trì trạng thái hoạt động trong khoảng thời gian đã chọn.
                  </span>
                </span>
              </div>
              <CircleOptionDropdown
                value={String(button.activeForDays)}
                options={VOICE_CALL_VALIDITY_OPTIONS}
                ariaLabel="Thời gian hiệu lực của button gọi WhatsApp"
                onChange={(value) => onUpdate(button.id, { activeForDays: Number(value) })}
              />
            </div>
          ) : null}

          {button.type === 'URL' ? (
            <>
              <div className="min-w-0">
                <label htmlFor={`template-button-url-type-${button.id}`} className={labelClass}>Kiểu URL</label>
                <select
                  value={button.urlType}
                  id={`template-button-url-type-${button.id}`}
                  onChange={(event) => {
                    const urlType = event.target.value as EditableButton['urlType'];
                    onUpdate(button.id, {
                      urlType,
                      ...(urlType === 'STATIC' ? { urlExample: '' } : {}),
                    });
                  }}
                  className={`${inputClass} h-10`}
                >
                  <option value="STATIC">Static</option>
                  <option value="DYNAMIC">Dynamic</option>
                </select>
              </div>
              <div className="min-w-0">
                <label htmlFor={`template-button-url-${button.id}`} className={labelClass}>URL HTTPS</label>
                <input
                  required
                  id={`template-button-url-${button.id}`}
                  type="url"
                  value={button.url}
                  onChange={(event) => onUpdate(button.id, { url: event.target.value })}
                  placeholder={
                    button.urlType === 'DYNAMIC'
                      ? 'https://example.com/{{1}}'
                      : 'https://example.com'
                  }
                  className={`${inputClass} h-10`}
                />
              </div>
            </>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => onRemove(button.id)}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-rose-500 transition hover:bg-rose-50 hover:text-rose-700"
          aria-label="Xóa button"
          title="Xóa button"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>

      {button.type === 'VOICE_CALL' ? (
        <div className="flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-xs leading-5 text-slate-700">
          <span
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700"
            aria-hidden="true"
          >
            <Info className="h-3.5 w-3.5 stroke-[2.5]" />
          </span>
          <div className="min-w-0">
            <p>
              Bật tính năng gọi trong{' '}
              {WHATSAPP_MANAGER_URL ? (
                <a
                  href={WHATSAPP_MANAGER_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
                >
                  cổng WhatsApp Manager
                </a>
              ) : (
                <span className="font-semibold text-slate-800">cổng WhatsApp Manager</span>
              )}
              . Ngoài ra, bạn có thể sử dụng Phone Number Settings API.
            </p>
            <a
              href={WHATSAPP_CALLING_DOCS_URL}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
            >
              Tìm hiểu về tính năng gọi trên WhatsApp
            </a>
          </div>
        </div>
      ) : null}

      {button.type === 'URL' && button.urlType === 'DYNAMIC' ? (
        <div>
          <label htmlFor={`template-button-url-example-${button.id}`} className={labelClass}>URL mẫu</label>
          <input
            required
            id={`template-button-url-example-${button.id}`}
            type="url"
            value={button.urlExample}
            onChange={(event) => onUpdate(button.id, { urlExample: event.target.value })}
            placeholder="https://example.com/123"
            className={inputClass}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            URL động phải chứa một biến; URL mẫu cần thay biến bằng giá trị thực tế.
          </p>
        </div>
      ) : null}
    </div>
  );
});

export default EditableButtonItem;
