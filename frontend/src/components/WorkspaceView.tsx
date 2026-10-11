import React, { useMemo, useState } from 'react';
import {
  Search,
  FileCode2,
  FlaskConical,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Filter,
  Code2,
  Sparkles,
  FolderUp,
  Eye,
  X,
} from 'lucide-react';
import {
  AnalyzedFile,
  ImpactReportResponse,
  NavTab,
  ProjectAnalysisResponse,
} from '../types';
import { DependencyGraph } from './DependencyGraph';
import { downloadReportAsJson, downloadReportAsMarkdown } from '../utils/exportReport';

interface WorkspaceViewProps {
  analysis: ProjectAnalysisResponse | null;
  impactReport: ImpactReportResponse | null;
  selectedFilePath: string | null;
  isImpactLoading: boolean;
  onSelectFile: (filePath: string) => void;
  onNavigate: (tab: NavTab) => void;
  onLoadSample: () => void;
}

export const WorkspaceView: React.FC<WorkspaceViewProps> = ({
  analysis,
  impactReport,
  selectedFilePath,
  isImpactLoading,
  onSelectFile,
  onNavigate,
  onLoadSample,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<string>('all');
  const [showOnlyAffectedNodes, setShowOnlyAffectedNodes] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'affected' | 'tests' | 'risk'>('affected');
  const [inspectingSourceFile, setInspectingSourceFile] = useState<AnalyzedFile | null>(null);

  const filteredFiles = useMemo(() => {
    if (!analysis) return [];
    return analysis.files.filter((file) => {
      const matchesSearch =
        file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        file.path.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesLang =
        languageFilter === 'all' ||
        (languageFilter === 'test' ? file.is_test : file.language === languageFilter);
      return matchesSearch && matchesLang;
    });
  }, [analysis, searchQuery, languageFilter]);

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0B1020]/70 p-12 text-center max-w-2xl mx-auto my-8">
        <FileCode2 className="w-10 h-10 text-sky-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">No Active Project in Workspace</h2>
        <p className="text-sm text-slate-400 mt-1.5">
          Load the built-in sample project or upload a ZIP archive to explore the interactive
          dependency graph and compute change impact.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm bg-purple-600 hover:bg-purple-500 text-white transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Load Sample Project</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analyze')}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <FolderUp className="w-4 h-4 text-sky-400" />
            <span>Upload ZIP</span>
          </button>
        </div>
      </div>
    );
  }

  const localWarnings = analysis.unresolved_warnings.filter((w) => !w.is_external);

  return (
    <div className="space-y-4">
      {/* Top Workspace Control Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0B1020]/90 px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white">{analysis.summary.project_name}</h1>
              {analysis.summary.is_sample && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  BUILT-IN SAMPLE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Select any source file from the tree or click a node on the canvas to simulate modifying it.
            </p>
          </div>
        </div>

        {/* Quick File Selector Dropdown + Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <label htmlFor="quick-file-select" className="text-xs text-slate-400 hidden sm:inline">
              Changed File:
            </label>
            <select
              id="quick-file-select"
              value={selectedFilePath || ''}
              onChange={(e) => {
                if (e.target.value) onSelectFile(e.target.value);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-100 text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-sky-400 max-w-[280px]"
            >
              {analysis.files.map((f) => (
                <option key={f.path} value={f.path}>
                  {f.name} ({f.dependents.length} dependents)
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowOnlyAffectedNodes((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
              showOnlyAffectedNodes
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-200'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>{showOnlyAffectedNodes ? 'Showing Impact Subgraph' : 'Filter to Impact Subgraph'}</span>
          </button>

          {impactReport && (
            <>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-indigo-600/90 hover:bg-indigo-500 text-white transition-all"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Full Report</span>
              </button>
              <button
                type="button"
                onClick={() => downloadReportAsMarkdown(impactReport)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
                title="Download Impact Report as Markdown (.md)"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Export .MD</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main 3-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Left Column: Searchable File Explorer (3 cols) */}
        <div className="lg:col-span-3 rounded-xl border border-slate-800 bg-[#0B1020]/90 flex flex-col h-[640px]">
          <div className="p-3.5 border-b border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Project Files ({filteredFiles.length}/{analysis.files.length})
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search file name or path..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              {[
                { id: 'all', label: 'All' },
                { id: 'java', label: 'Java' },
                { id: 'typescript', label: 'TS/TSX' },
                { id: 'javascript', label: 'JS/JSX' },
                { id: 'test', label: 'Tests' },
              ].map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setLanguageFilter(pill.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                    languageFilter === pill.id
                      ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* File Tree List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
            {filteredFiles.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No files match your filter criteria.
              </div>
            ) : (
              filteredFiles.map((file) => {
                const isSelected = selectedFilePath === file.path;
                const isDirect = impactReport?.direct_dependents.some(
                  (d) => d.file_path === file.path
                );
                const isIndirect = impactReport?.indirect_dependents.some(
                  (d) => d.file_path === file.path
                );

                return (
                  <div
                    key={file.path}
                    onClick={() => onSelectFile(file.path)}
                    className={`w-full text-left px-3.5 py-2.5 transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'bg-sky-500/15 border-l-2 border-l-sky-400'
                        : isDirect
                        ? 'bg-amber-500/10 border-l-2 border-l-amber-400 hover:bg-amber-500/15'
                        : isIndirect
                        ? 'bg-purple-500/10 border-l-2 border-l-purple-400 hover:bg-purple-500/15'
                        : 'hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {file.is_test ? (
                          <FlaskConical className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        ) : (
                          <FileCode2
                            className={`w-3.5 h-3.5 shrink-0 ${
                              isSelected
                                ? 'text-sky-400'
                                : isDirect
                                ? 'text-amber-400'
                                : isIndirect
                                ? 'text-purple-400'
                                : 'text-slate-400'
                            }`}
                          />
                        )}
                        <span
                          className={`text-xs font-medium truncate ${
                            isSelected ? 'text-sky-200 font-semibold' : 'text-slate-200'
                          }`}
                        >
                          {file.name}
                        </span>
                      </div>
                      <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5" title={file.path}>
                        {file.path}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        title={`${file.dependents.length} files depend on ${file.name}`}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                          file.dependents.length > 0
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {file.dependents.length} dep
                      </span>
                      <button
                        type="button"
                        title="Preview source code & raw imports"
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectingSourceFile(file);
                        }}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-300"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Interactive React Flow Graph (5 cols) */}
        <div className="lg:col-span-5 h-[640px] flex flex-col">
          <DependencyGraph
            graph={analysis.graph}
            selectedFile={selectedFilePath}
            impactReport={impactReport}
            onSelectFile={onSelectFile}
            showOnlyAffected={showOnlyAffectedNodes}
          />
        </div>

        {/* Right Column: Impact Summary, Affected Files, Tests & Risk Panel (4 cols) */}
        <div className="lg:col-span-4 rounded-xl border border-slate-800 bg-[#0B1020]/90 flex flex-col h-[640px] overflow-hidden">
          {!impactReport ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Code2 className="w-8 h-8 text-slate-500 mb-2" />
              <p className="text-sm font-medium text-slate-300">
                {isImpactLoading ? 'Calculating impact paths...' : 'Select a file to inspect impact'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Click any file in the left tree or any node in the graph to trace direct and
                transitive dependents.
              </p>
            </div>
          ) : (
            <>
              {/* Selected File & Risk Header */}
              <div className="p-4 border-b border-slate-800 bg-slate-950/60 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold">
                      Selected Changed File
                    </span>
                    <h2
                      className="text-sm font-bold text-white font-mono truncate"
                      title={impactReport.selected_file.path}
                    >
                      {impactReport.selected_file.name}
                    </h2>
                    <p
                      className="text-[11px] font-mono text-slate-400 truncate"
                      title={impactReport.selected_file.path}
                    >
                      {impactReport.selected_file.path}
                    </p>
                  </div>

                  {/* Risk Level Pill */}
                  <div
                    className={`px-3 py-1.5 rounded-xl border text-right shrink-0 ${
                      impactReport.risk.level === 'High'
                        ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                        : impactReport.risk.level === 'Medium'
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    }`}
                  >
                    <div className="text-[10px] font-mono uppercase opacity-80">Risk Level</div>
                    <div className="text-xs font-bold font-mono">
                      {impactReport.risk.level} ({impactReport.risk.score}/100)
                    </div>
                  </div>
                </div>

                {/* Mini Impact Counters */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="rounded-lg bg-slate-900/90 border border-amber-500/30 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">Direct (1 hop)</div>
                    <div className="text-base font-bold font-mono text-amber-300">
                      {impactReport.direct_dependents.length}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {impactReport.direct_production_count ??
                        impactReport.direct_dependents.filter((d) => !d.is_test).length}{' '}
                      prod,{' '}
                      {impactReport.direct_test_count ??
                        impactReport.direct_dependents.filter((d) => d.is_test).length}{' '}
                      test
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/90 border border-purple-500/30 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">Indirect (2+ hops)</div>
                    <div className="text-base font-bold font-mono text-purple-300">
                      {impactReport.indirect_dependents.length}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {impactReport.indirect_production_count ??
                        impactReport.indirect_dependents.filter((d) => !d.is_test).length}{' '}
                      prod,{' '}
                      {impactReport.indirect_test_count ??
                        impactReport.indirect_dependents.filter((d) => d.is_test).length}{' '}
                      test
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/90 border border-sky-500/30 px-2.5 py-1.5">
                    <div className="text-[10px] text-slate-400">Blast Radius</div>
                    <div className="text-base font-bold font-mono text-sky-300">
                      {impactReport.blast_radius_percent}%
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {impactReport.total_affected_count} of{' '}
                      {impactReport.other_project_files_count ??
                        Math.max(1, analysis.files.length - 1)}{' '}
                      other
                    </div>
                  </div>
                </div>

                {/* Panel Sub-navigation Tabs */}
                <div className="grid grid-cols-3 gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveRightTab('affected')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeRightTab === 'affected'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Affected ({impactReport.total_affected_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRightTab('tests')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeRightTab === 'tests'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Tests ({impactReport.suggested_tests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRightTab('risk')}
                    className={`py-1.5 rounded-md text-xs font-medium transition-colors ${
                      activeRightTab === 'risk'
                        ? 'bg-sky-500/20 text-sky-200 border border-sky-500/30'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Risk & Warnings
                  </button>
                </div>
              </div>

              {/* Scrollable Tab Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeRightTab === 'affected' && (
                  <>
                    {/* Breaking Symbol References Banner (when detected) */}
                    {impactReport.symbol_diagnostics &&
                      impactReport.symbol_diagnostics.length > 0 && (
                        <div className="rounded-xl border border-rose-500/40 bg-rose-950/25 p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-rose-300 flex items-center gap-1.5">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>
                                Broken Symbol References ({impactReport.symbol_diagnostics.length})
                              </span>
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-200">
                              Export Validation
                            </span>
                          </div>
                          <div className="space-y-1.5">
                            {impactReport.symbol_diagnostics.map((diag, idx) => (
                              <div
                                key={`${diag.importing_file}-${diag.imported_symbol}-${idx}`}
                                className="rounded-lg bg-slate-950/80 border border-rose-500/30 p-2 text-[11px]"
                              >
                                <div className="font-mono text-rose-200 flex flex-wrap items-center gap-1">
                                  <span>{diag.importing_file}</span>
                                  <span className="text-slate-500">imports</span>
                                  <code className="px-1 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                                    {diag.imported_symbol}
                                  </code>
                                  <span className="text-slate-500">from</span>
                                  <span className="text-amber-300">{diag.source_module}</span>
                                </div>
                                <p className="text-slate-300 mt-1 leading-relaxed">{diag.reason}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    {/* Direct Dependents */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5 mb-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Directly Affected Files ({impactReport.direct_dependents.length})</span>
                      </h3>
                      {impactReport.direct_dependents.length === 0 ? (
                        <p className="text-xs text-slate-500 bg-slate-900/50 rounded-lg p-3 border border-slate-800/80">
                          No files directly import <code className="font-mono">{impactReport.selected_file.name}</code>.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {impactReport.direct_dependents.map((dep) => {
                            const hasBrokenSymbols =
                              (dep.missing_symbols?.length ?? 0) > 0 ||
                              (dep.symbol_diagnostics?.length ?? 0) > 0;
                            return (
                              <div
                                key={dep.file_path}
                                onClick={() => onSelectFile(dep.file_path)}
                                className={`cursor-pointer rounded-xl border p-3 transition-all ${
                                  hasBrokenSymbols
                                    ? 'border-rose-500/40 bg-rose-950/15 hover:bg-rose-950/25'
                                    : 'border-amber-500/30 bg-amber-950/15 hover:bg-amber-950/25'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-amber-200 font-mono truncate">
                                    {dep.file_name}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {hasBrokenSymbols && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/25 text-rose-200 border border-rose-500/40">
                                        Missing Export
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/20 text-amber-300">
                                      1 hop
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-mono text-slate-300">
                                  {dep.dependency_path.map((step, i) => (
                                    <React.Fragment key={step}>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                                        {step.split('/').pop()}
                                      </span>
                                      {i < dep.dependency_path.length - 1 && (
                                        <ArrowRight className="w-3 h-3 text-amber-400" />
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                                {dep.imported_symbols && dep.imported_symbols.length > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-mono">
                                    <span className="text-slate-400">Symbols:</span>
                                    {dep.imported_symbols.map((sym) => {
                                      const isMissing = dep.missing_symbols?.includes(sym);
                                      return (
                                        <span
                                          key={sym}
                                          className={`px-1.5 py-0.5 rounded border ${
                                            isMissing
                                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200 font-semibold'
                                              : 'bg-slate-900 border-slate-700 text-sky-300'
                                          }`}
                                        >
                                          {sym}
                                          {isMissing ? ' (missing)' : ''}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="mt-1.5 text-[11px] text-slate-300 leading-relaxed">
                                  {dep.explanation}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Indirect Dependents */}
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5 mb-2">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>
                          Indirectly Affected Files ({impactReport.indirect_dependents.length})
                        </span>
                      </h3>
                      {impactReport.indirect_dependents.length === 0 ? (
                        <p className="text-xs text-slate-500 bg-slate-900/50 rounded-lg p-3 border border-slate-800/80">
                          No multi-hop transitive dependents detected.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {impactReport.indirect_dependents.map((dep) => {
                            const hasBrokenSymbols =
                              (dep.missing_symbols?.length ?? 0) > 0 ||
                              (dep.symbol_diagnostics?.length ?? 0) > 0;
                            return (
                              <div
                                key={dep.file_path}
                                onClick={() => onSelectFile(dep.file_path)}
                                className={`cursor-pointer rounded-xl border p-3 transition-all ${
                                  hasBrokenSymbols
                                    ? 'border-rose-500/40 bg-rose-950/15 hover:bg-rose-950/25'
                                    : 'border-purple-500/30 bg-purple-950/15 hover:bg-purple-950/25'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-semibold text-purple-200 font-mono truncate">
                                    {dep.file_name}
                                  </span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {hasBrokenSymbols && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-500/25 text-rose-200 border border-rose-500/40">
                                        Missing Export
                                      </span>
                                    )}
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300">
                                      {dep.distance} hops
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px] font-mono text-slate-300">
                                  {dep.dependency_path.map((step, i) => (
                                    <React.Fragment key={step}>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                                        {step.split('/').pop()}
                                      </span>
                                      {i < dep.dependency_path.length - 1 && (
                                        <ArrowRight className="w-3 h-3 text-purple-400" />
                                      )}
                                    </React.Fragment>
                                  ))}
                                </div>
                                {dep.imported_symbols && dep.imported_symbols.length > 0 && (
                                  <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px] font-mono">
                                    <span className="text-slate-400">Symbols:</span>
                                    {dep.imported_symbols.map((sym) => {
                                      const isMissing = dep.missing_symbols?.includes(sym);
                                      return (
                                        <span
                                          key={sym}
                                          className={`px-1.5 py-0.5 rounded border ${
                                            isMissing
                                              ? 'bg-rose-500/20 border-rose-500/40 text-rose-200 font-semibold'
                                              : 'bg-slate-900 border-slate-700 text-sky-300'
                                          }`}
                                        >
                                          {sym}
                                          {isMissing ? ' (missing)' : ''}
                                        </span>
                                      );
                                    })}
                                  </div>
                                )}
                                <p className="mt-1.5 text-[11px] text-slate-300 leading-relaxed">
                                  {dep.explanation}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {activeRightTab === 'tests' && (
                  <div className="space-y-2.5">
                    <p className="text-xs text-slate-400">
                      Recommended test suites based on dependency graph reachability and project test
                      naming conventions:
                    </p>
                    {impactReport.suggested_tests.map((test, idx) => (
                      <div
                        key={`${test.recommended_name}-${idx}`}
                        className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-mono font-semibold text-slate-100 truncate">
                            {test.recommended_name}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                test.exists_in_project
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {test.exists_in_project ? 'In Project' : 'Suggested New'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-sky-300">
                              {test.priority}
                            </span>
                          </div>
                        </div>
                        {test.test_file && (
                          <p className="text-[10px] font-mono text-slate-400 truncate">
                            {test.test_file}
                          </p>
                        )}
                        <p className="text-[11px] text-slate-300 leading-relaxed">{test.reason}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeRightTab === 'risk' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3.5">
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {impactReport.risk.summary}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {impactReport.risk.methodology_note}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Risk Heuristic Breakdown
                      </h4>
                      {impactReport.risk.factors.map((factor) => (
                        <div
                          key={factor.label}
                          className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-200">{factor.label}</span>
                            <span
                              className={`font-mono px-2 py-0.5 rounded text-[10px] ${
                                factor.severity === 'high'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : factor.severity === 'medium'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-emerald-500/20 text-emerald-300'
                              }`}
                            >
                              {factor.value}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">{factor.detail}</p>
                        </div>
                      ))}
                    </div>

                    {/* Symbol-level export/import diagnostics */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Symbol-Level Export Validation (
                        {impactReport.symbol_diagnostics?.length ?? 0})
                      </h4>
                      {!impactReport.symbol_diagnostics ||
                      impactReport.symbol_diagnostics.length === 0 ? (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 flex items-center gap-2 text-xs text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>
                            No missing named or default exports detected for{' '}
                            <code className="font-mono">{impactReport.selected_file.name}</code>.
                          </span>
                        </div>
                      ) : (
                        impactReport.symbol_diagnostics.map((diag, i) => (
                          <div
                            key={`${diag.importing_file}-${diag.imported_symbol}-${i}`}
                            className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-2.5 text-[11px] space-y-1"
                          >
                            <div className="font-mono text-rose-200 flex flex-wrap items-center gap-1">
                              <span className="font-semibold">{diag.importing_file}</span>
                              <span className="text-slate-400">→</span>
                              <code className="px-1 py-0.5 rounded bg-rose-500/20 text-rose-300">
                                {diag.imported_symbol}
                              </code>
                              <span className="text-slate-400">from</span>
                              <span className="underline text-amber-200">{diag.source_module}</span>
                            </div>
                            <p className="text-slate-300">{diag.reason}</p>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Unresolved local import warnings */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Unresolved Local Imports ({localWarnings.length})
                      </h4>
                      {localWarnings.length === 0 ? (
                        <div className="rounded-lg border border-emerald-500/20 bg-emerald-950/20 p-3 flex items-center gap-2 text-xs text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>All project-relative imports resolved cleanly.</span>
                        </div>
                      ) : (
                        localWarnings.map((w, i) => (
                          <div
                            key={`${w.source_file}-${w.raw_import}-${i}`}
                            className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-[11px]"
                          >
                            <div className="font-mono text-amber-200">
                              {w.source_file} → <span className="underline">{w.raw_import}</span>
                            </div>
                            <p className="text-slate-300 mt-0.5">{w.reason}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Export Bar */}
              <div className="p-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => downloadReportAsMarkdown(impactReport)}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Markdown</span>
                </button>
                <button
                  type="button"
                  onClick={() => downloadReportAsJson(impactReport)}
                  className="flex-1 py-2 px-3 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>JSON</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Source Code & Raw Imports Modal */}
      {inspectingSourceFile && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setInspectingSourceFile(null)}
        >
          <div
            className="bg-[#0B1020] border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[82vh] flex flex-col overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white font-mono">
                  {inspectingSourceFile.path}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {inspectingSourceFile.line_count} lines • {inspectingSourceFile.size_bytes} bytes •{' '}
                  {inspectingSourceFile.imports.length} resolved imports •{' '}
                  {inspectingSourceFile.dependents.length} dependents
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingSourceFile(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {(inspectingSourceFile.language === 'javascript' ||
                inspectingSourceFile.language === 'typescript') && (
                <div>
                  <h4 className="font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Detected Exported Symbols (
                    {(inspectingSourceFile.exported_symbols?.length ?? 0) +
                      (inspectingSourceFile.has_default_export ? 1 : 0)}
                    )
                  </h4>
                  {(inspectingSourceFile.exported_symbols?.length ?? 0) === 0 &&
                  !inspectingSourceFile.has_default_export ? (
                    <p className="text-slate-500">No named or default exports detected.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {inspectingSourceFile.has_default_export && (
                        <code className="px-2 py-1 rounded bg-purple-950/60 border border-purple-500/40 text-purple-200 font-mono">
                          default
                        </code>
                      )}
                      {inspectingSourceFile.exported_symbols?.map((sym) => (
                        <code
                          key={sym}
                          className="px-2 py-1 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-mono"
                        >
                          {sym}
                        </code>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Detected Raw Import Statements ({inspectingSourceFile.raw_imports.length})
                </h4>
                {inspectingSourceFile.raw_imports.length === 0 ? (
                  <p className="text-slate-500">None detected.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {inspectingSourceFile.raw_imports.map((imp) => (
                      <code
                        key={imp}
                        className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-sky-300 font-mono"
                      >
                        {imp}
                      </code>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Source Preview (First 35 Lines)
                </h4>
                <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  {inspectingSourceFile.preview_snippet}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
