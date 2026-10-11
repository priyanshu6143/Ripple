import { fetchUserProfile } from './userApi';

export async function testFetchUserProfile() {
  const response = await fetchUserProfile('u-101');
  return response.status === 200;
}
