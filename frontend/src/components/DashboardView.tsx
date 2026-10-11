import React from 'react';
import {
  FolderUp,
  Sparkles,
  FileCode2,
  GitFork,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Clock,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import {
  ImpactReportResponse,
  NavTab,
  ProjectAnalysisResponse,
  ProjectSummary,
} from '../types';

interface DashboardViewProps {
  currentAnalysis: ProjectAnalysisResponse | null;
  currentImpact: ImpactReportResponse | null;
  recentProjects: ProjectSummary[];
  isLoading: boolean;
  onNavigate: (tab: NavTab) => void;
  onLoadSample: () => void;
  onSelectProjectById: (projectId: string) => void;
  onSelectFileForImpact: (filePath: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentAnalysis,
  currentImpact,
  recentProjects,
  isLoading,
  onNavigate,
  onLoadSample,
  onSelectProjectById,
  onSelectFileForImpact,
}) => {
  const summary = currentAnalysis?.summary ?? null;

  const statCards = [
    {
      label: 'Total Project Files',
      value: summary ? String(summary.total_files) : '—',
      subtext: summary
        ? `${summary.total_files - summary.test_files_count} production, ${summary.test_files_count} test (${summary.languages.map((l) => l.toUpperCase()).join(', ')})`
        : 'No project analyzed yet',
      icon: <FileCode2 className="w-5 h-5 text-sky-400" />,
      accent: 'from-sky-500/15 to-transparent border-sky-500/30',
    },
    {
      label: 'Detected Dependencies',
      value: summary ? String(summary.total_dependencies) : '—',
      subtext: summary
        ? 'Resolved directed import edges'
        : 'Upload a ZIP or load sample project',
      icon: <GitFork className="w-5 h-5 text-indigo-400" />,
      accent: 'from-indigo-500/15 to-transparent border-indigo-500/30',
    },
    {
      label: 'Analyzed Source Files',
      value: summary ? String(currentAnalysis?.files.length ?? 0) : '—',
      subtext: summary
        ? `${summary.ignored_files_count} non-source/build entries skipped`
        : 'Awaiting static analysis run',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />,
      accent: 'from-emerald-500/15 to-transparent border-emerald-500/30',
    },
    {
      label: 'Affected Files (Selected)',
      value: currentImpact ? String(currentImpact.total_affected_count) : '—',
      subtext: currentImpact
        ? `${currentImpact.direct_dependents.length} direct + ${currentImpact.indirect_dependents.length} indirect (${currentImpact.affected_production_count ?? currentImpact.direct_dependents.filter((d) => !d.is_test).length + currentImpact.indirect_dependents.filter((d) => !d.is_test).length} prod, ${currentImpact.affected_test_count ?? currentImpact.direct_dependents.filter((d) => d.is_test).length + currentImpact.indirect_dependents.filter((d) => d.is_test).length} test) of ${currentImpact.other_project_files_count ?? Math.max(1, (summary?.total_files ?? 1) - 1)} other files (${currentImpact.blast_radius_percent}%)`
        : summary
        ? 'Select a file to compute impact'
        : 'No active file selection',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      accent: 'from-amber-500/15 to-transparent border-amber-500/30',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0D152B] via-[#0B1020] to-[#130F29] p-6 sm:p-9 shadow-2xl">
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs font-mono">
            <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Deterministic Static Dependency & Blast-Radius Analyzer</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Understand the impact{' '}
            <span className="bg-gradient-to-r from-sky-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
              before you change the code.
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Upload a Java, JavaScript, or TypeScript codebase as a ZIP archive. Ripple extracts
            import declarations, builds an interactive directed dependency graph, traces direct and
            transitive dependents when a file is modified, highlights risk factors, and suggests
            targeted regression tests.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('analyze')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-lg shadow-sky-500/20 transition-all"
            >
              <FolderUp className="w-4 h-4" />
              <span>Upload Project ZIP</span>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-purple-300" />
              <span>{isLoading ? 'Analyzing Sample...' : 'Try Sample Project'}</span>
            </button>

            {currentAnalysis && (
              <button
                type="button"
                onClick={() => onNavigate('graph')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700 transition-all"
              >
                <span>Open Active Graph</span>
                <ArrowRight className="w-4 h-4 text-sky-400" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Live Analysis Statistics Cards */}
      <section aria-label="Analysis Summary Statistics">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            {summary ? `Active Session Metrics — ${summary.project_name}` : 'Session Metrics'}
          </h2>
          {summary && (
            <span className="text-xs font-mono text-slate-400">
              Project ID: <code className="text-sky-300">{summary.project_id}</code>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className={`rounded-xl border bg-gradient-to-b ${card.accent} bg-[#0B1020]/90 p-5 transition-all`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800">
                  {card.icon}
                </div>
              </div>
              <div className="text-3xl font-bold font-mono text-white tracking-tight">
                {card.value}
              </div>
              <p className="mt-1.5 text-xs text-slate-400 line-clamp-2">{card.subtext}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active Project Workspace Preview OR Empty State */}
      {currentAnalysis ? (
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick High-Impact Files in Active Project */}
          <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0B1020]/90 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-sky-400" />
                    <span>High-Coupling Modules in {currentAnalysis.summary.project_name}</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Click any file below to inspect its direct & transitive impact in the interactive dependency graph.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('graph')}
                  className="text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center gap-1 shrink-0"
                >
                  <span>Full Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="divide-y divide-slate-800/80 border border-slate-800/90 rounded-xl overflow-hidden bg-slate-950/50">
                {[...currentAnalysis.files]
                  .sort((a, b) => b.dependents.length - a.dependents.length)
                  .slice(0, 6)
                  .map((file) => {
                    const isSelected = currentImpact?.selected_file.path === file.path;
                    return (
                      <div
                        key={file.path}
                        className={`flex items-center justify-between gap-4 px-4 py-3 text-xs transition-colors ${
                          isSelected ? 'bg-sky-500/10' : 'hover:bg-slate-900/70'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200 truncate">
                              {file.name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">
                              {file.language}
                            </span>
                            {file.is_test && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                test
                              </span>
                            )}
                          </div>
                          <p className="font-mono text-[11px] text-slate-400 truncate mt-0.5">
                            {file.path}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right font-mono">
                            <span className="text-amber-300 font-semibold">
                              {file.dependents.length}
                            </span>{' '}
                            <span className="text-slate-400">dependents</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectFileForImpact(file.path);
                              onNavigate('graph');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-medium transition-colors"
                          >
                            Analyze Impact
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {currentImpact && (
              <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-300">
                  Currently inspecting:{' '}
                  <code className="font-mono text-sky-300 font-semibold">
                    {currentImpact.selected_file.name}
                  </code>{' '}
                  — Risk:{' '}
                  <span
                    className={`font-semibold ${
                      currentImpact.risk.level === 'High'
                        ? 'text-rose-400'
                        : currentImpact.risk.level === 'Medium'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {currentImpact.risk.level} ({currentImpact.risk.score}/100)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('reports')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30 transition-all"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>View & Export Impact Report</span>
                </button>
              </div>
            )}
          </div>

          {/* Recent Session History */}
          <div className="rounded-xl border border-slate-800 bg-[#0B1020]/90 p-6">
            <h3 className="text-base font-semibold text-white flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-purple-400" />
              <span>Recent Session Analyses</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Projects analyzed in the current backend session.
            </p>

            {recentProjects.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No previous session entries.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentProjects.map((proj) => {
                  const isCurrent = proj.project_id === currentAnalysis.summary.project_id;
                  return (
                    <button
                      key={proj.project_id}
                      type="button"
                      onClick={() => onSelectProjectById(proj.project_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isCurrent
                          ? 'bg-sky-500/10 border-sky-500/40'
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {proj.project_name}
                        </span>
                        {proj.is_sample && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            SAMPLE
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span>
                          {proj.total_files} files • {proj.total_dependencies} edges
                        </span>
                        <span>{new Date(proj.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      ) : (
        /* Honest Empty State when no project has been analyzed yet */
        <section className="rounded-2xl border border-dashed border-slate-800 bg-[#0B1020]/60 p-8 sm:p-12 text-center max-w-3xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto mb-4">
            <GitFork className="w-6 h-6 text-sky-400" />
          </div>
          <h3 className="text-lg font-semibold text-white">No Project Analyzed Yet</h3>
          <p className="mt-2 text-sm text-slate-400 max-w-xl mx-auto">
            Ripple does not display fabricated metrics. Load our built-in multi-file Java &
            TypeScript sample project for an instant demonstration, or upload your own source
            codebase ZIP archive.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadSample}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isLoading ? 'Loading Sample Project...' : 'Load Sample Project Now'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('analyze')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <FolderUp className="w-4 h-4 text-sky-400" />
              <span>Go to ZIP Uploader</span>
            </button>
          </div>
        </section>
      )}
    </div>
  );
};
