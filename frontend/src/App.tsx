import React, { useCallback, useEffect, useState } from 'react';
import {
  analyzeBuiltInSample,
  analyzeZipUpload,
  checkBackendHealth,
  fetchFileImpact,
  fetchProjectById,
  fetchRecentProjects,
} from './api';
import {
  ImpactReportResponse,
  NavTab,
  ProjectAnalysisResponse,
  ProjectSummary,
} from './types';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { AnalyzeView } from './components/AnalyzeView';
import { WorkspaceView } from './components/WorkspaceView';
import { ReportView } from './components/ReportView';
import { AboutView } from './components/AboutView';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectSummary[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<ProjectAnalysisResponse | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [currentImpact, setCurrentImpact] = useState<ImpactReportResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isImpactLoading, setIsImpactLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusToast, setStatusToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    setTimeout(() => {
      setStatusToast((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const refreshMetadata = useCallback(async () => {
    try {
      const health = await checkBackendHealth();
      setBackendHealthy(health.status === 'healthy');
      const recent = await fetchRecentProjects();
      setRecentProjects(recent);
    } catch {
      setBackendHealthy(false);
    }
  }, []);

  useEffect(() => {
    refreshMetadata();
  }, [refreshMetadata]);

  const handleSelectFileForImpact = useCallback(
    async (filePath: string, projectOverride?: ProjectAnalysisResponse) => {
      const targetProject = projectOverride || currentAnalysis;
      if (!targetProject) return;

      setSelectedFilePath(filePath);
      setIsImpactLoading(true);
      setErrorMessage(null);
      try {
        const report = await fetchFileImpact(targetProject.summary.project_id, filePath);
        setCurrentImpact(report);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to compute file impact.');
      } finally {
        setIsImpactLoading(false);
      }
    },
    [currentAnalysis]
  );

  const activateProjectAnalysis = useCallback(
    async (analysis: ProjectAnalysisResponse, navigateToTab: NavTab = 'graph') => {
      setCurrentAnalysis(analysis);
      await refreshMetadata();

      // Choose an interesting default file to highlight impact right away:
      // Prefer UserRepository.java for sample project, or summary.most_depended_on_file, or first file
      const preferredSampleFile = analysis.files.find((f) =>
        f.path.endsWith('UserRepository.java')
      )?.path;
      const defaultFile =
        preferredSampleFile ||
        analysis.summary.most_depended_on_file ||
        analysis.files[0]?.path ||
        null;

      if (defaultFile) {
        await handleSelectFileForImpact(defaultFile, analysis);
      } else {
        setSelectedFilePath(null);
        setCurrentImpact(null);
      }

      setActiveTab(navigateToTab);
    },
    [handleSelectFileForImpact, refreshMetadata]
  );

  const handleLoadSample = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const analysis = await analyzeBuiltInSample();
      await activateProjectAnalysis(analysis, 'graph');
      showToast(
        `Sample project "${analysis.summary.project_name}" analyzed (${analysis.summary.total_files} files, ${analysis.summary.total_dependencies} dependencies).`
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load built-in sample project.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [activateProjectAnalysis, showToast]);

  const handleUploadZip = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const analysis = await analyzeZipUpload(file);
        await activateProjectAnalysis(analysis, 'graph');
        showToast(
          `Uploaded archive "${analysis.summary.project_name}" analyzed (${analysis.summary.total_files} files, ${analysis.summary.total_dependencies} dependencies).`
        );
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Failed to analyze uploaded ZIP.');
      } finally {
        setIsLoading(false);
      }
    },
    [activateProjectAnalysis, showToast]
  );

  const handleSelectProjectById = useCallback(
    async (projectId: string) => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const analysis = await fetchProjectById(projectId);
        await activateProjectAnalysis(analysis, 'graph');
        showToast(`Switched to project "${analysis.summary.project_name}".`);
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : 'Could not load selected project.');
      } finally {
        setIsLoading(false);
      }
    },
    [activateProjectAnalysis, showToast]
  );

  const handleResetSession = useCallback(() => {
    setCurrentAnalysis(null);
    setSelectedFilePath(null);
    setCurrentImpact(null);
    setErrorMessage(null);
    setActiveTab('analyze');
    showToast('Workspace cleared. Ready to analyze another project.');
  }, [showToast]);

  return (
    <div className="min-h-screen flex flex-col bg-[#060913] text-slate-100">
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeProject={currentAnalysis?.summary ?? null}
        backendHealthy={backendHealthy}
        onLoadSample={handleLoadSample}
        onResetSession={handleResetSession}
        isLoading={isLoading}
      />

      {/* Toast Notification */}
      {statusToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md rounded-xl border border-emerald-500/40 bg-[#0B1020]/95 backdrop-blur-md px-4 py-3 shadow-2xl flex items-center gap-3 text-xs text-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="flex-1">{statusToast}</span>
          <button
            type="button"
            onClick={() => setStatusToast(null)}
            className="text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Error Notification (outside Analyze tab) */}
      {errorMessage && activeTab !== 'analyze' && (
        <div className="max-w-[1600px] w-full mx-auto px-4 sm:px-6 pt-4">
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 flex items-center justify-between gap-3 text-xs text-rose-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            currentAnalysis={currentAnalysis}
            currentImpact={currentImpact}
            recentProjects={recentProjects}
            isLoading={isLoading}
            onNavigate={setActiveTab}
            onLoadSample={handleLoadSample}
            onSelectProjectById={handleSelectProjectById}
            onSelectFileForImpact={(fp) => handleSelectFileForImpact(fp)}
          />
        )}

        {activeTab === 'analyze' && (
          <AnalyzeView
            isLoading={isLoading}
            errorMessage={errorMessage}
            onClearError={() => setErrorMessage(null)}
            onUploadZip={handleUploadZip}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'graph' && (
          <WorkspaceView
            analysis={currentAnalysis}
            impactReport={currentImpact}
            selectedFilePath={selectedFilePath}
            isImpactLoading={isImpactLoading}
            onSelectFile={(fp) => handleSelectFileForImpact(fp)}
            onNavigate={setActiveTab}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'reports' && (
          <ReportView
            analysis={currentAnalysis}
            impactReport={currentImpact}
            onSelectFile={(fp) => handleSelectFileForImpact(fp)}
            onNavigate={setActiveTab}
            onLoadSample={handleLoadSample}
          />
        )}

        {activeTab === 'about' && (
          <AboutView onNavigate={setActiveTab} onLoadSample={handleLoadSample} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#050811] py-4 px-4 sm:px-6 text-xs text-slate-500">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-slate-400">Ripple</strong> — Understand the impact before you
            change the code.
          </div>
          <div className="font-mono text-[11px]">
            Deterministic Static Code Analysis • Java / TypeScript / JavaScript
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
