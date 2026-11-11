import 'dotenv/config';
import pino, { type DestinationStream, type LoggerOptions } from 'pino';
import { getLogContext } from './logContext';

export function createAppLogger(
  env: NodeJS.ProcessEnv = process.env,
  destination?: DestinationStream,
) {
  const pretty = env.LOG_FORMAT === 'pretty' ||
    (!env.LOG_FORMAT && env.NODE_ENV !== 'production' && env.NODE_ENV !== 'test');
  const options: LoggerOptions = {
    level: env.LOG_LEVEL || (env.NODE_ENV === 'test' ? 'silent' : 'info'),
    base: { service: 'yum-crm', environment: env.NODE_ENV || 'development' },
    timestamp: pino.stdTimeFunctions.isoTime,
    mixin: () => ({ ...getLogContext() }),
    serializers: { err: pino.stdSerializers.err },
    redact: {
      paths: [
        'password', 'token', 'access_token', 'refresh_token', 'secret', 'authorization', 'cookie',
        '*.password', '*.token', '*.access_token', '*.refresh_token', '*.secret',
        '*.authorization', '*.cookie', 'req.headers.authorization', 'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
    // Tests and callers supplying a stream always receive structured JSON.
    ...(!destination && pretty ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: Boolean(process.stdout.isTTY) && !('NO_COLOR' in env),
          singleLine: true,
          translateTime: 'SYS:HH:MM:ss.l',
          ignore: ['pid,hostname,service,environment,component',
            ...(['debug', 'trace'].includes(env.LOG_LEVEL || '') ? [] : ['err.stack']),
          ].join(','),
          errorLikeObjectKeys: [],
          messageFormat: '[{component}] {msg}',
        },
      },
    } : {}),
  };
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createAppLogger();
export const createLogger = (component: string) => logger.child({ component });
