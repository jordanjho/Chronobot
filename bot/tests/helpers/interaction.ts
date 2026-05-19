import { vi } from 'vitest';

export interface MockInteraction {
  user: { id: string };
  channelId: string;
  commandName: string;
  client: { commands: Map<string, unknown> };
  options: {
    getString: ReturnType<typeof vi.fn>;
    getInteger: ReturnType<typeof vi.fn>;
    getAttachment: ReturnType<typeof vi.fn>;
  };
  isChatInputCommand: ReturnType<typeof vi.fn>;
  deferReply: ReturnType<typeof vi.fn>;
  editReply: ReturnType<typeof vi.fn>;
  reply: ReturnType<typeof vi.fn>;
  followUp: ReturnType<typeof vi.fn>;
  replied: boolean;
  deferred: boolean;
}

export function createMockInteraction(overrides: Partial<MockInteraction> = {}): MockInteraction {
  return {
    user: { id: 'user-123' },
    channelId: 'channel-456',
    commandName: 'test',
    client: { commands: new Map() },
    options: {
      getString: vi.fn().mockReturnValue(null),
      getInteger: vi.fn().mockReturnValue(null),
      getAttachment: vi.fn().mockReturnValue(null),
    },
    isChatInputCommand: vi.fn().mockReturnValue(true),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    replied: false,
    deferred: true,
    ...overrides,
  };
}
