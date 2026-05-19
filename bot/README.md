# Chronobot

Chronobot is a Discord scheduling bot that allows users to automate sending messages, images, videos, and GIFs to Discord channels at specified times and frequencies. It supports per-user scheduling limits and persistent scheduling across restarts.

## Features

- **Schedule Messages:** Use slash commands to schedule messages to be sent once, daily, or weekly.
- **Attachments:** Schedule messages with images, videos, or GIFs.
- **Per-user Limits:** Each user can have up to 5 scheduled messages at a time.
- **Secure Editing/Deleting:** Only the user who scheduled a message can edit or delete it.
- **Persistent Scheduling:** Scheduled messages are restored automatically after bot restarts.
- **Structured Logging:** Uses Pino for structured JSON logging in production, pretty-printed in development.

## Technologies Used

- Node.js 22+
- TypeScript (strict mode)
- discord.js v14
- PostgreSQL (via Prisma ORM)
- node-schedule
- dayjs (+ UTC plugin)
- Pino (structured logging)
- Zod (environment variable validation)
- Vitest (testing)

## Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/chronobot.git
   cd chronobot/bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   - Create a `.env` file in the `bot/` directory (see `.env.example` for reference):
     ```env
     DISCORD_TOKEN=your_bot_token_here
     CLIENT_ID=your_client_id_here
     GUILD_ID=your_guild_id_here   # optional, for guild-specific commands
     DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
     LOG_LEVEL=info                # optional, default: info
     ```

4. **Set up the database:**
   1. Create a free account at [neon.tech](https://neon.tech)
   2. Create a new project and copy the connection string
   3. Add `DATABASE_URL=<connection string>` to your `.env` file
   4. Run the migrations:
      ```bash
      npx prisma migrate deploy
      ```

5. **Deploy slash commands (first time or after changes):**
   ```bash
   npm run deploy-commands
   ```

6. **Run the bot:**
   ```bash
   npm start
   ```

## Development

### Running tests
```bash
npm test
```

### Type checking
```bash
npx tsc --noEmit
```

### Linting
```bash
npm run lint
```

### Building (compiles TypeScript to dist/)
```bash
npm run build
```

## Project Structure

```
bot/
  prisma/
    schema.prisma   Prisma schema (PostgreSQL, Job model)
    migrations/     SQL migration files
  src/
    commands/       delete.ts, edit.ts, help.ts, list.ts, schedule.ts
    db/             prisma.ts (Prisma client singleton)
    events/         interactionCreate.ts, ready.ts
    repositories/   JobRepository.ts
    scheduler/      cancel.ts, restore.ts, scheduleMessage.ts
    utils/          logger.ts
    config.ts       Environment variable validation (Zod)
    discord.d.ts    Discord.js Client type augmentation
    index.ts        Entry point
    types.ts        Shared TypeScript types
  tests/
    helpers/        interaction.ts
    cancel.test.ts, delete.test.ts, edit.test.ts, help.test.ts
    list.test.ts, restore.test.ts, schedule.test.ts
  tsconfig.json
  vitest.config.ts
  eslint.config.js
  package.json
```

## Usage

### Commands

- `/schedule <frequency> <timestamp> <content> [attachment]`
  - Schedule a message. Frequency: once, daily, weekly. Timestamp format: `YYYY-MM-DD HH:mm` (UTC).
- `/list`
  - List all your scheduled messages.
- `/edit <id> [content] [attachment]`
  - Edit your scheduled message. Only your own messages can be edited.
- `/delete <id>`
  - Delete your scheduled message. Only your own messages can be deleted.
- `/help`
  - Show all commands.

## Contributing

Pull requests and suggestions are welcome! Please open an issue for bugs or feature requests.

## License

MIT License
