import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  requestId?: string;
  jobId?: string;
  queue?: string;
}

const context = new AsyncLocalStorage<LogContext>();

export const getLogContext = (): LogContext => context.getStore() || {};

export function withLogContext<T>(bindings: LogContext, callback: () => T): T {
  return context.run({ ...getLogContext(), ...bindings }, callback);
}
