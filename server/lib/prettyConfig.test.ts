import { describe, expect, it } from 'vitest';
import { prettyFactory } from 'pino-pretty';
import config from './prettyConfig.cjs';

const format = prettyFactory({ ...config, colorize: false, translateTime: 'UTC:HH:MM:ss' });
const common = { time: '2026-11-11T10:22:20Z', service: 'yum-crm', environment: 'production' };

describe('compact terminal logs', () => {
  it('prints HTTP status and duration on a separate line without metadata or full request IDs', () => {
    const output = format({ ...common, level: 30, component: 'http', msg: 'Request completed',
      method: 'POST', path: '/api/meta/messages/react', status: 200, durationMs: 340.2,
      requestId: 'abcdef12-long-id',
    });
    expect(output).toBe('[10:22:20] INFO: [http] POST /api/meta/messages/react → 200 · 340ms\n');
    expect(output).not.toContain('requestId');
    expect(output).not.toContain('yum-crm');
  });

  it('shows the error reason and a short correlation ID without a stack or JSON dump', () => {
    const output = format({ ...common, level: 50, component: 'catalogRoutes',
      msg: '[API CATALOG] Load failed:', requestId: 'abcdef12-long-id',
      err: { message: 'Catalog unavailable\nTry again', stack: 'Error: stack\n at /server/file.ts:20' },
    });
    expect(output).toBe('[10:22:20] ERROR: [catalog] Load failed · Catalog unavailable Try again · #abcdef12\n');
    expect(output).not.toContain('stack');
    expect(output).not.toContain('long-id');
  });
});
