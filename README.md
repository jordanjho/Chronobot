# Chronobot

Chronobot is a Discord scheduling bot that currently runs as a single Node.js process with SQLite-backed persistence and in-process delayed execution.

It supports:

- scheduling messages once, daily, or weekly
- listing a user's scheduled messages
- editing scheduled messages
- deleting scheduled messages
- restoring scheduled jobs on startup

## Current Architecture

- Entry point: `bot/index.js`
- Commands: `bot/commands/`
- Scheduling: `bot/scheduler/`
- Persistence: `bot/db/database.js` and `shared/messages.db`
- Discord client: `discord.js`

The current implementation is intentionally simple. It is not yet distributed, does not use Redis or PostgreSQL, and does not have worker pools or queue-backed scheduling.

## Setup

1. Install dependencies.

   ```bash
   cd bot
   npm install
   ```

2. Configure environment variables in `bot/.env`.

   ```env
   token=YOUR_BOT_TOKEN
   clientId=YOUR_CLIENT_ID
   guildId=YOUR_GUILD_ID
   ```

3. Run the bot.

   ```bash
   node index.js
   ```

## Commands

- `/schedule` - schedule a message with a frequency, timestamp, optional content, and optional attachment
- `/list` - list your scheduled messages
- `/edit` - update a scheduled message you own
- `/delete` - delete a scheduled message you own
- `/help` - show the available commands

## Known Gaps

- The codebase is still single-process.
- Timezone support is documented in places but not fully implemented.
- The current scheduling path is process-local and relies on `node-schedule`.
- Some legacy files and docs still need cleanup so the repository matches the runtime behavior.

## Roadmap

The working plan is documented in [docs/plan.txt](docs/plan.txt).

The main direction is to evolve Chronobot into a reliable asynchronous job orchestration platform with:

- adapter-based execution
- idempotent job handling
- retry and dead-letter semantics
- durable persistence
- observability
- containerized deployment

## Why This Project Exists

The goal is not to build a more feature-rich Discord bot. The goal is to turn Chronobot into a backend systems project that demonstrates reliability engineering, async execution, and clean architecture.
