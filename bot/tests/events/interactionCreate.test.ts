import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Events, MessageFlags } from 'discord.js';
import { createMockInteraction } from '../helpers/interaction.js';

vi.mock('../../src/utils/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { default: interactionCreateEvent } = await import('../../src/events/interactionCreate.js');

describe('interactionCreate event', () => {
  it('has the correct event name', () => {
    expect(interactionCreateEvent.name).toBe(Events.InteractionCreate);
  });

  it('is not a once-listener', () => {
    expect((interactionCreateEvent as { once?: boolean }).once).toBeFalsy();
  });
});

describe('interactionCreate — non-command interactions', () => {
  it('ignores non-chat-input interactions without deferring or replying', async () => {
    const interaction = createMockInteraction();
    interaction.isChatInputCommand.mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

describe('interactionCreate — unknown command', () => {
  it('does not defer or reply when command is not registered', async () => {
    const interaction = createMockInteraction({ commandName: 'nonexistent' });
    // commands map is empty by default

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.deferReply).not.toHaveBeenCalled();
    expect(interaction.editReply).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

describe('interactionCreate — successful command dispatch', () => {
  let interaction: ReturnType<typeof createMockInteraction>;
  let mockExecute: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    interaction = createMockInteraction({ commandName: 'schedule' });
    mockExecute = vi.fn().mockResolvedValue(undefined);
    interaction.client.commands.set('schedule', { default: { execute: mockExecute } });
  });

  it('defers reply with flags: 64 before executing the command', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
  });

  it('defers before executing (order matters — users see loading state)', async () => {
    const callOrder: string[] = [];
    interaction.deferReply.mockImplementation(async () => { callOrder.push('defer'); });
    mockExecute.mockImplementation(async () => { callOrder.push('execute'); });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(callOrder).toEqual(['defer', 'execute']);
  });

  it('calls the command execute function with the interaction', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(mockExecute).toHaveBeenCalledOnce();
    expect(mockExecute).toHaveBeenCalledWith(interaction);
  });

  it('does not send any error message when command succeeds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.followUp).not.toHaveBeenCalled();
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});

describe('interactionCreate — command error handling', () => {
  it('sends ephemeral followUp when command throws and interaction is deferred', async () => {
    const interaction = createMockInteraction({ commandName: 'crash', deferred: true, replied: false });
    const mockExecute = vi.fn().mockRejectedValue(new Error('Something went wrong'));
    interaction.client.commands.set('crash', { default: { execute: mockExecute } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'There was an error while executing this command!',
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('sends ephemeral followUp when command throws and interaction is already replied', async () => {
    const interaction = createMockInteraction({ commandName: 'crash', deferred: false, replied: true });
    const mockExecute = vi.fn().mockRejectedValue(new Error('Replied then crashed'));
    interaction.client.commands.set('crash', { default: { execute: mockExecute } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.followUp).toHaveBeenCalledWith({
      content: 'There was an error while executing this command!',
      flags: MessageFlags.Ephemeral,
    });
  });

  it('sends ephemeral reply when command throws and interaction is neither deferred nor replied', async () => {
    const interaction = createMockInteraction({ commandName: 'crash', deferred: false, replied: false });
    const mockExecute = vi.fn().mockRejectedValue(new Error('Neither deferred nor replied'));
    interaction.client.commands.set('crash', { default: { execute: mockExecute } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await interactionCreateEvent.execute(interaction as any);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'There was an error while executing this command!',
      flags: MessageFlags.Ephemeral,
    });
    expect(interaction.followUp).not.toHaveBeenCalled();
  });

  it('does not throw when error handling itself succeeds', async () => {
    const interaction = createMockInteraction({ commandName: 'crash', deferred: true });
    const mockExecute = vi.fn().mockRejectedValue(new Error('crash'));
    interaction.client.commands.set('crash', { default: { execute: mockExecute } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await expect(interactionCreateEvent.execute(interaction as any)).resolves.toBeUndefined();
  });
});
