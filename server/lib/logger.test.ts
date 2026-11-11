import { describe, expect, it } from 'vitest';
import { createAppLogger } from './logger';
import { getLogContext, withLogContext } from './logContext';

const capture = (level = 'info') => {
  const lines: string[] = [];
  const logger = createAppLogger({ NODE_ENV: 'production', LOG_LEVEL: level }, {
    write: (line: string) => { lines.push(line); },
  });
  return { logger, records: () => lines.map((line) => JSON.parse(line)) };
};

describe('structured application logging', () => {
  it('filters debug noise and serializes useful errors and credential redaction', () => {
    const { logger, records } = capture();
    logger.debug('Not printed');
    logger.error({
      err: new Error('Send failed'), wabaId: '123', token: 'secret',
      headers: { authorization: 'Bearer secret', cookie: 'session=secret' },
    }, 'Message send failed');
    expect(records()).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      service: 'yum-crm', environment: 'production', level: 50, wabaId: '123',
      err: { type: 'Error', message: 'Send failed', stack: expect.stringContaining('Send failed') },
      token: '[REDACTED]', headers: { authorization: '[REDACTED]', cookie: '[REDACTED]' },
    });
  });

  it('keeps concurrent async request contexts isolated without retaining fields from previous records', async () => {
    const { logger, records } = capture();
    await Promise.all(['request-a', 'request-b'].map((requestId) =>
      withLogContext({ requestId }, async () => {
        logger.info({ messageId: requestId }, 'Before await');
        await new Promise((resolve) => setTimeout(resolve, 1));
        logger.info('After await');
      })
    ));
    expect(records().filter((r) => r.msg === 'After await')).toEqual([
      expect.objectContaining({ requestId: 'request-a' }),
      expect.objectContaining({ requestId: 'request-b' }),
    ]);
    for (const record of records().filter((r) => r.msg === 'After await')) {
      expect(record).not.toHaveProperty('messageId');
    }
    expect(getLogContext()).toEqual({});
  });

  it('restores the parent context after nested job processing', async () => {
    await withLogContext({ requestId: 'parent' }, async () => {
      await withLogContext({ jobId: 'job' }, async () => {
        expect(getLogContext()).toEqual({ requestId: 'parent', jobId: 'job' });
      });
      expect(getLogContext()).toEqual({ requestId: 'parent' });
    });
    expect(getLogContext()).toEqual({});
  });
});
