import {
  AnalyzedFile,
  GraphResponse,
  HealthResponse,
  ImpactReportResponse,
  ProjectAnalysisResponse,
  ProjectSummary,
} from './types';

function resolveApiBase(): string {
  const rawEnvBase = (
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_API_BASE_URL ?? ''
  ).trim();
  if (!rawEnvBase) {
    return '/api';
  }
  const trimmed = rawEnvBase.replace(/\/+$/, '');
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const API_BASE = resolveApiBase();

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData && typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (errorData && Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map((e: { msg?: string }) => e.msg || JSON.stringify(e)).join('; ');
      }
    } catch {
      // Fallback to status text
    }
    throw new Error(errorMessage);
  }
  return response.json() as Promise<T>;
}

export async function checkBackendHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`);
  return handleResponse<HealthResponse>(res);
}

export async function fetchRecentProjects(): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/projects`);
  return handleResponse<ProjectSummary[]>(res);
}

export async function analyzeZipUpload(file: File): Promise<ProjectAnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    body: formData,
  });
  return handleResponse<ProjectAnalysisResponse>(res);
}

export async function analyzeBuiltInSample(): Promise<ProjectAnalysisResponse> {
  const res = await fetch(`${API_BASE}/analyze/sample`, {
    method: 'POST',
  });
  return handleResponse<ProjectAnalysisResponse>(res);
}

export async function fetchProjectById(projectId: string): Promise<ProjectAnalysisResponse> {
  const res = await fetch(`${API_BASE}/project/${encodeURIComponent(projectId)}`);
  return handleResponse<ProjectAnalysisResponse>(res);
}

export async function fetchProjectFiles(projectId: string): Promise<AnalyzedFile[]> {
  const res = await fetch(`${API_BASE}/project/${encodeURIComponent(projectId)}/files`);
  return handleResponse<AnalyzedFile[]>(res);
}

export async function fetchProjectGraph(projectId: string): Promise<GraphResponse> {
  const res = await fetch(`${API_BASE}/project/${encodeURIComponent(projectId)}/graph`);
  return handleResponse<GraphResponse>(res);
}

export async function fetchFileImpact(
  projectId: string,
  filePath: string
): Promise<ImpactReportResponse> {
  const res = await fetch(`${API_BASE}/project/${encodeURIComponent(projectId)}/impact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file_path: filePath }),
  });
  return handleResponse<ImpactReportResponse>(res);
}

export function getSampleZipDownloadUrl(): string {
  return `${API_BASE}/sample-zip`;
}
