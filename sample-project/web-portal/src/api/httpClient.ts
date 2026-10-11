export interface ApiResponse<T> {
  data: T;
  status: number;
}

export async function requestJson<T>(path: string): Promise<ApiResponse<T>> {
  const response = await fetch(path);
  const data = (await response.json()) as T;
  return { data, status: response.status };
}
