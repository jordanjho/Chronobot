import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockInteraction } from './helpers/interaction.js';

vi.mock('../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockUserPrefRepo = {
  upsert: vi.fn(),
  findByUserId: vi.fn(),
};
vi.mock('../src/repositories/UserPreferenceRepository.js', () => ({
  userPreferenceRepository: mockUserPrefRepo,
}));

const { default: timezoneCommand } = await import('../src/commands/timezone.js');

describe('timezone command', () => {
  let interaction: ReturnType<typeof createMockInteraction>;

  beforeEach(() => {
    vi.clearAllMocks();
    interaction = createMockInteraction({ commandName: 'timezone' });
    interaction.options.getSubcommand = vi.fn().mockReturnValue('set');
    interaction.options.getString = vi.fn().mockReturnValue('America/New_York');
  });

  it('has the correct command name', () => {
    expect(timezoneCommand.data.name).toBe('timezone');
  });

  it('has a set subcommand', () => {
    const sub = (timezoneCommand.data.toJSON() as { options: { name: string }[] }).options;
    expect(sub.some((o) => o.name === 'set')).toBe(true);
  });

  it('saves a valid timezone and replies with confirmation', async () => {
    mockUserPrefRepo.upsert.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).toHaveBeenCalledWith(
      interaction.user.id,
      'America/New_York',
    );
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('America/New_York'),
    );
  });

  it('rejects an invalid IANA timezone name', async () => {
    interaction.options.getString = vi.fn().mockReturnValue('Not/A/Real/Zone');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('Not/A/Real/Zone'),
    );
  });

  it('rejects a completely invalid string', async () => {
    interaction.options.getString = vi.fn().mockReturnValue('garbage');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.stringContaining('garbage'),
    );
  });

  it('accepts UTC as a valid timezone', async () => {
    interaction.options.getString = vi.fn().mockReturnValue('UTC');
    mockUserPrefRepo.upsert.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).toHaveBeenCalledWith(interaction.user.id, 'UTC');
  });

  it('accepts Europe/London as a valid timezone', async () => {
    interaction.options.getString = vi.fn().mockReturnValue('Europe/London');
    mockUserPrefRepo.upsert.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).toHaveBeenCalledWith(interaction.user.id, 'Europe/London');
  });

  it('accepts Asia/Tokyo as a valid timezone', async () => {
    interaction.options.getString = vi.fn().mockReturnValue('Asia/Tokyo');
    mockUserPrefRepo.upsert.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).toHaveBeenCalledWith(interaction.user.id, 'Asia/Tokyo');
  });

  it('trims whitespace before validating timezone', async () => {
    interaction.options.getString = vi.fn().mockReturnValue('  America/Chicago  ');
    mockUserPrefRepo.upsert.mockResolvedValue(undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await timezoneCommand.execute(interaction as any);

    expect(mockUserPrefRepo.upsert).toHaveBeenCalledWith(interaction.user.id, 'America/Chicago');
  });
});
