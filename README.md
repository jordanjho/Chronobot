# Chronobot

Chronobot is a Discord scheduling bot built in TypeScript with a BullMQ/Redis job queue, PostgreSQL persistence via Prisma, and Prometheus observability — deployed with Docker on Google Cloud Platform.

It supports:

- scheduling messages once, daily, or weekly
- listing a user's scheduled messages
- editing scheduled messages
- deleting scheduled messages

## Architecture

- **Entry point**: `bot/src/index.ts`
- **Commands**: `bot/src/commands/`
- **Worker**: `bot/src/worker/processor.ts` — BullMQ worker with concurrency control and retry/dead-letter handling
- **Queue**: `bot/src/queue/` — BullMQ over Redis
- **Persistence**: PostgreSQL via Prisma ORM (`bot/prisma/schema.prisma`)
- **Adapters**: `bot/src/adapters/` — pluggable message delivery (DiscordAdapter)
- **Repositories**: `bot/src/repositories/` — Job and Execution data access
- **Metrics**: `bot/src/metrics/` — Prometheus counters, histograms, gauges; `/metrics` and `/healthz` endpoints
- **Logging**: Pino (structured JSON)
- **Process management**: PM2 (`bot/ecosystem.config.cjs`)
- **Containerization**: multi-stage Dockerfile + Docker Compose
- **CI**: GitHub Actions (lint → typecheck → test → docker build)

### Key properties

- **Idempotent execution**: duplicate BullMQ deliveries are detected and skipped via an execution audit trail
- **Retry + dead-letter**: failed jobs retry up to 3 times; exhausted jobs are marked `DEAD` in Postgres
- **Execution audit trail**: every job attempt is recorded in the `executions` table with status, timing, and error
- **Graceful shutdown**: `SIGTERM`/`SIGINT` drain the worker, close the metrics server, and disconnect Prisma before exiting

## Setup

### Prerequisites

- Node.js 22+
- PostgreSQL
- Redis

### Local development

1. Start backing services.

   ```bash
   docker compose up -d postgres redis
   ```

2. Install dependencies.

   ```bash
   cd bot
   npm install
   ```

3. Configure environment variables in `bot/.env`.

   ```env
   DISCORD_TOKEN=YOUR_BOT_TOKEN
   CLIENT_ID=YOUR_CLIENT_ID
   GUILD_ID=YOUR_GUILD_ID
   DATABASE_URL=postgresql://chronobot:chronobot@localhost:5433/chronobot
   REDIS_URL=redis://localhost:6379
   METRICS_PORT=9090  # optional, defaults to 9090
   ```

4. Run Prisma migrations.

   ```bash
   npx prisma migrate deploy
   ```

5. Register slash commands.

   ```bash
   npm run deploy-commands
   ```

6. Start the bot.

   ```bash
   npm start
   ```

### Docker

```bash
docker compose up --build
```

The `bot` service requires `DATABASE_URL` and `REDIS_URL` pointing to the compose service names (`postgres`, `redis`).

## Commands

- `/schedule <frequency> <timestamp> [content] [attachment]` — schedule a message; frequency is `once`, `daily`, or `weekly`; timestamp format `YYYY-MM-DD HH:mm` (UTC)
- `/list` — list your scheduled messages
- `/edit <id> [content] [attachment]` — update a scheduled message you own
- `/delete <id>` — delete a scheduled message you own
- `/help` — show the available commands

## Testing

```bash
cd bot
npm test
```

223 tests via Vitest covering every command handler, service, worker, repository, adapter, and metrics layer — all I/O mocked, no live database or Redis required.

## Design Goals

This project demonstrates reliability engineering and production backend architecture:

- **At-least-once delivery** with idempotency guards (execution audit trail prevents duplicate Discord sends on BullMQ re-delivery)
- **Retry + dead-letter**: 3 attempts with exponential backoff; exhausted jobs marked `DEAD` and cleaned up on restart
- **Crash recovery**: `restoreJobs` on startup prunes stale send-times and re-enqueues all `QUEUED` jobs
- **Observability**: 7 Prometheus metrics (counters, histograms, gauges) + `/healthz` endpoint
- **Adapter abstraction**: `DiscordAdapter` is one implementation of `Adapter`; the scheduler is not Discord-specific
