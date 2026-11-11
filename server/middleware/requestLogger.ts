import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { createLogger } from '../lib/logger';
import { withLogContext } from '../lib/logContext';

const log = createLogger('http');

export const requestLogger: RequestHandler = (req, res, next) => {
  const suppliedId = req.get('x-request-id');
  const requestId = suppliedId && /^[a-zA-Z0-9._-]{1,100}$/.test(suppliedId)
    ? suppliedId : randomUUID();
  const started = performance.now();
  res.setHeader('X-Request-Id', requestId);
  res.locals.requestId = requestId;

  withLogContext({ requestId }, () => {
    let logged = false;
    const complete = (aborted: boolean) => {
      if (logged) return;
      logged = true;
      const stream = String(res.getHeader('content-type') || '').startsWith('text/event-stream');
      const status = aborted && !stream ? 499 : res.statusCode;
      const level = stream && aborted ? 'debug' : status >= 500 ? 'error' : status >= 400 ? 'warn' :
        req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? 'debug' : 'info';
      log[level]({
        requestId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        status,
        durationMs: Math.round((performance.now() - started) * 10) / 10,
        ...(aborted ? { aborted: true } : {}),
      }, 'Request completed');
    };
    res.once('finish', () => complete(false));
    res.once('close', () => complete(!res.writableFinished));
    next();
  });
};
