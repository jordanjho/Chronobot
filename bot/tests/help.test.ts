import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockInteraction } from './helpers/interaction.js';

// Mock the logger to suppress output in tests
vi.mock('../src/utils/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import after mocks
const { default: helpCommand } = await import('../src/commands/help.js');

describe('help command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'help' });
  });

  it('should have the correct command name', () => {
    expect(helpCommand.data.name).toBe('help');
  });

  it('should have a description', () => {
    expect(helpCommand.data.description).toBe('Show all commands');
  });

  it('should reply with help text listing all commands', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await helpCommand.execute(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledOnce();
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('/schedule');
    expect(reply).toContain('/list');
    expect(reply).toContain('/edit');
    expect(reply).toContain('/delete');
    expect(reply).toContain('/help');
  });

  it('should mention frequency options in help text', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await helpCommand.execute(interaction as any);
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('once');
    expect(reply).toContain('daily');
    expect(reply).toContain('weekly');
  });

  it('should mention timestamp format in help text', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await helpCommand.execute(interaction as any);
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('YYYY-MM-DD HH:mm');
  });

  it('should include Chronobot Commands header', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await helpCommand.execute(interaction as any);
    const reply = interaction.editReply.mock.calls[0][0] as string;
    expect(reply).toContain('**Chronobot Commands:**');
  });

  it('should only call editReply once', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await helpCommand.execute(interaction as any);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
