import {
  Check,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  X,
} from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { WHATSAPP_FLOWS_URL } from '../../constants/templateConstants';

type FlowType = 'SURVEY' | 'EVENT_REGISTRATION' | 'SIGN_UP' | 'CUSTOM';

type FlowTypeOption = {
  value: FlowType;
  title: string;
  description: string;
  previewTitle: string;
  previewDescription: string;
  previewAnswers: string[];
};

const FOLLOW_UP_PREVIEW_QUESTIONS = [
  {
    title: 'Điều gì quan trọng nhất với bạn?',
    description: 'Chọn tất cả phương án phù hợp:',
    answers: ['Giá sản phẩm', 'Chất lượng', 'Ưu đãi', 'Dịch vụ hỗ trợ'],
  },
  {
    title: 'Bạn muốn chúng tôi liên hệ bằng cách nào?',
    description: 'Chọn một hoặc nhiều kênh liên hệ:',
    answers: ['WhatsApp', 'Điện thoại', 'Email'],
  },
] as const;

const EVENT_SOURCE_OPTIONS = [
  "Friend's recommendation",
  'TV advertisement',
  'Search engine',
  'Social media',
] as const;

const FLOW_TYPE_OPTIONS: FlowTypeOption[] = [
  {
    value: 'SURVEY',
    title: 'Gửi khảo sát',
    description: 'Đặt câu hỏi và thu thập ý kiến để hiểu rõ hơn về người dùng.',
    previewTitle: 'Bạn đã tìm thấy ưu đãi hoàn hảo, tiếp theo bạn sẽ làm gì?',
    previewDescription: 'Chọn tất cả phương án phù hợp:',
    previewAnswers: [
      'Mua ngay',
      'Xem đánh giá trước khi mua',
      'Chia sẻ với bạn bè và gia đình',
      'Mua nhiều sản phẩm',
      'Không có phương án nào',
    ],
  },
  {
    value: 'EVENT_REGISTRATION',
    title: 'Đăng ký sự kiện',
    description: 'Thu thập thông tin người dùng để đăng ký sự kiện hoặc chương trình khuyến mãi.',
    previewTitle: 'Đăng ký tham gia sự kiện',
    previewDescription: 'Điền thông tin để hoàn tất đăng ký:',
    previewAnswers: ['Họ và tên', 'Email', 'Số điện thoại'],
  },
  {
    value: 'SIGN_UP',
    title: 'Hoàn tất đăng ký',
    description: 'Thu thập nhanh thông tin liên hệ.',
    previewTitle: 'Hoàn tất hồ sơ của bạn',
    previewDescription: 'Cung cấp thông tin liên hệ:',
    previewAnswers: ['Tên của bạn', 'Địa chỉ email', 'Số điện thoại'],
  },
  {
    value: 'CUSTOM',
    title: 'Biểu mẫu tùy chỉnh',
    description: 'Tạo biểu mẫu phù hợp với nhu cầu cụ thể của bạn.',
    previewTitle: 'Biểu mẫu mới',
    previewDescription: 'Thêm câu hỏi và trường thông tin tùy chỉnh.',
    previewAnswers: ['Câu hỏi tùy chỉnh', 'Nội dung trả lời'],
  },
];

interface CreateFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateFlowModal = memo(function CreateFlowModal({
  isOpen,
  onClose,
}: CreateFlowModalProps) {
  const [selectedType, setSelectedType] = useState<FlowType>('SURVEY');
  const [previewStep, setPreviewStep] = useState(1);
  const [previewSelections, setPreviewSelections] = useState<Record<number, string[]>>({});
  const [eventRegistration, setEventRegistration] = useState({
    firstName: '',
    lastName: '',
    email: '',
  });
  const [eventSource, setEventSource] = useState('');
  const selectedOption = FLOW_TYPE_OPTIONS.find((option) => option.value === selectedType)
    ?? FLOW_TYPE_OPTIONS[0];
  const previewQuestion = previewStep === 1
    ? {
      title: selectedOption.previewTitle,
      description: selectedOption.previewDescription,
      answers: selectedOption.previewAnswers,
    }
    : FOLLOW_UP_PREVIEW_QUESTIONS[previewStep - 2];
  const selectedAnswers = previewSelections[previewStep] ?? [];
  const maxPreviewSteps = selectedType === 'EVENT_REGISTRATION'
    ? 2
    : selectedType === 'SIGN_UP' || selectedType === 'CUSTOM'
      ? 1
      : 3;
  const isEventRegistrationComplete = Object.values(eventRegistration).every(
    (value) => value.trim().length > 0,
  );

  const selectFlowType = (flowType: FlowType) => {
    setSelectedType(flowType);
    setPreviewStep(1);
    setPreviewSelections({});
    setEventRegistration({ firstName: '', lastName: '', email: '' });
    setEventSource('');
  };

  const togglePreviewAnswer = (answer: string) => {
    setPreviewSelections((current) => {
      const answers = current[previewStep] ?? [];
      return {
        ...current,
        [previewStep]: answers.includes(answer)
          ? answers.filter((item) => item !== answer)
          : [...answers, answer],
      };
    });
  };

  const movePreview = (nextStep: number) => {
    setPreviewStep(Math.min(Math.max(nextStep, 1), maxPreviewSteps));
  };

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const createFlow = () => {
    window.open(WHATSAPP_FLOWS_URL, '_blank', 'noopener,noreferrer');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/55 p-0 backdrop-blur-[1px] sm:p-4"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-flow-modal-title"
        className="flex h-full max-h-none w-full max-w-240 flex-col overflow-hidden border-0 border-slate-300 bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100vh-2rem)] sm:rounded-lg sm:border"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3 sm:px-5">
          <h3 id="create-flow-modal-title" className="text-base font-bold text-slate-800">
            Chọn loại Flow
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp chọn loại Flow"
            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(18rem,0.95fr)_minmax(20rem,1.05fr)] md:overflow-hidden">
          <div
            role="radiogroup"
            aria-label="Loại Flow"
            className="space-y-1 border-b border-slate-300 p-2 md:overflow-y-auto md:border-b-0 md:border-r"
          >
            {FLOW_TYPE_OPTIONS.map((option) => {
              const isSelected = option.value === selectedType;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => selectFlowType(option.value)}
                  className={`flex w-full gap-3 rounded-md px-2 py-2.5 text-left transition ${
                    isSelected ? 'bg-sky-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      isSelected ? 'border-slate-300 bg-white' : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isSelected ? <span className="h-3 w-3 rounded-full bg-sky-500" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-800">{option.title}</span>
                    <span className="mt-0.5 block text-xs leading-4 text-slate-600">{option.description}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex min-h-120 flex-col items-center justify-center bg-slate-50 px-3 py-6 sm:px-5 sm:py-8 md:min-h-0 md:overflow-y-auto">
            <div className="w-full max-w-76 overflow-hidden rounded-xl border-4 border-slate-200 bg-white shadow-lg sm:border-8">
              <div className="h-6 bg-slate-400" />
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3 text-xs text-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewStep(1);
                    setPreviewSelections({});
                    setEventRegistration({ firstName: '', lastName: '', email: '' });
                    setEventSource('');
                  }}
                  aria-label="Đặt lại preview"
                  className="rounded p-1 hover:bg-slate-100"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </button>
                <span>
                  {selectedType === 'EVENT_REGISTRATION'
                    ? previewStep === 1 ? 'Sign Up' : 'Thank you'
                    : selectedType === 'SIGN_UP'
                      ? 'Finish Sign Up'
                      : selectedType === 'CUSTOM'
                        ? 'Your form'
                        : `Câu hỏi ${previewStep} / 3`}
                </span>
                <MoreVertical aria-hidden="true" className="h-4 w-4" />
              </div>
              <div className="min-h-104 p-3">
                {selectedType === 'CUSTOM' ? (
                  <p className="text-xs leading-5 text-slate-800">
                    Chọn “Thêm nội dung” để bắt đầu tạo biểu mẫu. Để thêm màn hình mới, hãy chọn
                    {' '}“Thêm mới” trong bảng “Màn hình”.
                  </p>
                ) : selectedType === 'SIGN_UP' ? (
                  <div className="space-y-5 pt-1">
                    <input
                      value={eventRegistration.firstName}
                      onChange={(event) => setEventRegistration((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))}
                      placeholder="First Name"
                      aria-label="First Name"
                      className="h-11 w-full rounded-md border border-slate-400 px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      value={eventRegistration.lastName}
                      onChange={(event) => setEventRegistration((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))}
                      placeholder="Last Name"
                      aria-label="Last Name"
                      className="h-11 w-full rounded-md border border-slate-400 px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="email"
                      value={eventRegistration.email}
                      onChange={(event) => setEventRegistration((current) => ({
                        ...current,
                        email: event.target.value,
                      }))}
                      placeholder="Email Address"
                      aria-label="Email Address"
                      className="h-11 w-full rounded-md border border-slate-400 px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                ) : selectedType === 'EVENT_REGISTRATION' ? (
                  previewStep === 1 ? (
                    <>
                      <h4 className="text-lg font-bold leading-6 text-slate-900">Join our next webinar!</h4>
                      <p className="mt-2 text-xs text-slate-700">First, we'll need a few details from you.</p>
                      <div className="mt-5 space-y-4">
                        <input
                          value={eventRegistration.firstName}
                          onChange={(event) => setEventRegistration((current) => ({
                            ...current,
                            firstName: event.target.value,
                          }))}
                          placeholder="First Name"
                          aria-label="First Name"
                          className="h-11 w-full rounded-md border border-slate-400 px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                        <input
                          value={eventRegistration.lastName}
                          onChange={(event) => setEventRegistration((current) => ({
                            ...current,
                            lastName: event.target.value,
                          }))}
                          placeholder="Last Name"
                          aria-label="Last Name"
                          className="h-11 w-full rounded-md border border-slate-400 px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                        <input
                          type="email"
                          value={eventRegistration.email}
                          onChange={(event) => setEventRegistration((current) => ({
                            ...current,
                            email: event.target.value,
                          }))}
                          placeholder="Email Address"
                          aria-label="Email Address"
                          className="h-11 w-full rounded-md border border-slate-400 px-3 text-xs text-slate-800 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <h4 className="text-lg font-bold leading-6 text-slate-900">Before you go</h4>
                      <p className="mt-2 text-xs text-slate-700">How did you hear about us?</p>
                      <p className="mt-5 text-xs text-slate-700">Choose one (optional)</p>
                      <div className="mt-3 space-y-1">
                        {EVENT_SOURCE_OPTIONS.map((source) => {
                          const isSelected = eventSource === source;
                          return (
                            <button
                              key={source}
                              type="button"
                              onClick={() => setEventSource(isSelected ? '' : source)}
                              className="flex w-full items-center justify-between gap-3 rounded px-0.5 py-2 text-left text-xs text-slate-800 hover:bg-slate-50"
                            >
                              <span>{source}</span>
                              <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                isSelected ? 'border-emerald-500' : 'border-slate-500'
                              }`}>
                                {isSelected ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )
                ) : (
                  <>
                    <h4 className="text-lg font-bold leading-6 text-slate-900">{previewQuestion.title}</h4>
                    <p className="mt-5 text-xs text-slate-700">{previewQuestion.description}</p>
                    <div className="mt-4 space-y-2">
                      {previewQuestion.answers.map((answer) => {
                        const isChecked = selectedAnswers.includes(answer);
                        return (
                          <button
                            key={answer}
                            type="button"
                            onClick={() => togglePreviewAnswer(answer)}
                            className="flex w-full items-center justify-between gap-3 rounded px-0.5 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-50"
                          >
                            <span>{answer}</span>
                            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center border ${
                              isChecked ? 'border-emerald-500 bg-emerald-500' : 'border-slate-500 bg-white'
                            }`}>
                              {isChecked ? <Check aria-hidden="true" className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="border-t border-slate-200 px-3 py-3">
                <button
                  type="button"
                  disabled={
                    selectedType === 'CUSTOM'
                      ? false
                      : selectedType === 'SIGN_UP'
                        ? !isEventRegistrationComplete
                        : selectedType === 'EVENT_REGISTRATION'
                          ? previewStep === 1 && !isEventRegistrationComplete
                          : selectedAnswers.length === 0
                  }
                  onClick={() => {
                    if (selectedType === 'EVENT_REGISTRATION') {
                      movePreview(previewStep === 1 ? 2 : 1);
                    } else if (selectedType !== 'SIGN_UP' && selectedType !== 'CUSTOM') {
                      movePreview(previewStep === 3 ? 1 : previewStep + 1);
                    }
                  }}
                  className="w-full rounded-full py-2 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 enabled:bg-emerald-500 enabled:text-white enabled:hover:bg-emerald-600"
                >
                  {selectedType === 'CUSTOM'
                    ? 'Continue'
                    : selectedType === 'SIGN_UP'
                      ? 'Done'
                      : selectedType === 'EVENT_REGISTRATION'
                        ? previewStep === 1 ? 'Continue' : 'Done'
                        : previewStep === 3 ? 'Hoàn tất' : 'Tiếp tục'}
                </button>
                <p className="mt-2 text-center text-[9px] text-slate-500">
                  Được quản lý bởi doanh nghiệp.{' '}
                  <a
                    href="https://faq.whatsapp.com/1137338520520761/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-600 hover:underline"
                  >
                    Tìm hiểu thêm
                  </a>
                </p>
              </div>
            </div>

            <div className="mt-8 flex gap-2">
              <button
                type="button"
                disabled={previewStep === 1}
                onClick={() => movePreview(previewStep - 1)}
                aria-label="Xem trước màn hình trước"
                className="rounded-md border border-slate-300 bg-white p-2.5 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
              >
                <ChevronLeft aria-hidden="true" className="h-5 w-5" />
              </button>
              <button
                type="button"
                disabled={previewStep === maxPreviewSteps}
                onClick={() => movePreview(previewStep + 1)}
                aria-label="Xem trước màn hình tiếp theo"
                className="rounded-md border border-slate-400 bg-white p-2.5 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-white"
              >
                <ChevronRight aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-300 px-3 py-3 sm:flex sm:justify-end sm:px-4 sm:py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-md border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={createFlow}
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 sm:w-auto"
          >
            Tạo
          </button>
        </footer>
      </div>
    </div>
  );
});

export default CreateFlowModal;
