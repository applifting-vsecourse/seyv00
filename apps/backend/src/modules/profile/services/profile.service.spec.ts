import { Profile } from '@/modules/profile/domain/profile';
import {
  ProfileRepository,
  UsernameTakenError,
} from '@/modules/profile/repositories/profile.repository';
import { Identity } from '@/shared/auth/domain/identity';
import { mock } from 'jest-mock-extended';
import { ProfileService } from './profile.service';

const aProfile = (overrides: Partial<Profile> = {}): Profile => ({
  username: 'CaffeinatedDuck',
  name: 'Caffeinated Duck',
  bio: null,
  defaultMood: null,
  ...overrides,
});

const user = { id: 'u1' } as Identity;

describe('ProfileService', () => {
  it("returns the signed-in user's profile", async () => {
    const profile = aProfile();
    const repository = mock<ProfileRepository>();
    repository.getProfile.mockResolvedValue(profile);

    const service = new ProfileService(repository);

    await expect(service.getProfile(user)).resolves.toEqual(profile);
    expect(repository.getProfile).toHaveBeenCalledWith('u1');
  });

  it("updates the signed-in user's profile when the username is free", async () => {
    const profile = aProfile({
      username: 'decaf.duck',
      bio: 'Off coffee',
      defaultMood: 'sad',
    });
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(false);
    repository.updateProfile.mockResolvedValue(profile);

    const service = new ProfileService(repository);

    await expect(service.updateProfile(user, profile)).resolves.toEqual(
      profile,
    );
    // the user's own current name doesn't count as taken
    expect(repository.isUsernameTaken).toHaveBeenCalledWith('decaf.duck', 'u1');
    expect(repository.updateProfile).toHaveBeenCalledWith('u1', profile);
  });

  it('refuses a username someone else has and saves nothing', async () => {
    const repository = mock<ProfileRepository>();
    repository.isUsernameTaken.mockResolvedValue(true);

    const service = new ProfileService(repository);

    await expect(
      service.updateProfile(user, aProfile({ username: 'DeepDuckThoughts' })),
    ).rejects.toBeInstanceOf(UsernameTakenError);
    expect(repository.updateProfile).not.toHaveBeenCalled();
  });
});
