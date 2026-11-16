import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileText,
  FlaskConical,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AiManagementPanel } from '../UserManagement/AiManagementPanel';
import { useAuth } from '../../contexts/AuthContext';
import { Permission } from '../../lib/permissions';
import { api, ApiError } from '../../utils/apiClient';
import { useAutoTranslateSetting } from '../../features/messages/hooks/useAutoTranslateSetting';
import { useAiProfile, type AiProfile } from '../../features/messages/hooks/useAiProfile';
import { queryKeys } from '../../lib/queryClient';
import { inspectSuggestionResponse } from './suggestionDiagnostics';
import { knowledgeFileAccept, readKnowledgeFile } from './knowledgeFile';
import { KnowledgeLibrary, type KnowledgeDocument } from './KnowledgeLibrary';
import { KnowledgeRetrievalSettings } from './KnowledgeRetrievalSettings';
import type { RetrievalSettings } from '../../../shared/knowledgeRetrievalSettings';
import { KnowledgeDocumentEditor, type KnowledgeDraft } from './KnowledgeDocumentEditor';
import { defaultChunkSettings } from '../../../shared/knowledgeChunking';
import {
  assistantConfigurationFields,
  ragConfigurationFields,
  mergeConfigurationDraft,
  pickConfigurationScope,
  type ConfigurationScope,
} from '../../../shared/aiConfigurationScopes';

interface Configuration {
  model: string;
  embeddingModel: string;
  embeddingDimensions: number;
  reindexing?: boolean;
  retrievalSettings: RetrievalSettings;
  suggestionsEnabled: boolean;
  autoReplyEnabled: boolean;
  ragEnabled: boolean;
  timeoutMs: number;
  instructions: string;
  updatedAt: string;
}
interface KnowledgeSource {
  id: string;
  documentId: string;
  title: string;
  brand: string;
  content: string;
  score: number;
}
interface AiRun {
  id: string;
  requestId?: string;
  operation: string;
  status: string;
  stage: string;
  model: string;
  brand: string;
  durationMs: number;
  errorCode?: string;
  errorMessage?: string;
  rawOutput?: string;
  output?: unknown;
  sources?: unknown;
  createdAt: string;
}
interface TestResult {
  response: unknown;
  suggestions: string[];
  valid: boolean;
  issues: string[];
  model?: string;
  runId?: string;
  durationMs?: number;
  sources: KnowledgeSource[];
  answer?: string;
  shouldAutoReply?: boolean;
  reason?: string;
}
const CONFIG_KEY = ['ai', 'configuration'];
const KNOWLEDGE_KEY = ['ai', 'knowledge'];
const RUNS_KEY = ['ai', 'runs'];
const inputStyle =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-500';
const secondaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-not-allowed disabled:opacity-50';
const primaryButton =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const cardStyle = 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5';
const blankDocument: KnowledgeDraft = {
  title: '',
  content: '',
  enabled: true,
  chunkSettings: { ...defaultChunkSettings },
};
const tabs = [
  { id: 'assistant', label: 'Trợ lý AI', icon: Bot },
  { id: 'rag', label: 'RAG', icon: Settings2 },
  { id: 'test', label: 'Thử AI', icon: FlaskConical },
  { id: 'knowledge', label: 'Kho kiến thức', icon: BookOpen },
  { id: 'runs', label: 'Nhật ký', icon: Activity },
] as const;
type Tab = (typeof tabs)[number]['id'];
const dateLabel = (value: string) => new Date(value).toLocaleString('vi-VN');
const messageOf = (error: unknown) =>
  error instanceof Error ? error.message : 'Không xử lý được yêu cầu. Vui lòng thử lại.';

function SettingSwitch({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium text-slate-900">{title}</p>
        {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-emerald-600' : 'bg-slate-200'}`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
}

function Sources({ sources }: { sources: KnowledgeSource[] }) {
  if (!sources.length)
    return (
      <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
        Không có tài liệu phù hợp.
      </p>
    );
  return (
    <div className="space-y-2">
      {sources.map((source) => (
        <details key={source.id} className="group rounded-xl border border-slate-200 bg-white p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-slate-800">
            <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate">{source.title}</span>
            <ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180" />
          </summary>
          <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-600">
            {source.content}
          </p>
        </details>
      ))}
    </div>
  );
}

export const AiManagementView: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const canManage = hasPermission(Permission.AI_MANAGE);
  const { isAutoTranslateEnabled, setAutoTranslate } = useAutoTranslateSetting();
  const profileQuery = useAiProfile();
  const [profileDraft, setProfileDraft] = useState<AiProfile | null>(null);
  const [avatarData, setAvatarData] = useState<string | null | undefined>(undefined);
  const [profileBusy, setProfileBusy] = useState(false);
  const [autoTranslateDraft, setAutoTranslateDraft] = useState<boolean | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab =
    tabs.find((item) => item.id === searchParams.get('tab') && (item.id !== 'runs' || canManage))
      ?.id || 'assistant';
  const setTab = (nextTab: Tab) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set('tab', nextTab);
        return next;
      },
      { replace: true },
    );
  };
  const [draft, setDraft] = useState<Configuration | null>(null);
  const [assistantDirty, setAssistantDirty] = useState(false);
  const [ragDirty, setRagDirty] = useState(false);
  const activeDirty = tab === 'rag' ? ragDirty : assistantDirty;
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const configuration = useQuery({
    queryKey: CONFIG_KEY,
    queryFn: () => api.get<Configuration>('/ai/configuration'),
  });
  const models = useQuery({
    queryKey: ['ai', 'models'],
    queryFn: () =>
      api.get<{
        connected: boolean;
        models: string[];
        embeddingModels: string[];
        error: string | null;
      }>('/ai/models'),
    staleTime: 60000,
    refetchOnWindowFocus: false,
  });
  const knowledge = useQuery({
    queryKey: KNOWLEDGE_KEY,
    queryFn: () => api.get<KnowledgeDocument[]>('/ai/knowledge'),
    refetchInterval: (query) =>
      query.state.data?.some((doc) => ['pending', 'indexing'].includes(doc.embeddingStatus || ''))
        ? 5000
        : false,
  });
  const runs = useQuery({
    queryKey: RUNS_KEY,
    queryFn: () => api.get<AiRun[]>('/ai/runs'),
    enabled: tab === 'runs' && canManage,
    refetchOnWindowFocus: false,
  });
  useEffect(() => {
    const saved = configuration.data;
    if (saved) {
      setDraft((previous) =>
        mergeConfigurationDraft(saved, previous, { assistant: assistantDirty, rag: ragDirty }),
      );
    }
  }, [configuration.data, assistantDirty, ragDirty]);
  useEffect(() => {
    const update = () => {
      void queryClient.invalidateQueries({ queryKey: CONFIG_KEY });
    };
    window.addEventListener('ai:status_change', update);
    return () => window.removeEventListener('ai:status_change', update);
  }, [queryClient]);

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [documentDraft, setDocumentDraft] = useState(blankDocument);
  const [isDocumentOpen, setIsDocumentOpen] = useState(false);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [question, setQuestion] = useState('');
  const [brand, setBrand] = useState('');
  const [testPending, setTestPending] = useState(false);
  const [testError, setTestError] = useState<{
    message: string;
    details?: unknown;
    requestId?: string;
  } | null>(null);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [retrieved, setRetrieved] = useState<KnowledgeSource[] | null>(null);
  const testController = useRef<AbortController | null>(null);
  useEffect(() => () => testController.current?.abort(), []);

  const updateDraft = (updates: Partial<Configuration>) => {
    setDraft((previous) => (previous ? { ...previous, ...updates } : previous));
    if (assistantConfigurationFields.some((field) => field in updates)) setAssistantDirty(true);
    if (ragConfigurationFields.some((field) => field in updates)) setRagDirty(true);
    setNotice('');
  };
  const saveConfiguration = async (event: React.FormEvent, scope: ConfigurationScope) => {
    event.preventDefault();
    if (!draft || !canManage || isSaving || (scope === 'assistant' && profileBusy)) return;
    setIsSaving(true);
    setError('');
    setNotice('');
    try {
      const saveProfile =
        scope === 'assistant' && (profileDraft !== null || avatarData !== undefined);
      let aiProfile = saveProfile ? profileDraft || profileQuery.data : undefined;
      if (saveProfile && !aiProfile)
        throw new Error('Chưa tải được hồ sơ trợ lý. Vui lòng thử lại.');
      if (aiProfile && avatarData !== undefined) {
        let avatarUrl: string | null = null;
        if (avatarData) {
          const upload = await api.post<{ url: string }>('/upload', {
            imageBase64: avatarData,
            folder: 'ai',
            customFilename: `ai-avatar-${Date.now()}`,
          });
          avatarUrl = upload.url;
        }
        aiProfile = { ...aiProfile, avatarUrl };
      }
      const saved = await api.put<Configuration & { aiProfile?: AiProfile }>(
        `/ai/configuration/${scope}`,
        {
          ...pickConfigurationScope(draft, scope),
          aiProfile,
        },
      );
      const { aiProfile: savedProfile, ...savedConfiguration } = saved;
      queryClient.setQueryData(CONFIG_KEY, savedConfiguration);
      if (savedProfile) queryClient.setQueryData(queryKeys.aiProfile, savedProfile);
      if (scope === 'assistant') {
        if (autoTranslateDraft !== null) setAutoTranslate(autoTranslateDraft);
        setProfileDraft(null);
        setAvatarData(undefined);
        setAutoTranslateDraft(null);
        setAssistantDirty(false);
      } else setRagDirty(false);
      setDraft((previous) =>
        mergeConfigurationDraft(savedConfiguration, previous, {
          assistant: scope !== 'assistant' && assistantDirty,
          rag: scope !== 'rag' && ragDirty,
        }),
      );
      setNotice(saved.reindexing ? 'Đã lưu. Đang lập lại chỉ mục.' : 'Đã lưu.');
      if (saved.reindexing) await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    } catch (saveError) {
      setError(messageOf(saveError));
    } finally {
      setIsSaving(false);
    }
  };
  const openDocument = (doc?: KnowledgeDocument) => {
    setDeleteId(null);
    setDocumentId(doc?.id || null);
    setDocumentDraft(
      doc
        ? {
            title: doc.title,
            content: doc.content,
            enabled: doc.enabled,
            chunkSettings: {
              ...defaultChunkSettings,
              ...doc.chunkSettings,
            },
          }
        : { ...blankDocument },
    );
    setDocumentError('');
    setIsDocumentOpen(true);
  };
  const importDocumentFile = async (file: File) => {
    if (!canManage || documentBusy) return;
    setError('');
    setDocumentBusy(true);
    try {
      const content = await readKnowledgeFile(file);
      if (content.trim().length < 10) {
        setError('Tài liệu cần có ít nhất 10 ký tự nội dung.');
        return;
      }
      const title = file.name.replace(/\.(txt|md|docx)$/i, '').slice(0, 160);
      setDocumentId(null);
      setDocumentDraft({ ...blankDocument, title, content });
      setDocumentError('');
      setIsDocumentOpen(true);
    } catch (fileError) {
      setError(messageOf(fileError));
    } finally {
      setDocumentBusy(false);
    }
  };
  const saveDocument = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage || documentBusy) return;
    setDocumentBusy(true);
    setDocumentError('');
    try {
      if (documentId)
        await api.put(`/ai/knowledge/${encodeURIComponent(documentId)}`, documentDraft);
      else await api.post('/ai/knowledge', documentDraft);
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
      setIsDocumentOpen(false);
      setNotice('Đã lưu tài liệu. Đang lập chỉ mục ở nền.');
    } catch (saveError) {
      setDocumentError(messageOf(saveError));
    } finally {
      setDocumentBusy(false);
    }
  };
  const deleteDocument = async (id: string) => {
    if (!canManage || documentBusy) return;
    setDocumentBusy(true);
    setError('');
    try {
      await api.delete(`/ai/knowledge/${encodeURIComponent(id)}`);
      setDeleteId(null);
      setNotice('Đã xóa tài liệu.');
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    } catch (deleteError) {
      setError(messageOf(deleteError));
    } finally {
      setDocumentBusy(false);
    }
  };
  const reindexDocument = async (id: string) => {
    if (!canManage || documentBusy) return;
    setDocumentBusy(true);
    setError('');
    try {
      await api.post(`/ai/knowledge/${encodeURIComponent(id)}/reindex`);
      setNotice('Đang lập chỉ mục embedding.');
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    } catch (indexError) {
      setError(messageOf(indexError));
    } finally {
      setDocumentBusy(false);
    }
  };
  const toggleDocument = async (doc: KnowledgeDocument) => {
    if (!canManage || documentBusy) return;
    setDocumentBusy(true);
    setError('');
    try {
      await api.patch(`/ai/knowledge/${encodeURIComponent(doc.id)}/enabled`, {
        enabled: !doc.enabled,
      });
      await queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEY });
    } catch (toggleError) {
      setError(messageOf(toggleError));
    } finally {
      setDocumentBusy(false);
    }
  };
  const testAi = async (retrieveOnly = false) => {
    if (!question.trim() || testPending || (!retrieveOnly && !canManage)) return;
    const controller = new AbortController();
    testController.current = controller;
    setTestPending(true);
    setTestError(null);
    setTestResult(null);
    setRetrieved(null);
    try {
      if (retrieveOnly) {
        const data = await api.post<{ sources: KnowledgeSource[] }>(
          '/ai/retrieve',
          { question: question.trim() },
          { signal: controller.signal },
        );
        if (!controller.signal.aborted) setRetrieved(data.sources);
      } else {
        const data = await api.post<Record<string, any>>(
          '/ai/test',
          {
            brandName: brand.trim() || undefined,
            messages: [{ sender: 'customer', content: question.trim() }],
          },
          { signal: controller.signal },
        );
        const inspected = inspectSuggestionResponse(data);
        if (!controller.signal.aborted)
          setTestResult({
            response: data,
            ...inspected,
            model: data.model,
            runId: data.runId,
            durationMs: data.durationMs,
            sources: data.sources || [],
            answer: data.answer,
            shouldAutoReply: data.shouldAutoReply,
            reason: data.reason,
          });
      }
    } catch (requestError) {
      if (!controller.signal.aborted)
        setTestError({
          message: messageOf(requestError),
          ...(requestError instanceof ApiError
            ? { details: requestError.details, requestId: requestError.requestId }
            : {}),
        });
    } finally {
      if (!controller.signal.aborted) setTestPending(false);
      if (testController.current === controller) testController.current = null;
      void queryClient.invalidateQueries({ queryKey: RUNS_KEY });
    }
  };
  const installedModels = models.data?.models || [];
  const modelOptions = [...new Set([draft?.model || '', ...installedModels])].filter(Boolean);
  const embeddingModels = models.data?.embeddingModels || [];
  const embeddingModelOptions = [
    ...new Set([draft?.embeddingModel || '', ...embeddingModels]),
  ].filter(Boolean);

  return (
    <div className="space-y-4 pb-6">
      <nav
        aria-label="Quản lý AI"
        className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1"
      >
        {tabs
          .filter((item) => item.id !== 'runs' || canManage)
          .map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id);
                setError('');
                setNotice('');
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${tab === id ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:bg-white/60 hover:text-slate-900'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
              {((id === 'assistant' && assistantDirty) || (id === 'rag' && ragDirty)) && (
                <span
                  title="Có thay đổi chưa lưu"
                  className="h-1.5 w-1.5 rounded-full bg-amber-500"
                >
                  <span className="sr-only">Chưa lưu</span>
                </span>
              )}
            </button>
          ))}
      </nav>
      {error && (
        <div role="alert" className="flex gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="flex gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      )}
      {!canManage && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-xs text-slate-600">
          Chỉ xem · Cần quyền quản lý AI để chỉnh sửa.
        </p>
      )}

      {(tab === 'assistant' || tab === 'rag') && (
        <div className="w-full rounded-2xl border border-slate-200 bg-white">
          {configuration.isPending ? (
            <p role="status" className="flex items-center gap-2 px-6 py-12 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang tải cấu hình…
            </p>
          ) : configuration.isError ? (
            <div role="alert" className="m-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
              {messageOf(configuration.error)}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => void configuration.refetch()}
              >
                Thử lại
              </button>
            </div>
          ) : (
            draft && (
              <>
                <form
                  id="ai-configuration-form"
                  onSubmit={(event) =>
                    void saveConfiguration(event, tab === 'rag' ? 'rag' : 'assistant')
                  }
                />
                <div className="divide-y divide-slate-100">
                  {tab === 'assistant' ? (
                    <>
                      <div className="px-5 py-6 sm:px-6">
                        <AiManagementPanel
                          embedded
                          profile={profileDraft || profileQuery.data}
                          avatarPreview={avatarData}
                          disabled={!canManage || isSaving}
                          loading={profileQuery.isPending}
                          error={profileQuery.isError ? messageOf(profileQuery.error) : undefined}
                          onRetry={() => void profileQuery.refetch()}
                          onChange={(profile) => {
                            setProfileDraft(profile);
                            setAssistantDirty(true);
                            setNotice('');
                          }}
                          onAvatarChange={(image) => {
                            setAvatarData(image);
                            setAssistantDirty(true);
                            setNotice('');
                          }}
                          onBusyChange={setProfileBusy}
                        />
                      </div>
                      <section
                        aria-labelledby="ai-models-heading"
                        className="grid gap-5 px-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] sm:px-6"
                      >
                        <h2
                          id="ai-models-heading"
                          className="pt-1 text-xs font-semibold text-slate-700"
                        >
                          Model AI
                        </h2>
                        <div className="min-w-0">
                          <div className="min-w-0">
                            <label
                              className="block text-xs font-semibold text-slate-600"
                              htmlFor="ai-model"
                            >
                              Model trả lời
                            </label>
                            <select
                              id="ai-model"
                              form="ai-configuration-form"
                              className={`${inputStyle} mt-2`}
                              value={draft.model}
                              disabled={!canManage || isSaving}
                              onChange={(event) => updateDraft({ model: event.target.value })}
                            >
                              {modelOptions.map((model) => (
                                <option key={model}>{model}</option>
                              ))}
                            </select>
                            {models.data?.connected && !installedModels.includes(draft.model) && (
                              <p className="mt-1 text-xs text-amber-700">
                                Model chưa được cài đặt.
                              </p>
                            )}
                          </div>
                          {!models.isFetching && !models.data?.connected && (
                            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                              {models.data?.error || 'Chưa kiểm tra được kết nối.'}
                            </p>
                          )}
                        </div>
                      </section>
                      <section
                        aria-labelledby="ai-automation-heading"
                        className="grid gap-5 px-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] sm:px-6"
                      >
                        <h2
                          id="ai-automation-heading"
                          className="pt-1 text-xs font-semibold text-slate-700"
                        >
                          Tự động hóa
                        </h2>
                        <div className="min-w-0 -my-3">
                          <div className="divide-y divide-slate-100">
                            <SettingSwitch
                              title="Gợi ý tin nhắn"
                              checked={draft.suggestionsEnabled}
                              disabled={!canManage || isSaving}
                              onChange={() =>
                                updateDraft({ suggestionsEnabled: !draft.suggestionsEnabled })
                              }
                            />

                            <SettingSwitch
                              title="Tự động trả lời"
                              checked={draft.autoReplyEnabled}
                              disabled={!canManage || isSaving || !configuration.data?.ragEnabled}
                              onChange={() =>
                                updateDraft({ autoReplyEnabled: !draft.autoReplyEnabled })
                              }
                            />
                            {!configuration.data?.ragEnabled && (
                              <p className="pb-3 text-xs text-amber-700">
                                Bật và lưu RAG để sử dụng tự động trả lời.
                                <button
                                  type="button"
                                  className="ml-2 underline"
                                  onClick={() => setTab('rag')}
                                >
                                  Mở RAG
                                </button>
                              </p>
                            )}
                            <SettingSwitch
                              title="Dịch sang tiếng Việt"
                              checked={autoTranslateDraft ?? isAutoTranslateEnabled}
                              disabled={!canManage || isSaving}
                              onChange={() => {
                                setAutoTranslateDraft(
                                  !(autoTranslateDraft ?? isAutoTranslateEnabled),
                                );
                                setAssistantDirty(true);
                                setNotice('');
                              }}
                            />
                          </div>
                        </div>
                      </section>{' '}
                      <section
                        aria-labelledby="ai-guidance-heading"
                        className="grid gap-5 px-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] sm:px-6"
                      >
                        <h2
                          id="ai-guidance-heading"
                          className="pt-1 text-xs font-semibold text-slate-700"
                        >
                          Hướng dẫn tư vấn
                        </h2>
                        <div className="min-w-0">
                          <textarea
                            id="ai-instructions"
                            aria-label="Hướng dẫn tư vấn"
                            form="ai-configuration-form"
                            rows={5}
                            maxLength={6000}
                            value={draft.instructions}
                            disabled={!canManage || isSaving}
                            onChange={(event) => updateDraft({ instructions: event.target.value })}
                            className={`${inputStyle} resize-y leading-6`}
                            placeholder="Ví dụ: Xưng em, gọi khách là anh/chị. Trả lời ngắn gọn và hỏi lại khi thiếu thông tin…"
                          />
                          <p className="mt-1 text-right text-[11px] text-slate-400">
                            {draft.instructions.length.toLocaleString('vi-VN')} / 6.000 ký tự
                          </p>
                        </div>
                      </section>
                      <section className="grid gap-5 px-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] sm:px-6">
                        <label
                          className="pt-1 text-xs font-semibold text-slate-700"
                          htmlFor="ai-timeout"
                        >
                          Thời gian chờ phản hồi
                        </label>
                        <div className="flex items-center gap-2">
                          <div className="w-24 shrink-0">
                            <input
                              id="ai-timeout"
                              form="ai-configuration-form"
                              type="number"
                              min={5}
                              max={120}
                              required
                              value={draft.timeoutMs / 1000}
                              disabled={!canManage || isSaving}
                              onChange={(event) =>
                                updateDraft({ timeoutMs: Number(event.target.value) * 1000 })
                              }
                              className={inputStyle}
                            />
                          </div>
                          <span className="text-xs text-slate-400">giây</span>
                        </div>
                      </section>
                    </>
                  ) : (
                    <>
                      <section
                        aria-labelledby="rag-model-heading"
                        className="grid gap-5 px-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] sm:px-6"
                      >
                        <h2
                          id="rag-model-heading"
                          className="pt-1 text-xs font-semibold text-slate-700"
                        >
                          Model embedding
                        </h2>
                        <div className="min-w-0">
                          <div className="min-w-0">
                            <label
                              className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600"
                              htmlFor="ai-embedding-model"
                            >
                              Model embedding
                              {draft.embeddingModel === configuration.data?.embeddingModel && (
                                <span className="font-normal text-slate-400">
                                  {draft.embeddingDimensions} chiều
                                </span>
                              )}
                            </label>
                            <select
                              id="ai-embedding-model"
                              form="ai-configuration-form"
                              className={`${inputStyle} mt-2`}
                              value={draft.embeddingModel}
                              disabled={!canManage || isSaving}
                              onChange={(event) =>
                                updateDraft({ embeddingModel: event.target.value })
                              }
                            >
                              {embeddingModelOptions.map((model) => (
                                <option key={model}>{model}</option>
                              ))}
                            </select>
                            {draft.embeddingModel !== configuration.data?.embeddingModel ? (
                              <p className="mt-1 text-xs text-amber-700">
                                Đổi model sẽ lập lại chỉ mục.
                              </p>
                            ) : (
                              models.data?.connected &&
                              !embeddingModels.includes(draft.embeddingModel) && (
                                <p className="mt-1 text-xs text-amber-700">
                                  Model embedding chưa được cài đặt.
                                </p>
                              )
                            )}
                          </div>
                          {!models.isFetching && !models.data?.connected && (
                            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                              {models.data?.error || 'Chưa kiểm tra được kết nối.'}
                            </p>
                          )}
                        </div>
                      </section>
                      <section className="grid gap-5 px-5 py-6 lg:grid-cols-[160px_minmax(0,1fr)] sm:px-6">
                        <label
                          htmlFor="ai-rerank-model"
                          className="pt-1 text-xs font-semibold text-slate-700"
                        >
                          Model rerank
                        </label>
                        <div className="min-w-0">
                          <select
                            id="ai-rerank-model"
                            form="ai-configuration-form"
                            value={draft.retrievalSettings.rerankModel}
                            disabled={!canManage || isSaving}
                            onChange={(event) =>
                              updateDraft({
                                retrievalSettings: {
                                  ...draft.retrievalSettings,
                                  rerankModel: event.target.value,
                                },
                              })
                            }
                            className={inputStyle}
                          >
                            {[
                              ...new Set([draft.retrievalSettings.rerankModel, ...installedModels]),
                            ].map((model) => (
                              <option key={model}>{model}</option>
                            ))}
                          </select>
                          {models.data?.connected &&
                            !installedModels.includes(draft.retrievalSettings.rerankModel) && (
                              <p className="mt-1 text-xs text-amber-700">
                                Model chưa được cài trên Ollama.
                              </p>
                            )}
                        </div>
                      </section>
                      <div className="px-5 py-6 sm:px-6">
                        <KnowledgeRetrievalSettings
                          settings={draft.retrievalSettings}
                          disabled={!canManage || isSaving}
                          onChange={(retrievalSettings) => updateDraft({ retrievalSettings })}
                          formId="ai-configuration-form"
                          idPrefix="configuration-retrieval"
                          showModelSelector={false}
                          wide
                        />
                      </div>
                    </>
                  )}
                </div>
              </>
            )
          )}
          {canManage && draft && !configuration.isError && (
            <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur-sm">
              {activeDirty && (
                <p role="status" className="mr-auto text-xs text-amber-700">
                  Có thay đổi chưa lưu.
                </p>
              )}
              <button
                form="ai-configuration-form"
                type="submit"
                className={primaryButton}
                disabled={!activeDirty || isSaving || (tab === 'assistant' && profileBusy)}
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Lưu thay đổi
              </button>
            </div>
          )}
        </div>
      )}

      {tab === 'test' && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <section className={cardStyle}>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void testAi();
              }}
              className="space-y-4"
            >
              <label htmlFor="ai-test-brand" className="block text-xs font-semibold text-slate-600">
                Thương hiệu
                <input
                  id="ai-test-brand"
                  value={brand}
                  maxLength={120}
                  disabled={testPending}
                  onChange={(event) => setBrand(event.target.value)}
                  placeholder="Ví dụ: Actiscar"
                  className={`${inputStyle} mt-2`}
                />
              </label>
              <label
                htmlFor="ai-test-question"
                className="block text-xs font-semibold text-slate-600"
              >
                Tin nhắn của khách
                <textarea
                  id="ai-test-question"
                  value={question}
                  maxLength={2000}
                  required
                  rows={7}
                  disabled={testPending}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder="Nhập tình huống muốn kiểm tra…"
                  className={`${inputStyle} mt-2 resize-y`}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                {canManage && (
                  <button
                    type="submit"
                    className={primaryButton}
                    disabled={testPending || !question.trim()}
                  >
                    {testPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Tạo gợi ý
                  </button>
                )}
                <button
                  type="button"
                  className={secondaryButton}
                  disabled={testPending || !question.trim()}
                  onClick={() => void testAi(true)}
                >
                  <BookOpen className="h-4 w-4" />
                  Tìm tài liệu
                </button>
              </div>
            </form>
          </section>
          <section className={cardStyle} aria-live="polite">
            <h2 className="font-bold text-slate-950">Kết quả</h2>
            {testPending ? (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-sm text-slate-500">
                <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                <p>Đang xử lý…</p>
              </div>
            ) : testError ? (
              <div role="alert" className="mt-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">
                <p className="font-semibold">{testError.message}</p>
                {testError.requestId && (
                  <p className="mt-2 break-all text-xs">Request: {testError.requestId}</p>
                )}
                {testError.details != null && (
                  <details className="mt-3 text-xs">
                    <summary className="cursor-pointer font-medium">Chi tiết lỗi</summary>
                    <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-all">
                      {JSON.stringify(testError.details, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ) : testResult ? (
              <div className="mt-4 space-y-5">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-lg px-2.5 py-1 ${testResult.valid ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}
                  >
                    {testResult.valid ? 'Output hợp lệ' : 'Output không hợp lệ'}
                  </span>
                  {testResult.model && (
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">
                      {testResult.model}
                    </span>
                  )}
                  {typeof testResult.durationMs === 'number' && (
                    <span className="flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600">
                      <Clock3 className="h-3 w-3" />
                      {(testResult.durationMs / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {testResult.issues.length > 0 && (
                  <p className="text-xs text-rose-700">{testResult.issues.join('; ')}</p>
                )}
                <div className="space-y-2">
                  {testResult.suggestions.map((suggestion, index) => (
                    <div key={index} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-xs font-semibold text-emerald-700">
                        {index + 1}
                      </span>
                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                        {suggestion}
                      </p>
                    </div>
                  ))}
                </div>
                <div
                  className={`rounded-xl p-3 text-xs leading-5 ${testResult.shouldAutoReply ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}
                >
                  <p className="font-semibold">
                    {testResult.shouldAutoReply
                      ? 'Đủ điều kiện tự động trả lời'
                      : 'Cần nhân viên duyệt'}
                  </p>
                  <p className="mt-1">{testResult.reason}</p>
                </div>
                <div>
                  <h3 className="mb-2 text-xs font-semibold text-slate-600">Nguồn tham khảo</h3>
                  <Sources sources={testResult.sources} />
                </div>
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer font-medium">Chi tiết JSON</summary>
                  <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">
                    {JSON.stringify(testResult.response, null, 2)}
                  </pre>
                </details>
              </div>
            ) : retrieved !== null ? (
              <div className="mt-4">
                <p className="mb-3 text-xs text-slate-500">{retrieved.length} đoạn phù hợp</p>
                <Sources sources={retrieved} />
              </div>
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-3 text-center text-slate-400">
                <FlaskConical className="h-9 w-9" />
                <p className="max-w-xs text-sm leading-6">Kết quả sẽ hiển thị ở đây.</p>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'knowledge' && (
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={knowledgeFileAccept}
            aria-label="Chọn file tài liệu kiến thức"
            className="hidden"
            disabled={!canManage || documentBusy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void importDocumentFile(file);
            }}
          />
          {isDocumentOpen ? (
            <KnowledgeDocumentEditor
              key={documentId || 'new'}
              draft={documentDraft}
              onChange={setDocumentDraft}
              onSave={(event) => void saveDocument(event)}
              onClose={() => setIsDocumentOpen(false)}
              busy={documentBusy}
              error={documentError}
              editing={!!documentId}
            />
          ) : (
            <KnowledgeLibrary
              documents={knowledge.data || []}
              loading={knowledge.isPending}
              error={knowledge.isError ? messageOf(knowledge.error) : undefined}
              onRetry={() => void knowledge.refetch()}
              busy={documentBusy}
              canManage={canManage}
              deleteId={deleteId}
              onUpload={() => fileRef.current?.click()}
              onEdit={openDocument}
              onReindex={(id) => void reindexDocument(id)}
              onToggle={(doc) => void toggleDocument(doc)}
              onRequestDelete={setDeleteId}
              onCancelDelete={() => setDeleteId(null)}
              onDelete={(id) => void deleteDocument(id)}
            />
          )}
        </div>
      )}

      {tab === 'runs' && canManage && (
        <section className={cardStyle}>
          <div className="flex items-start justify-between gap-4">
            <p className="text-xs leading-5 text-slate-500">50 lần chạy gần nhất</p>
            <button
              type="button"
              className={secondaryButton}
              disabled={runs.isFetching}
              onClick={() => void runs.refetch()}
            >
              <RefreshCw className={`h-4 w-4 ${runs.isFetching ? 'animate-spin' : ''}`} />
              Làm mới
            </button>
          </div>
          {runs.isPending ? (
            <p className="py-12 text-center text-sm text-slate-500">Đang tải nhật ký…</p>
          ) : runs.isError ? (
            <p role="alert" className="py-8 text-sm text-rose-700">
              {messageOf(runs.error)}
            </p>
          ) : !runs.data?.length ? (
            <div className="py-14 text-center">
              <Activity className="mx-auto h-9 w-9 text-slate-300" />
              <p className="mt-3 text-sm text-slate-500">Chưa có lần chạy.</p>
              <button
                type="button"
                onClick={() => setTab('test')}
                className={`${secondaryButton} mt-4`}
              >
                Thử AI
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {runs.data.map((run) => (
                <details
                  key={run.id}
                  className="group rounded-xl border border-slate-200 p-3 sm:p-4"
                >
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3">
                    <span
                      className={`rounded-lg px-2 py-1 text-xs font-semibold ${run.status === 'error' ? 'bg-rose-50 text-rose-700' : run.status === 'blocked' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-700'}`}
                    >
                      {run.status === 'error'
                        ? 'Lỗi'
                        : run.status === 'blocked'
                          ? 'Không gửi'
                          : 'Hoàn tất'}
                    </span>
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">
                      {run.operation === 'test'
                        ? 'Thử AI'
                        : run.operation === 'reply'
                          ? 'Tự động trả lời'
                          : 'Gợi ý'}
                      <span className="ml-2 text-xs font-normal text-slate-500">{run.brand}</span>
                    </span>
                    <span className="text-xs text-slate-500">
                      {(run.durationMs / 1000).toFixed(1)}s · {dateLabel(run.createdAt)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" />
                  </summary>
                  <div className="mt-4 space-y-3 text-xs text-slate-600">
                    <p className="break-all">
                      Lần chạy: {run.id}
                      {run.requestId && ` · Request: ${run.requestId}`}
                    </p>
                    <p>
                      Model: {run.model} · Bước: {run.stage}
                    </p>
                    {run.errorMessage && (
                      <p className="rounded-lg bg-rose-50 p-3 text-rose-700">
                        {run.errorCode}: {run.errorMessage}
                      </p>
                    )}
                    <details>
                      <summary className="cursor-pointer font-medium">Output đã kiểm tra</summary>
                      <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-slate-950 p-3 text-slate-100">
                        {JSON.stringify(run.output || {}, null, 2)}
                      </pre>
                    </details>
                    <details>
                      <summary className="cursor-pointer font-medium">Output gốc từ model</summary>
                      <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-slate-100">
                        {run.rawOutput || 'Chưa có output.'}
                      </pre>
                    </details>
                    <details>
                      <summary className="cursor-pointer font-medium">Nguồn kiến thức</summary>
                      <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-slate-50 p-3">
                        {JSON.stringify(run.sources || [], null, 2)}
                      </pre>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
