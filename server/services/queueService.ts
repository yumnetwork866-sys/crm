import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { createHash, randomUUID } from 'node:crypto';
import { getLogContext, withLogContext, type LogContext } from '../lib/logContext';
import { createLogger } from '../lib/logger';

const log = createLogger('queue');

interface QueueLogData {
  logContext?: LogContext;
}

const captureJobContext = (): LogContext => ({
  requestId: getLogContext().requestId,
  jobId: randomUUID(),
});

export interface WebhookIngestJobData extends QueueLogData {
  payload: unknown;
  receivedAt: string;
}

export interface DifyReplyJobData extends QueueLogData {
  fromPhone: string;
  customerName: string;
  customerId: string;
  incomingText: string;
  isCrmCustomer: boolean;
  incomingMsgId?: string;
  brandName?: string;
  businessPhoneNumberId?: string;
}

export interface MediaPrefetchJobData extends QueueLogData {
  mediaId: string;
  businessPhoneNumberId?: string;
}

export interface MessageTranslationJobData extends QueueLogData {
  messageId: string;
}

export interface CampaignRecipientJobData extends QueueLogData {
  recipientId: string;
  campaignId: string;
}

export interface QueueHealthStatus {
  mode: 'bullmq-redis' | 'memory-fallback';
  redisConnected: boolean;
  redisUrl: string | null;
  rateLimitPerSecond: number;
  inMemoryPending: {
    webhookIngest: number;
    difyAutoReply: number;
    mediaPrefetch: number;
    campaignBroadcast: number;
    messageTranslation: number;
  };
}

type JobProcessor<T> = (data: T) => Promise<void>;

function withJobLogging<T extends QueueLogData>(
  queue: string,
  processJob: JobProcessor<T>,
): JobProcessor<T> {
  return (data) =>
    withLogContext(
      {
        requestId: data.logContext?.requestId,
        jobId: data.logContext?.jobId,
        queue,
      },
      async () => {
        const started = performance.now();
        try {
          await processJob(data);
          log.debug({ durationMs: Math.round(performance.now() - started) }, 'Job completed');
        } catch (err) {
          log.warn(
            { err, durationMs: Math.round(performance.now() - started) },
            'Job attempt failed',
          );
          throw err;
        }
      },
    );
}

interface InMemoryJob<T> {
  data: T;
  attemptsLeft: number;
  backoffMs: number;
  dedupeKey?: string;
}

/**
 * Lightweight in-process async queue with concurrency and rate-limit support
 * used automatically when Redis is unavailable in local development.
 */
class InMemoryAsyncQueue<T extends QueueLogData> {
  private readonly queue: InMemoryJob<T>[] = [];
  private readonly pendingKeys = new Set<string>();
  private activeCount = 0;
  private processor: JobProcessor<T> | null = null;
  private windowStart = Date.now();
  private processedInWindow = 0;
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly name: string,
    private readonly concurrency: number,
    private readonly maxPerSecond?: number,
  ) {}

  setProcessor(processor: JobProcessor<T>) {
    this.processor = processor;
    this.scheduleDrain();
  }

  enqueue(
    data: T,
    options?: { attempts?: number; backoffMs?: number; delayMs?: number; dedupeKey?: string },
  ) {
    if (options?.dedupeKey && this.pendingKeys.has(options.dedupeKey)) return;
    const job: InMemoryJob<T> = {
      data,
      attemptsLeft: Math.max(1, options?.attempts ?? 1),
      backoffMs: Math.max(250, options?.backoffMs ?? 1_000),
      dedupeKey: options?.dedupeKey,
    };
    if (job.dedupeKey) this.pendingKeys.add(job.dedupeKey);

    if (options?.delayMs && options.delayMs > 0) {
      setTimeout(() => {
        this.queue.push(job);
        this.scheduleDrain();
      }, options.delayMs);
      return;
    }

    this.queue.push(job);
    this.scheduleDrain();
  }

  get pendingCount(): number {
    return this.queue.length + this.activeCount;
  }

  private scheduleDrain() {
    if (!this.processor) return;
    queueMicrotask(() => this.drain());
  }

  private drain() {
    if (!this.processor) return;

    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      if (this.maxPerSecond && this.maxPerSecond > 0) {
        const now = Date.now();
        if (now - this.windowStart >= 1_000) {
          this.windowStart = now;
          this.processedInWindow = 0;
        }
        if (this.processedInWindow >= this.maxPerSecond) {
          if (!this.drainTimer) {
            const waitMs = Math.max(50, 1_000 - (now - this.windowStart));
            this.drainTimer = setTimeout(() => {
              this.drainTimer = null;
              this.drain();
            }, waitMs);
          }
          return;
        }
        this.processedInWindow += 1;
      }

      const nextJob = this.queue.shift();
      if (!nextJob) break;

      this.activeCount += 1;
      void this.runJob(nextJob);
    }
  }

  private async runJob(job: InMemoryJob<T>) {
    let retryScheduled = false;
    try {
      if (this.processor) {
        await this.processor(job.data);
      }
    } catch (error: any) {
      job.attemptsLeft -= 1;
      if (job.attemptsLeft > 0) {
        retryScheduled = true;
        const delay = job.backoffMs;
        job.backoffMs *= 2;
        setTimeout(() => {
          this.queue.push(job);
          this.scheduleDrain();
        }, delay);
      } else {
        log.error({ ...job.data.logContext, err: error, queue: this.name }, 'Job failed');
      }
    } finally {
      if (!retryScheduled && job.dedupeKey) this.pendingKeys.delete(job.dedupeKey);
      this.activeCount -= 1;
      this.scheduleDrain();
    }
  }
}

const WEBHOOK_CONCURRENCY = Math.max(1, Number(process.env.WEBHOOK_WORKER_CONCURRENCY) || 10);
const DIFY_CONCURRENCY = Math.max(1, Number(process.env.DIFY_WORKER_CONCURRENCY) || 5);
const MEDIA_CONCURRENCY = Math.max(1, Number(process.env.MEDIA_WORKER_CONCURRENCY) || 5);
const CAMPAIGN_CONCURRENCY = Math.max(
  1,
  Math.min(50, Number(process.env.CAMPAIGN_WORKER_CONCURRENCY) || 5),
);
const CAMPAIGN_RATE_LIMIT_PER_SEC = Math.max(
  1,
  Math.min(200, Number(process.env.CAMPAIGN_RATE_LIMIT_PER_SEC) || 20),
);

const inMemoryWebhookQueue = new InMemoryAsyncQueue<WebhookIngestJobData>(
  'webhook-ingest',
  WEBHOOK_CONCURRENCY,
);
const inMemoryDifyQueue = new InMemoryAsyncQueue<DifyReplyJobData>(
  'dify-auto-reply',
  DIFY_CONCURRENCY,
);
const inMemoryMediaQueue = new InMemoryAsyncQueue<MediaPrefetchJobData>(
  'media-prefetch',
  MEDIA_CONCURRENCY,
);
const inMemoryTranslationQueue = new InMemoryAsyncQueue<MessageTranslationJobData>(
  'message-translation',
  1,
);
const inMemoryCampaignQueue = new InMemoryAsyncQueue<CampaignRecipientJobData>(
  'campaign-broadcast',
  CAMPAIGN_CONCURRENCY,
  CAMPAIGN_RATE_LIMIT_PER_SEC,
);

let redisConnection: IORedis | null = null;
let isRedisReady = false;
let resolvedRedisUrl: string | null = null;

let bullWebhookQueue: Queue<WebhookIngestJobData> | null = null;
let bullDifyQueue: Queue<DifyReplyJobData> | null = null;
let bullMediaQueue: Queue<MediaPrefetchJobData> | null = null;
let bullTranslationQueue: Queue<MessageTranslationJobData> | null = null;
let bullCampaignQueue: Queue<CampaignRecipientJobData> | null = null;

const bullWorkers: Worker[] = [];

export interface QueueHandlers {
  onWebhookPayload: JobProcessor<WebhookIngestJobData>;
  onDifyAutoReply: JobProcessor<DifyReplyJobData>;
  onMediaPrefetch: JobProcessor<MediaPrefetchJobData>;
  onMessageTranslation: JobProcessor<MessageTranslationJobData>;
  onCampaignRecipient: JobProcessor<CampaignRecipientJobData>;
}

function getConfiguredRedisUrl(): string {
  if (process.env.REDIS_URL?.trim()) {
    return process.env.REDIS_URL.trim();
  }
  const host = process.env.REDIS_HOST?.trim() || '127.0.0.1';
  const port = Number(process.env.REDIS_PORT) || 6379;
  const password = process.env.REDIS_PASSWORD?.trim();
  return password
    ? `redis://:${encodeURIComponent(password)}@${host}:${port}`
    : `redis://${host}:${port}`;
}

async function probeRedisConnection(url: string): Promise<IORedis | null> {
  if (process.env.QUEUE_MODE === 'memory' || process.env.DISABLE_REDIS === 'true') {
    return null;
  }

  const client = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: true,
    connectTimeout: 1_000,
    retryStrategy: (times) => {
      if (!isRedisReady && times > 1) return null;
      return Math.min(times * 500, 5_000);
    },
  });

  client.on('error', (err) => {
    if (isRedisReady) {
      log.warn({ err }, 'Redis connection interrupted');
    }
  });

  try {
    await client.connect();
    await client.ping();
    return client;
  } catch {
    try {
      client.disconnect();
    } catch {}
    return null;
  }
}

/**
 * Initialize BullMQ queues & workers if Redis is reachable, or seamlessly
 * bind the in-memory fallback processors otherwise.
 */
export async function initMessageQueues(handlers: QueueHandlers): Promise<QueueHealthStatus> {
  const processCampaignRecipient = withJobLogging(
    'campaign-broadcast',
    handlers.onCampaignRecipient,
  );
  const processMediaPrefetch = withJobLogging('media-prefetch', handlers.onMediaPrefetch);
  const processDifyAutoReply = withJobLogging('dify-auto-reply', handlers.onDifyAutoReply);
  const processWebhookPayload = withJobLogging('webhook-ingest', handlers.onWebhookPayload);
  const processMessageTranslation = withJobLogging(
    'message-translation',
    handlers.onMessageTranslation,
  );
  inMemoryWebhookQueue.setProcessor(processWebhookPayload);
  inMemoryDifyQueue.setProcessor(processDifyAutoReply);
  inMemoryMediaQueue.setProcessor(processMediaPrefetch);
  inMemoryCampaignQueue.setProcessor(processCampaignRecipient);
  inMemoryTranslationQueue.setProcessor(processMessageTranslation);

  const candidateUrl = getConfiguredRedisUrl();
  const connectedClient = await probeRedisConnection(candidateUrl);

  if (!connectedClient) {
    isRedisReady = false;
    resolvedRedisUrl = null;
    log.info({ mode: 'memory-fallback' }, 'Queues ready');
    return getQueueHealth();
  }

  redisConnection = connectedClient;
  isRedisReady = true;
  resolvedRedisUrl = candidateUrl.replace(/:[^:@/]+@/, ':***@');

  const connectionOptions = {
    host: connectedClient.options.host || '127.0.0.1',
    port: connectedClient.options.port || 6379,
    password: connectedClient.options.password,
    db: connectedClient.options.db || 0,
    maxRetriesPerRequest: null as null,
  };

  bullWebhookQueue = new Queue<WebhookIngestJobData>('crm-webhook-ingest', {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_000 },
      removeOnComplete: { count: 1_000 },
      removeOnFail: { count: 2_000 },
    },
  });

  bullDifyQueue = new Queue<DifyReplyJobData>('crm-dify-auto-reply', {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'exponential', delay: 2_000 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 1_000 },
    },
  });

  bullMediaQueue = new Queue<MediaPrefetchJobData>('crm-media-prefetch', {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1_500 },
      removeOnComplete: { count: 500 },
      removeOnFail: { count: 500 },
    },
  });

  bullCampaignQueue = new Queue<CampaignRecipientJobData>('crm-campaign-broadcast', {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { count: 2_000 },
      removeOnFail: { count: 2_000 },
    },
  });
  bullTranslationQueue = new Queue<MessageTranslationJobData>('crm-message-translation', {
    connection: connectionOptions,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      removeOnComplete: { count: 2_000 },
      removeOnFail: { count: 1_000 },
    },
  });
  await bullTranslationQueue.setGlobalConcurrency(1);

  const webhookWorker = new Worker<WebhookIngestJobData>(
    'crm-webhook-ingest',
    async (job) => {
      await processWebhookPayload(job.data);
    },
    { connection: connectionOptions, concurrency: WEBHOOK_CONCURRENCY },
  );

  const difyWorker = new Worker<DifyReplyJobData>(
    'crm-dify-auto-reply',
    async (job) => {
      await processDifyAutoReply(job.data);
    },
    { connection: connectionOptions, concurrency: DIFY_CONCURRENCY },
  );

  const mediaWorker = new Worker<MediaPrefetchJobData>(
    'crm-media-prefetch',
    async (job) => {
      await processMediaPrefetch(job.data);
    },
    { connection: connectionOptions, concurrency: MEDIA_CONCURRENCY },
  );

  const campaignWorker = new Worker<CampaignRecipientJobData>(
    'crm-campaign-broadcast',
    async (job) => {
      await processCampaignRecipient(job.data);
    },
    {
      connection: connectionOptions,
      concurrency: CAMPAIGN_CONCURRENCY,
      limiter: {
        max: CAMPAIGN_RATE_LIMIT_PER_SEC,
        duration: 1_000,
      },
    },
  );

  const translationWorker = new Worker<MessageTranslationJobData>(
    'crm-message-translation',
    async (job) => {
      await processMessageTranslation(job.data);
    },
    { connection: connectionOptions, concurrency: 1 },
  );

  bullWorkers.push(webhookWorker, difyWorker, mediaWorker, campaignWorker, translationWorker);
  log.info(
    { mode: 'bullmq-redis', rateLimitPerSecond: CAMPAIGN_RATE_LIMIT_PER_SEC },
    'Queues ready',
  );

  return getQueueHealth();
}

export function isBullMqConnected(): boolean {
  return isRedisReady;
}

export function getQueueHealth(): QueueHealthStatus {
  return {
    mode: isRedisReady ? 'bullmq-redis' : 'memory-fallback',
    redisConnected: isRedisReady,
    redisUrl: resolvedRedisUrl,
    rateLimitPerSecond: CAMPAIGN_RATE_LIMIT_PER_SEC,
    inMemoryPending: {
      webhookIngest: inMemoryWebhookQueue.pendingCount,
      difyAutoReply: inMemoryDifyQueue.pendingCount,
      mediaPrefetch: inMemoryMediaQueue.pendingCount,
      campaignBroadcast: inMemoryCampaignQueue.pendingCount,
      messageTranslation: inMemoryTranslationQueue.pendingCount,
    },
  };
}

/**
 * Push incoming Meta Webhook payload to queue for immediate <10ms ACK.
 */
export async function enqueueWebhookPayload(payload: unknown): Promise<void> {
  const jobData: WebhookIngestJobData = {
    payload,
    receivedAt: new Date().toISOString(),
    logContext: captureJobContext(),
  };

  if (isRedisReady && bullWebhookQueue) {
    try {
      await bullWebhookQueue.add('webhook-event', jobData);
      return;
    } catch (error) {
      log.warn(
        { err: error },
        '[BULLMQ WEBHOOK FALLBACK] Không thể đẩy vào Redis, xử lý qua In-Memory Queue:',
      );
    }
  }

  inMemoryWebhookQueue.enqueue(jobData, { attempts: 3, backoffMs: 1_000 });
}

/**
 * Push Dify AI auto-reply task to background worker queue.
 */
export async function enqueueDifyAutoReply(data: DifyReplyJobData): Promise<void> {
  data = { ...data, logContext: captureJobContext() };
  if (isRedisReady && bullDifyQueue) {
    try {
      await bullDifyQueue.add('dify-reply', data, {
        jobId: data.incomingMsgId ? `dify_${data.incomingMsgId}` : undefined,
      });
      return;
    } catch (error) {
      log.warn({ err: error }, '[BULLMQ DIFY FALLBACK] Chuyển sang In-Memory Queue:');
    }
  }

  inMemoryDifyQueue.enqueue(data, { attempts: 2, backoffMs: 2_000 });
}

/**
 * Push Meta Media pre-caching task to background worker queue.
 */
export async function enqueueMediaPrefetch(data: MediaPrefetchJobData): Promise<void> {
  data = { ...data, logContext: captureJobContext() };
  if (isRedisReady && bullMediaQueue) {
    try {
      await bullMediaQueue.add('media-prefetch', data, {
        jobId: `media_${data.mediaId}`,
      });
      return;
    } catch (error) {
      log.warn({ err: error }, '[BULLMQ MEDIA FALLBACK] Chuyển sang In-Memory Queue:');
    }
  }

  inMemoryMediaQueue.enqueue(data, { attempts: 3, backoffMs: 1_500 });
}

/** Translate received messages in the background, one at a time. */
export async function enqueueMessageTranslation(data: MessageTranslationJobData): Promise<void> {
  data = { ...data, logContext: captureJobContext() };
  if (isRedisReady && bullTranslationQueue) {
    try {
      await bullTranslationQueue.add('translate-message', data, {
        jobId: `translation_${createHash('sha256').update(data.messageId).digest('hex')}`,
      });
      return;
    } catch (error) {
      log.warn({ err: error }, 'Translation queue unavailable; using memory fallback');
    }
  }
  inMemoryTranslationQueue.enqueue(data, {
    attempts: 3,
    backoffMs: 5_000,
    dedupeKey: data.messageId,
  });
}

/**
 * Enqueue a single or batch of broadcast campaign recipients with optional retry delay.
 */
export async function enqueueCampaignRecipients(
  jobs: Array<CampaignRecipientJobData & { delayMs?: number }>,
): Promise<void> {
  if (jobs.length === 0) return;
  jobs = jobs.map((item) => ({ ...item, logContext: captureJobContext() }));

  if (isRedisReady && bullCampaignQueue) {
    try {
      await bullCampaignQueue.addBulk(
        jobs.map((item) => ({
          name: 'send-campaign-recipient',
          data: {
            recipientId: item.recipientId,
            campaignId: item.campaignId,
            logContext: item.logContext,
          },
          opts: {
            jobId: item.delayMs
              ? `recipient_${item.recipientId}_retry_${Date.now()}`
              : `recipient_${item.recipientId}`,
            delay: item.delayMs && item.delayMs > 0 ? item.delayMs : undefined,
          },
        })),
      );
      return;
    } catch (error) {
      log.warn({ err: error }, '[BULLMQ CAMPAIGN FALLBACK] Chuyển sang In-Memory Queue:');
    }
  }

  for (const item of jobs) {
    inMemoryCampaignQueue.enqueue(
      { recipientId: item.recipientId, campaignId: item.campaignId, logContext: item.logContext },
      { attempts: 1, delayMs: item.delayMs },
    );
  }
}

export async function closeMessageQueues(): Promise<void> {
  await Promise.allSettled(bullWorkers.map((worker) => worker.close()));
  bullWorkers.length = 0;
  await Promise.allSettled([
    bullWebhookQueue?.close(),
    bullDifyQueue?.close(),
    bullMediaQueue?.close(),
    bullCampaignQueue?.close(),
    bullTranslationQueue?.close(),
  ]);
  if (redisConnection) {
    try {
      await redisConnection.quit();
    } catch {}
    redisConnection = null;
  }
  isRedisReady = false;
}
