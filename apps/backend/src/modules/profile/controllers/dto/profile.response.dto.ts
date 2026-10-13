import { Profile } from '@/modules/profile/domain/profile';
import { QUACK_MOODS, QuackMood } from '@/modules/quack/domain/quack';
import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty()
  username!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  bio!: string | null;

  @ApiProperty({ enum: QUACK_MOODS, nullable: true })
  defaultMood!: QuackMood | null;

  static fromDomain(profile: Profile): ProfileResponseDto {
    return {
      username: profile.username,
      name: profile.name,
      bio: profile.bio,
      defaultMood: profile.defaultMood,
    };
  }
}
