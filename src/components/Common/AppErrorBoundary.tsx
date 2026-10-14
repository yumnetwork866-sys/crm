import { Component, type ErrorInfo, type MouseEvent, type ReactNode } from 'react';
import { Copy, Check } from 'lucide-react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
  copied: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null, copied: false };
  private copyTimeout: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[APP RENDER ERROR]', error, info.componentStack);
  }

  override componentWillUnmount() {
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
  }

  private handleCopy = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!this.state.error) return;
    const text = `${this.state.error.name ? `[${this.state.error.name}] ` : ''}${this.state.error.message}\n\nStack:\n${this.state.error.stack || ''}`;
    void navigator.clipboard.writeText(text);
    this.setState({ copied: true });
    if (this.copyTimeout) clearTimeout(this.copyTimeout);
    this.copyTimeout = setTimeout(() => {
      this.setState({ copied: false });
    }, 2000);
  };

  override render() {
    if (!this.state.error) return this.props.children;

    const isChunkError = /chunk|dynamically imported module|importing a module script/i.test(this.state.error.message);
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-slate-900">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
          <h1 className="text-lg font-bold">Không thể tải giao diện CRM</h1>
          {isChunkError && (
            <p className="mt-2 text-sm text-slate-600">
              Trình duyệt đang giữ phiên bản giao diện cũ. Hãy tải lại để nhận bản mới nhất.
            </p>
          )}

          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white! cursor-pointer hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
              style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
            >
              Tải lại trang
            </button>
          </div>

          {/* Chi tiết mã lỗi (Expandable Error Details) */}
          {this.state.error && (
            <details className="mt-4 text-left border border-slate-200 rounded-xl overflow-hidden bg-slate-50 group">
              <summary className="px-3.5 py-2.5 text-xs font-bold text-slate-700 cursor-pointer hover:bg-slate-100/80 select-none flex items-center justify-between">
                <span>Xem chi tiết mã lỗi</span>
                <button
                  type="button"
                  onClick={this.handleCopy}
                  title={this.state.copied ? 'Đã sao chép!' : 'Sao chép mã lỗi'}
                  aria-label="Sao chép mã lỗi"
                  className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-200/80 transition-colors flex items-center gap-1 text-[11px]"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-[10px] text-emerald-600 font-medium">Đã chép</span>
                    </>
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500 hover:text-slate-700" />
                  )}
                </button>
              </summary>
              <div className="p-3 border-t border-slate-200 bg-slate-900 text-slate-200 text-xs font-mono overflow-x-auto max-h-56 space-y-2">
                <div className="text-rose-400 font-bold whitespace-pre-wrap wrap-break-word">
                  {this.state.error.message || 'Lỗi không xác định'}
                </div>
                {this.state.error.stack && (
                  <pre className="text-[11px] text-slate-400 whitespace-pre-wrap wrap-break-word leading-relaxed">
                    {this.state.error.stack}
                  </pre>
                )}
              </div>
            </details>
          )}
        </section>
      </main>
    );
  }
}
