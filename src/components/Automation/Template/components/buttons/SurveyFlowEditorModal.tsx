import {
  Check,
  ChevronDown,
  GripVertical,
  LoaderCircle,
  Moon,
  Plus,
  Settings,
  Smartphone,
  Sun,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../../../../../utils/apiClient';

interface SurveyScreen {
  title: string;
  heading: string;
  description: string;
  options: string[];
}

export interface CreatedSurveyFlow {
  id: string;
  name: string;
  status: string;
}

interface SurveyFlowEditorModalProps {
  onClose: () => void;
  onCreated: (flow: CreatedSurveyFlow) => void;
}

const INITIAL_SCREENS: [SurveyScreen, SurveyScreen, SurveyScreen] = [
  {
    title: 'Question 1 of 3',
    heading: "You've found the perfect deal, what do you do next?",
    description: 'Choose all that apply:',
    options: [
      'Buy it right away',
      'Check reviews before buying',
      'Share it with friends + family',
      'Buy multiple, while its cheap',
      'None of the above',
    ],
  },
  {
    title: 'Question 2 of 3',
    heading: 'What matters most when choosing a product?',
    description: 'Choose all that apply:',
    options: ['Price', 'Quality', 'Promotions', 'Customer support'],
  },
  {
    title: 'Question 3 of 3',
    heading: 'How would you like us to contact you?',
    description: 'Choose all that apply:',
    options: ['WhatsApp', 'Phone', 'Email'],
  },
];

export function SurveyFlowEditorModal({ onClose, onCreated }: SurveyFlowEditorModalProps) {
  const [flowName, setFlowName] = useState(`Customer survey ${new Date().toLocaleDateString('en-GB')}`);
  const [screens, setScreens] = useState<[SurveyScreen, SurveyScreen, SurveyScreen]>(INITIAL_SCREENS);
  const [selectedScreenIndex, setSelectedScreenIndex] = useState(0);
  const [previewSelections, setPreviewSelections] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [platform, setPlatform] = useState<'ANDROID' | 'IOS'>('ANDROID');
  const [theme, setTheme] = useState<'LIGHT' | 'DARK'>('LIGHT');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const selectedScreen = screens[selectedScreenIndex];
  const isDark = theme === 'DARK';

  const isValid = useMemo(() => (
    flowName.trim().length > 0
    && screens.every((screen) => (
      screen.title.trim()
      && screen.heading.trim()
      && screen.description.trim()
      && screen.options.length >= 2
      && screen.options.every((option) => option.trim())
    ))
  ), [flowName, screens]);

  const updateScreen = (patch: Partial<SurveyScreen>) => {
    setScreens((current) => current.map((screen, index) => (
      index === selectedScreenIndex ? { ...screen, ...patch } : screen
    )) as [SurveyScreen, SurveyScreen, SurveyScreen]);
  };

  const updateOption = (optionIndex: number, value: string) => {
    updateScreen({
      options: selectedScreen.options.map((option, index) => index === optionIndex ? value : option),
    });
  };

  const removeOption = (optionIndex: number) => {
    if (selectedScreen.options.length <= 2) return;
    updateScreen({ options: selectedScreen.options.filter((_, index) => index !== optionIndex) });
  };

  const saveFlow = async () => {
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const flow = await api.post<CreatedSurveyFlow>('/campaigns/templates/flows', {
        name: flowName.trim(),
        screens: screens.map((screen) => ({
          title: screen.title.trim(),
          heading: screen.heading.trim(),
          description: screen.description.trim(),
          options: screen.options.map((option) => option.trim()),
        })),
      });
      onCreated(flow);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không thể tạo Flow trên Meta.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 isolate flex items-center justify-center bg-slate-950/60 p-0 backdrop-blur-[1px] sm:p-4"
      style={{ zIndex: 9999 }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="survey-flow-editor-title"
        className="flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(770px,calc(100vh-2rem))] sm:max-w-275 sm:rounded-lg sm:border sm:border-slate-400"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-300 px-4 py-3">
          <h3 id="survey-flow-editor-title" className="text-base font-bold text-slate-800">Create flow</h3>
          <button type="button" onClick={onClose} aria-label="Đóng trình tạo Flow" className="rounded p-1 text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(175px,0.7fr)_minmax(275px,1.35fr)_minmax(270px,1fr)] md:overflow-hidden">
          <aside className="border-b border-slate-300 p-4 md:overflow-y-auto md:border-r md:border-b-0">
            <h4 className="mb-2 text-sm font-bold text-slate-800">Screens</h4>
            <div className="space-y-1">
              {screens.map((screen, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setSelectedScreenIndex(index);
                    setPreviewSelections([]);
                  }}
                  className={`flex w-full items-center gap-2 rounded px-2 py-2 text-left text-sm ${
                    selectedScreenIndex === index ? 'bg-sky-100 text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <GripVertical className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{screen.title}</span>
                  <X className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                </button>
              ))}
            </div>
            <button type="button" disabled className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sky-700 disabled:opacity-50" title="Flow khảo sát hiện dùng 3 màn hình">
              <Plus className="h-4 w-4" aria-hidden="true" /> Add new
            </button>
          </aside>

          <section className="border-b border-slate-300 p-4 md:overflow-y-auto md:border-r md:border-b-0">
            <h4 className="mb-3 text-sm font-bold text-slate-800">Edit content</h4>
            <label className="mb-3 block text-xs font-semibold text-slate-700">
              Flow name
              <input
                value={flowName}
                maxLength={200}
                onChange={(event) => setFlowName(event.target.value)}
                className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm font-normal outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </label>

            <div className="space-y-3">
              <div className="rounded-md bg-sky-50 p-2">
                <label className="block text-xs font-medium text-slate-700">
                  Screen title
                  <input
                    value={selectedScreen.title}
                    maxLength={30}
                    onChange={(event) => updateScreen({ title: event.target.value })}
                    className="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm outline-none focus:border-sky-500"
                  />
                </label>
              </div>
              <label className="block text-xs font-medium text-slate-700">
                Large heading
                <input
                  value={selectedScreen.heading}
                  maxLength={80}
                  onChange={(event) => updateScreen({ heading: event.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
                />
              </label>
              <label className="block text-xs font-medium text-slate-700">
                Multiple choice description
                <input
                  value={selectedScreen.description}
                  maxLength={300}
                  onChange={(event) => updateScreen({ description: event.target.value })}
                  className="mt-1 h-10 w-full rounded border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
                />
              </label>
              <div>
                <p className="text-xs font-medium text-slate-700">Options</p>
                <div className="mt-2 space-y-2">
                  {selectedScreen.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      <input
                        value={option}
                        maxLength={30}
                        onChange={(event) => updateOption(optionIndex, event.target.value)}
                        className="h-9 min-w-0 flex-1 rounded border border-slate-300 px-3 text-sm outline-none focus:border-sky-500"
                      />
                      <button type="button" onClick={() => removeOption(optionIndex)} disabled={selectedScreen.options.length <= 2} aria-label="Xóa lựa chọn" className="rounded p-1 text-slate-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30">
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={selectedScreen.options.length >= 20}
                  onClick={() => updateScreen({ options: [...selectedScreen.options, `Option ${selectedScreen.options.length + 1}`] })}
                  className="mt-3 inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add content
                </button>
              </div>
            </div>
          </section>

          <section className="relative flex min-h-150 flex-col bg-white p-4 md:min-h-0 md:overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-800">Preview</h4>
              <div className="relative">
                <button type="button" onClick={() => setIsSettingsOpen((current) => !current)} className="inline-flex items-center gap-2 rounded border border-slate-400 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100">
                  <Settings className="h-4 w-4" aria-hidden="true" /><ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {isSettingsOpen ? (
                  <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded border border-slate-300 bg-white p-2 text-sm shadow-xl">
                    <p className="px-2 py-1 font-bold text-slate-800">Platform</p>
                    {(['ANDROID', 'IOS'] as const).map((value) => (
                      <button key={value} type="button" onClick={() => setPlatform(value)} className="flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-slate-50">
                        <Smartphone className="h-4 w-4" /><span className="flex-1">{value === 'ANDROID' ? 'Android' : 'iOS'}</span>{platform === value ? <Check className="h-4 w-4" /> : null}
                      </button>
                    ))}
                    <div className="my-1 border-t border-slate-200" />
                    <p className="px-2 py-1 font-bold text-slate-800">Theme</p>
                    <button type="button" onClick={() => setTheme('LIGHT')} className="flex w-full items-center gap-2 rounded px-2 py-2 hover:bg-slate-50"><Sun className="h-4 w-4" /><span className="flex-1 text-left">Light</span>{theme === 'LIGHT' ? <Check className="h-4 w-4" /> : null}</button>
                    <button type="button" onClick={() => setTheme('DARK')} className="flex w-full items-center gap-2 rounded px-2 py-2 hover:bg-slate-50"><Moon className="h-4 w-4" /><span className="flex-1 text-left">Dark</span>{theme === 'DARK' ? <Check className="h-4 w-4" /> : null}</button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center py-4">
              <div className="w-full max-w-66 rounded-2xl border-8 border-slate-300 bg-slate-300 shadow-xl">
                <div className={`overflow-hidden rounded-lg ${isDark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
                  <div className={`flex items-center justify-between border-b px-3 py-3 text-xs ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <X className="h-4 w-4" /><span>{selectedScreen.title}</span><span />
                  </div>
                  <div className="min-h-86 p-3">
                    <h5 className="text-base font-bold leading-5">{selectedScreen.heading || 'Large heading'}</h5>
                    <p className={`mt-5 text-xs ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{selectedScreen.description}</p>
                    <div className="mt-3 space-y-1">
                      {selectedScreen.options.map((option) => {
                        const selected = previewSelections.includes(option);
                        return (
                          <button key={option} type="button" onClick={() => setPreviewSelections((current) => selected ? current.filter((item) => item !== option) : [...current, option])} className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-[11px]">
                            <span>{option}</span><span className={`flex h-3.5 w-3.5 items-center justify-center border ${selected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`}>{selected ? <Check className="h-3 w-3 text-white" /> : null}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`border-t p-3 ${isDark ? 'border-slate-700' : 'border-slate-200'}`}>
                    <div className={`rounded-full py-2 text-center text-xs font-semibold ${previewSelections.length ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{selectedScreenIndex === 2 ? 'Done' : 'Continue'}</div>
                    <p className="mt-2 text-center text-[8px] text-slate-400">Managed by the business. Learn more</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="border-t border-slate-200 pt-3 text-xs text-slate-600">Rendering and interaction varies based on device.</p>
          </section>
        </div>

        {saveError ? <p role="alert" className="shrink-0 border-t border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{saveError}</p> : null}
        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-700">Flow được tạo ở trạng thái Draft và vẫn có thể chỉnh sửa trong Meta Flow Manager.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} disabled={isSaving} className="rounded border border-slate-400 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button>
            <button type="button" onClick={() => void saveFlow()} disabled={!isValid || isSaving} className="inline-flex min-w-18 items-center justify-center gap-2 rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50">
              {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
