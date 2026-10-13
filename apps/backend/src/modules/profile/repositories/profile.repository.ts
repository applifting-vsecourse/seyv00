import { PrismaService } from '@/core/prisma/prisma.service';
import { Prisma, User as PrismaUser } from '@/generated/prisma/client';
import { Profile } from '@/modules/profile/domain/profile';
import { Injectable } from '@nestjs/common';

export class UsernameTakenError extends Error {
  constructor() {
    super('Username is already taken');
  }
}

const mapPrismaUserToProfile = (user: PrismaUser): Profile => ({
  username: user.username ?? '',
  name: user.name,
  bio: user.bio,
  defaultMood: user.defaultMood,
});

@Injectable()
export class ProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<Profile> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return mapPrismaUserToProfile(user);
  }

  async isUsernameTaken(
    username: string,
    exceptUserId: string,
  ): Promise<boolean> {
    // Case-insensitive: "Duck" and "duck" must not belong to two people.
    const owner = await this.prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        id: { not: exceptUserId },
      },
      select: { id: true },
    });
    return owner !== null;
  }

  async updateProfile(userId: string, profile: Profile): Promise<Profile> {
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          username: profile.username,
          // better-auth's username plugin reads this one for display
          displayUsername: profile.username,
          name: profile.name,
          bio: profile.bio,
          defaultMood: profile.defaultMood,
        },
      });
      return mapPrismaUserToProfile(user);
    } catch (error) {
      // Someone claimed the name between the check and the write.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UsernameTakenError();
      }
      throw error;
    }
  }
}
