import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  CLIENT_ID: z.string().min(1, 'CLIENT_ID is required'),
  GUILD_ID: z.string().optional(),
  LOG_LEVEL: z.string().optional().default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
});

const result = envSchema.safeParse({
  DISCORD_TOKEN: process.env['DISCORD_TOKEN'] ?? process.env['token'],
  CLIENT_ID: process.env['CLIENT_ID'] ?? process.env['clientId'],
  GUILD_ID: process.env['GUILD_ID'] ?? process.env['guildId'],
  LOG_LEVEL: process.env['LOG_LEVEL'],
  DATABASE_URL: process.env['DATABASE_URL'],
  REDIS_URL: process.env['REDIS_URL'],
});

if (!result.success) {
  // Using process.stderr.write directly here because the logger hasn't been
  // initialized yet — config validation must run before any module imports.
  const issues = result.error.issues.map(i => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  process.stderr.write(`Environment variable validation failed:\n${issues}\n`);
  process.exit(1);
}

export const config = result.data;
