import { fetchUserProfile, UserDto } from '../services/userApi';

export async function loadProfileViewModel(userId: string): Promise<UserDto> {
  const res = await fetchUserProfile(userId);
  return res.data;
}
