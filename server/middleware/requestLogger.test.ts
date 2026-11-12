import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getLogContext } from '../lib/logContext';

const output = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock('../lib/logger', () => ({ createLogger: () => output }));
import { requestLogger } from './requestLogger';

const request = (method: string, status: number, requestId?: string, url = '/api/meta/messages?access_token=secret') => {
  const req = {
    method, originalUrl: url,
    get: () => requestId, body: { content: 'Private message' },
  } as unknown as Request;
  const res = Object.assign(new EventEmitter(), {
    statusCode: status, writableFinished: true, locals: {} as Record<string, unknown>,
    setHeader: vi.fn(), getHeader: vi.fn(),
  });
  let context;
  requestLogger(req, res as unknown as Response, () => { context = getLogContext(); });
  return { res, context };
};

beforeEach(() => vi.clearAllMocks());

describe('HTTP request logging', () => {
  it('propagates a valid request ID and logs one completion without bodies or query strings', () => {
    const { res, context } = request('POST', 200, 'request-123');
    expect(context).toEqual({ requestId: 'request-123' });
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'request-123');
    res.emit('finish');
    res.emit('close');
    expect(output.info).toHaveBeenCalledTimes(1);
    expect(output.info.mock.calls[0][0]).toEqual({
      requestId: 'request-123', method: 'POST', path: '/api/meta/messages', status: 200,
      durationMs: expect.any(Number),
    });
  });

  it('generates an ID when the incoming value is invalid', () => {
    const { res } = request('POST', 200, 'bad\nheader');
    expect(res.locals.requestId).toMatch(/^[\da-f-]{36}$/);
    expect(getLogContext()).toEqual({});
  });

  it.each([
    ['GET', 200, 'info'], ['POST', 201, 'info'], ['POST', 400, 'warn'], ['GET', 500, 'error'],
  ])('logs %s status %s at %s', (method, status, level) => {
    request(method, status).res.emit('finish');
    expect(output[level as keyof typeof output]).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['GET', '/api/health?probe=1'],
    ['GET', '/api/health/'],
    ['GET', '/assets/app.js'],
    ['GET', '/uploads/avatar.jpg'],
    ['HEAD', '/api/customers'],
    ['OPTIONS', '/api/customers'],
  ])('keeps successful %s %s quiet', (method, url) => {
    request(method, 200, undefined, url).res.emit('finish');
    expect(output.debug).toHaveBeenCalledTimes(1);
    expect(output.info).not.toHaveBeenCalled();
  });

  it.each([['GET', 503, 'error', '/api/health'], ['GET', 404, 'warn', '/assets/missing.js']])(
    'still reports errors for quiet paths: %s %s', (method, status, level, url) => {
      request(method, Number(status), undefined, String(url)).res.emit('finish');
      expect(output[level as keyof typeof output]).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps a completed SSE response at debug level', () => {
    const { res } = request('GET', 200);
    res.getHeader.mockReturnValue('text/event-stream');
    res.emit('finish');
    expect(output.debug).toHaveBeenCalledTimes(1);
    expect(output.info).not.toHaveBeenCalled();
  });

  it('keeps ordinary SSE disconnects at debug level', () => {
    const { res } = request('GET', 200);
    res.getHeader.mockReturnValue('text/event-stream');
    res.writableFinished = false;
    res.emit('close');
    expect(output.debug).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }), 'Request completed');
    expect(output.warn).not.toHaveBeenCalled();
  });

  it('records aborted requests once', () => {
    const { res } = request('POST', 200);
    res.writableFinished = false;
    res.emit('close');
    expect(output.warn).toHaveBeenCalledWith(expect.objectContaining({ status: 499, aborted: true }), 'Request completed');
    res.emit('finish');
    expect(output.info).not.toHaveBeenCalled();
  });
});
