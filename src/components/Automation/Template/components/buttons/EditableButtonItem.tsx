import { Check, Files, GripVertical, Info, LoaderCircle, Plus, Telescope, Trash2, X } from 'lucide-react';
import { memo, useEffect, useState, type KeyboardEvent } from 'react';
import type { WhatsAppTemplateButtonType } from '../../../../../types';
import { api } from '../../../../../utils/apiClient';
import {
  BUTTON_LABELS,
  BUTTON_ICON_OPTIONS,
  DEFAULT_BUTTON_TEXT,
  WHATSAPP_CALLING_DOCS_URL,
  WHATSAPP_MANAGER_URL,
  TEMPLATE_BUTTON_ICON_CLASSES,
  inputClass,
  labelClass,
} from '../../constants/templateConstants';
import type { EditableButton, QuickReplyMode } from '../../types';
import { CircleOptionDropdown } from '../common/CircleOptionDropdown';
import { CreateFlowModal } from './CreateFlowModal';
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

type WhatsAppFlowOption = {
  id: string;
  name: string;
  status: string;
  categories?: string[];
};

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
  const [isFlowPickerOpen, setIsFlowPickerOpen] = useState(false);
  const [isCreateFlowModalOpen, setIsCreateFlowModalOpen] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState('');
  const [availableFlows, setAvailableFlows] = useState<WhatsAppFlowOption[] | null>(null);
  const [isFlowsLoading, setIsFlowsLoading] = useState(false);
  const [flowsError, setFlowsError] = useState('');

  const loadFlows = async () => {
    setIsFlowsLoading(true);
    setFlowsError('');
    try {
      const flows = await api.get<WhatsAppFlowOption[]>('/campaigns/templates/flows');
      setAvailableFlows(flows);
    } catch (error) {
      setFlowsError(error instanceof Error ? error.message : 'Không thể tải danh sách Flow.');
    } finally {
      setIsFlowsLoading(false);
    }
  };

  const openFlowPicker = () => {
    setSelectedFlowId(button.flowId);
    setIsFlowPickerOpen(true);
    if (availableFlows === null && !isFlowsLoading) void loadFlows();
  };

  const closeFlowPicker = () => setIsFlowPickerOpen(false);

  const confirmFlowSelection = () => {
    const selectedFlow = availableFlows?.find((flow) => flow.id === selectedFlowId);
    if (!selectedFlow) return;
    onUpdate(button.id, { flowId: selectedFlow.id });
    closeFlowPicker();
  };

  useEffect(() => {
    if (!isFlowPickerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') closeFlowPicker();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isFlowPickerOpen]);

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
      buttonIcon: !button.buttonIcon || button.buttonIcon === TEMPLATE_BUTTON_ICON_CLASSES[button.type]
        ? TEMPLATE_BUTTON_ICON_CLASSES[nextType]
        : button.buttonIcon,
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
              ? 'md:grid-cols-[12rem_minmax(10rem,1fr)_7rem_minmax(14rem,1.25fr)]'
            : button.type === 'PHONE_NUMBER'
                ? 'md:grid-cols-[12rem_minmax(10rem,1fr)_7rem_minmax(14rem,1fr)]'
                : button.type === 'VOICE_CALL' || button.type === 'FLOW'
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

          {button.type === 'FLOW' ? (
            <div className="min-w-0">
              <span className={labelClass}>Button icon</span>
              <CircleOptionDropdown
                value={button.buttonIcon || TEMPLATE_BUTTON_ICON_CLASSES[button.type]}
                options={[...BUTTON_ICON_OPTIONS]}
                ariaLabel="Icon của button"
                onChange={(buttonIcon) => onUpdate(button.id, { buttonIcon })}
              />
            </div>
          ) : null}

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

          {button.type === 'FLOW' ? (
            <div className="min-w-0 md:col-span-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFlowModalOpen(true)}
                  aria-expanded={isCreateFlowModalOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Tạo mới
                </button>
                <button
                  type="button"
                  onClick={openFlowPicker}
                  aria-expanded={isFlowPickerOpen}
                  aria-controls={`template-button-flow-picker-${button.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Files className="h-3.5 w-3.5" /> Sử dụng có sẵn
                </button>
              </div>

              <CreateFlowModal
                isOpen={isCreateFlowModalOpen}
                onClose={() => setIsCreateFlowModalOpen(false)}
              />

              {isFlowPickerOpen ? (
                <div
                  className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[1px]"
                  onMouseDown={closeFlowPicker}
                >
                  <div
                    id={`template-button-flow-picker-${button.id}`}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby={`template-button-flow-picker-title-${button.id}`}
                    className="flex max-h-[calc(100vh-2rem)] w-full max-w-150 flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl"
                    onMouseDown={(event) => event.stopPropagation()}
                  >
                    <header className="flex items-center justify-between px-4 py-3">
                      <h3
                        id={`template-button-flow-picker-title-${button.id}`}
                        className="text-base font-bold text-slate-800"
                      >
                        Chọn Flow có sẵn
                      </h3>
                      <button
                        type="button"
                        onClick={closeFlowPicker}
                        aria-label="Đóng hộp chọn Flow"
                        className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                      >
                        <X aria-hidden="true" className="h-5 w-5" />
                      </button>
                    </header>

                    <div className="min-h-72 flex-1 overflow-y-auto border-y border-slate-200">
                      {isFlowsLoading ? (
                        <div className="flex min-h-72 items-center justify-center gap-2 text-sm text-slate-500">
                          <LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin" />
                          Đang tải danh sách Flow...
                        </div>
                      ) : flowsError ? (
                        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                          <p role="alert" className="text-sm text-rose-600">{flowsError}</p>
                          <button
                            type="button"
                            onClick={() => void loadFlows()}
                            className="mt-3 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            Thử lại
                          </button>
                        </div>
                      ) : availableFlows?.length ? (
                        <div
                          role="listbox"
                          aria-label="Danh sách Flow có sẵn"
                          className="space-y-2 p-4"
                        >
                          {availableFlows.map((flow) => {
                            const isSelected = flow.id === selectedFlowId;
                            return (
                              <button
                                key={flow.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => setSelectedFlowId(flow.id)}
                                className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition ${
                                  isSelected
                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                }`}
                              >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                  isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected ? <Check aria-hidden="true" className="h-3.5 w-3.5 text-white" /> : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-slate-800">{flow.name}</span>
                                  <span className="mt-0.5 block truncate text-xs text-slate-500">ID: {flow.id}</span>
                                </span>
                                <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                                  {flow.status}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
                          <span className="mb-4 flex h-32 w-32 items-center justify-center rounded-full bg-slate-100">
                            <Telescope aria-hidden="true" className="h-20 w-20 text-slate-400" strokeWidth={1.4} />
                          </span>
                          <p className="text-base font-bold text-slate-800">Không tìm thấy Flow nào.</p>
                          <p className="mt-1 text-sm text-slate-600">
                            Hãy tạo một Flow mới để liên kết với tin nhắn mẫu.
                          </p>
                        </div>
                      )}
                    </div>

                    <footer className="flex justify-end gap-2 px-4 py-3">
                      <button
                        type="button"
                        onClick={closeFlowPicker}
                        className="rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={confirmFlowSelection}
                        disabled={
                          isFlowsLoading || !availableFlows?.some((flow) => flow.id === selectedFlowId)
                        }
                        className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-200"
                      >
                        Xác nhận
                      </button>
                    </footer>
                  </div>
                </div>
              ) : null}

              <input
                required
                id={`template-button-flow-id-${button.id}`}
                value={button.flowId}
                onChange={(event) => onUpdate(button.id, { flowId: event.target.value })}
                placeholder="Nhập Flow ID đã tạo"
                className={`${inputClass} mt-2 h-10`}
              />
              <p className="mt-1 text-[11px] text-slate-500">Button mặc định sử dụng icon Flow và nội dung “View Flow”.</p>
            </div>
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
              <a
                href={WHATSAPP_MANAGER_URL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-sky-700 underline decoration-sky-300 underline-offset-2 hover:text-sky-900"
              >
                cổng WhatsApp Manager
              </a>
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
