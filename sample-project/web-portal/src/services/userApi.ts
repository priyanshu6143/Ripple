import { requestJson } from '../api/httpClient';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  active: boolean;
}

export async function fetchUserProfile(userId: string) {
  return requestJson<UserDto>(`/api/users/${userId}`);
}
