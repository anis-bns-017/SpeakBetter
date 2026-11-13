import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { readOnboarding, SELF_LEVELS, type OnboardingInput } from './onboarding';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService) {}

  async getProfileByUserId(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
    if (!profile) {
      throw new NotFoundException('Profile not found');
    }
    return profile;
  }

  /**
   * Saves the first-day guide's answers (each one optional) and marks the guide done, so it isn't shown again.
   * A self-chosen level only fills an empty level: a level test result always wins.
   */
  async completeOnboarding(userId: string, input: OnboardingInput) {
    const answers = readOnboarding(input);
    const existing = await this.prisma.profile.findUnique({ where: { userId }, select: { level: true } });
    if (!existing) throw new NotFoundException('Profile not found');

    await this.prisma.profile.update({
      where: { userId },
      data: {
        onboardedAt: new Date(),
        ...(answers.nativeLanguage ? { nativeLanguage: answers.nativeLanguage } : {}),
        ...(answers.goals ? { goals: answers.goals } : {}),
        ...(answers.selfLevel && !existing.level ? { level: SELF_LEVELS[answers.selfLevel] } : {}),
      },
    });
    const settings = {
      ...(answers.dailyGoalMinutes ? { dailyGoalMinutes: answers.dailyGoalMinutes } : {}),
      ...(answers.interfaceLanguage ? { language: answers.interfaceLanguage } : {}),
    };
    if (Object.keys(settings).length) {
      await this.prisma.settings.upsert({ where: { userId }, create: { userId, ...settings }, update: settings });
    }
    return { ok: true, saved: answers };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Ensure profile exists
    const existing = await this.prisma.profile.findUnique({ where: { userId } });
    if (!existing) {
      throw new NotFoundException('Profile not found');
    }

    return this.prisma.profile.update({
      where: { userId },
      data: {
        country: dto.country,
        nativeLanguage: dto.nativeLanguage,
        learningLanguages: dto.learningLanguages,
        interests: dto.interests,
        goals: dto.goals,
        bio: dto.bio,
      },
      include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
    });
  }
}