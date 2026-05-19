import pino from 'pino';

const level = process.env['LOG_LEVEL'] ?? 'info';

const logger = pino(
  process.env['NODE_ENV'] !== 'production'
    ? {
        level,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : { level },
);

export default logger;
