import { Profile } from '@/modules/profile/domain/profile';
import {
  ProfileRepository,
  UsernameTakenError,
} from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProfileService {
  constructor(private readonly profileRepository: ProfileRepository) {}

  async getProfile(user: Identity): Promise<Profile> {
    return this.profileRepository.getProfile(user.id);
  }

  async updateProfile(user: Identity, profile: Profile): Promise<Profile> {
    // the profile is always the signed-in user's own, never one named in the request
    if (
      await this.profileRepository.isUsernameTaken(profile.username, user.id)
    ) {
      throw new UsernameTakenError();
    }
    return this.profileRepository.updateProfile(user.id, profile);
  }
}
