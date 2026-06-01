import { prisma } from '../db/prisma.js';

export class UserPreferenceRepository {
  async upsert(userId: string, timezone: string): Promise<void> {
    await prisma.userPreference.upsert({
      where: { userId },
      create: { userId, timezone },
      update: { timezone },
    });
  }

  async findByUserId(userId: string): Promise<{ timezone: string } | null> {
    return prisma.userPreference.findUnique({
      where: { userId },
      select: { timezone: true },
    });
  }
}

export const userPreferenceRepository = new UserPreferenceRepository();
