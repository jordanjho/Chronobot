import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockPrismaUserPref = {
  upsert: vi.fn(),
  findUnique: vi.fn(),
};
vi.mock('../../src/db/prisma.js', () => ({
  prisma: { userPreference: mockPrismaUserPref },
}));

const { UserPreferenceRepository } = await import('../../src/repositories/UserPreferenceRepository.js');

describe('UserPreferenceRepository', () => {
  let repo: InstanceType<typeof UserPreferenceRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new UserPreferenceRepository();
  });

  describe('upsert', () => {
    it('calls prisma upsert with correct where/create/update', async () => {
      mockPrismaUserPref.upsert.mockResolvedValue(undefined);

      await repo.upsert('user-1', 'America/New_York');

      expect(mockPrismaUserPref.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', timezone: 'America/New_York' },
        update: { timezone: 'America/New_York' },
      });
    });

    it('overwrites an existing timezone on re-upsert', async () => {
      mockPrismaUserPref.upsert.mockResolvedValue(undefined);

      await repo.upsert('user-1', 'Europe/London');

      const call = mockPrismaUserPref.upsert.mock.calls[0]![0];
      expect(call.update.timezone).toBe('Europe/London');
      expect(call.create.timezone).toBe('Europe/London');
    });

    it('stores userId in both create and where', async () => {
      mockPrismaUserPref.upsert.mockResolvedValue(undefined);

      await repo.upsert('user-42', 'Asia/Tokyo');

      const call = mockPrismaUserPref.upsert.mock.calls[0]![0];
      expect(call.where.userId).toBe('user-42');
      expect(call.create.userId).toBe('user-42');
    });
  });

  describe('findByUserId', () => {
    it('returns timezone when preference exists', async () => {
      mockPrismaUserPref.findUnique.mockResolvedValue({ timezone: 'America/Los_Angeles' });

      const result = await repo.findByUserId('user-1');

      expect(mockPrismaUserPref.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: { timezone: true },
      });
      expect(result).toEqual({ timezone: 'America/Los_Angeles' });
    });

    it('returns null when no preference exists', async () => {
      mockPrismaUserPref.findUnique.mockResolvedValue(null);

      const result = await repo.findByUserId('user-no-pref');

      expect(result).toBeNull();
    });

    it('queries by the given userId', async () => {
      mockPrismaUserPref.findUnique.mockResolvedValue(null);

      await repo.findByUserId('specific-user-99');

      expect(mockPrismaUserPref.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'specific-user-99' } }),
      );
    });
  });
});
