import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  override state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[APP RENDER ERROR]', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;

    const isChunkError = /chunk|dynamically imported module|importing a module script/i.test(this.state.error.message);
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-6 text-slate-900">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xl">
          <h1 className="text-lg font-bold">Không thể tải giao diện CRM</h1>
          <p className="mt-2 text-sm text-slate-600">
            {isChunkError
              ? 'Trình duyệt đang giữ phiên bản giao diện cũ. Hãy tải lại để nhận bản mới nhất.'
              : 'Giao diện gặp lỗi khi hiển thị. Hãy tải lại trang; nếu lỗi tiếp tục, kiểm tra console của trình duyệt.'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white! cursor-pointer hover:bg-indigo-500"
            style={{ color: '#ffffff', WebkitTextFillColor: '#ffffff' }}
          >
            Tải lại trang
          </button>
        </section>
      </main>
    );
  }
}
