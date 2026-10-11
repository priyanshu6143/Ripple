import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  FlaskConical,
  ArrowRight,
  Info,
  Sparkles,
  GitFork,
} from 'lucide-react';
import {
  ImpactReportResponse,
  NavTab,
  ProjectAnalysisResponse,
} from '../types';
import {
  downloadReportAsJson,
  downloadReportAsMarkdown,
  generateMarkdownReport,
} from '../utils/exportReport';

interface ReportViewProps {
  analysis: ProjectAnalysisResponse | null;
  impactReport: ImpactReportResponse | null;
  onSelectFile: (filePath: string) => void;
  onNavigate: (tab: NavTab) => void;
  onLoadSample: () => void;
}

export const ReportView: React.FC<ReportViewProps> = ({
  analysis,
  impactReport,
  onSelectFile,
  onNavigate,
  onLoadSample,
}) => {
  const [copied, setCopied] = useState(false);

  if (!analysis || !impactReport) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-[#0B1020]/70 p-12 text-center max-w-2xl mx-auto my-8">
        <FileSpreadsheet className="w-10 h-10 text-indigo-400 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">No Impact Report Generated Yet</h2>
        <p className="text-sm text-slate-400 mt-1.5">
          Load a project and select a changed file to generate a structured impact report with
          dependency paths, risk heuristics, and test recommendations.
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
          {analysis && (
            <button
              type="button"
              onClick={() => onNavigate('graph')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs sm:text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              <GitFork className="w-4 h-4 text-sky-400" />
              <span>Select a File in Graph</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  const handleCopyMarkdown = async () => {
    const md = generateMarkdownReport(impactReport);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Export Actions */}
      <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/95 p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              Static Impact Report
            </span>
            <span className="text-xs font-mono text-slate-400">
              {new Date(impactReport.generated_at).toLocaleString()}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white mt-1.5 font-mono">
            {impactReport.selected_file.name}
          </h1>
          <p className="text-xs font-mono text-slate-400 mt-0.5">
            {impactReport.selected_file.path} • Project: {impactReport.project_name}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Switch reported file"
            value={impactReport.selected_file.path}
            onChange={(e) => onSelectFile(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-xs font-mono rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-400 max-w-[240px]"
          >
            {analysis.files.map((f) => (
              <option key={f.path} value={f.path}>
                {f.name} ({f.dependents.length} dep)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => downloadReportAsMarkdown(impactReport)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-md shadow-sky-500/15 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download .MD</span>
          </button>

          <button
            type="button"
            onClick={() => downloadReportAsJson(impactReport)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold bg-purple-600/90 hover:bg-purple-500 text-white shadow-md shadow-purple-500/15 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download .JSON</span>
          </button>
        </div>
      </div>

      {/* Risk Level & Summary Section */}
      <section className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">1. Risk Assessment & Blast Radius</h2>
            <p className="text-xs text-slate-400 mt-0.5">{impactReport.risk.methodology_note}</p>
          </div>
          <div
            className={`px-4 py-2 rounded-xl border font-mono text-sm font-bold ${
              impactReport.risk.level === 'High'
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                : impactReport.risk.level === 'Medium'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            }`}
          >
            {impactReport.risk.level} Risk • Score {impactReport.risk.score}/100
          </div>
        </div>

        <p className="text-sm text-slate-200 bg-slate-950/70 border border-slate-800/90 rounded-xl p-4">
          {impactReport.risk.summary}
        </p>

        {/* Explicit Count Breakdown Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="text-[11px] text-slate-400">Project Scope</div>
            <div className="text-lg font-bold font-mono text-white mt-0.5">
              {impactReport.total_project_files ?? analysis.files.length} files
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              1 selected +{' '}
              {impactReport.other_project_files_count ?? Math.max(1, analysis.files.length - 1)}{' '}
              other files
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3.5">
            <div className="text-[11px] text-amber-300">Direct Dependents (1 Hop)</div>
            <div className="text-lg font-bold font-mono text-amber-200 mt-0.5">
              {impactReport.direct_dependents.length} files
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {impactReport.direct_production_count ??
                impactReport.direct_dependents.filter((d) => !d.is_test).length}{' '}
              production,{' '}
              {impactReport.direct_test_count ??
                impactReport.direct_dependents.filter((d) => d.is_test).length}{' '}
              test
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-3.5">
            <div className="text-[11px] text-purple-300">Indirect Dependents (2+ Hops)</div>
            <div className="text-lg font-bold font-mono text-purple-200 mt-0.5">
              {impactReport.indirect_dependents.length} files
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {impactReport.indirect_production_count ??
                impactReport.indirect_dependents.filter((d) => !d.is_test).length}{' '}
              production,{' '}
              {impactReport.indirect_test_count ??
                impactReport.indirect_dependents.filter((d) => d.is_test).length}{' '}
              test
            </div>
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-950/10 p-3.5">
            <div className="text-[11px] text-sky-300">Total Unique Affected</div>
            <div className="text-lg font-bold font-mono text-sky-200 mt-0.5">
              {impactReport.total_affected_count} of{' '}
              {impactReport.other_project_files_count ?? Math.max(1, analysis.files.length - 1)} (
              {impactReport.blast_radius_percent}%)
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {impactReport.affected_production_count ??
                impactReport.direct_dependents.filter((d) => !d.is_test).length +
                  impactReport.indirect_dependents.filter((d) => !d.is_test).length}{' '}
              production,{' '}
              {impactReport.affected_test_count ??
                impactReport.direct_dependents.filter((d) => d.is_test).length +
                  impactReport.indirect_dependents.filter((d) => d.is_test).length}{' '}
              test
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {impactReport.risk.factors.map((factor) => (
            <div
              key={factor.label}
              className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-4 space-y-1"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">{factor.label}</span>
                <span
                  className={`font-mono px-2 py-0.5 rounded text-[11px] ${
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
              <p className="text-xs text-slate-400 leading-relaxed">{factor.detail}</p>
            </div>
          ))}
        </div>

        {/* Symbol-Level Export & Import Validation Subsection */}
        {(impactReport.selected_file.language === 'javascript' ||
          impactReport.selected_file.language === 'typescript' ||
          (impactReport.symbol_diagnostics?.length ?? 0) > 0) && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Symbol-Level Export & Import Validation
              </div>
              <span
                className={`px-2.5 py-0.5 rounded text-[11px] font-mono ${
                  (impactReport.symbol_diagnostics?.length ?? 0) > 0
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {(impactReport.symbol_diagnostics?.length ?? 0) > 0
                  ? `${impactReport.symbol_diagnostics?.length} Broken Reference(s)`
                  : 'All Imported Symbols Valid'}
              </span>
            </div>

            <div className="text-xs text-slate-300 flex flex-wrap items-center gap-1.5">
              <span className="text-slate-400">
                Exports declared by <code className="font-mono">{impactReport.selected_file.name}</code>:
              </span>
              {impactReport.selected_file.has_default_export && (
                <code className="px-2 py-0.5 rounded bg-purple-950/60 border border-purple-500/40 text-purple-200 font-mono text-[11px]">
                  default
                </code>
              )}
              {(impactReport.selected_file.exported_symbols?.length ?? 0) > 0 ? (
                impactReport.selected_file.exported_symbols?.map((sym) => (
                  <code
                    key={sym}
                    className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30 text-emerald-300 font-mono text-[11px]"
                  >
                    {sym}
                  </code>
                ))
              ) : (
                !impactReport.selected_file.has_default_export && (
                  <span className="text-slate-500 italic">none</span>
                )
              )}
            </div>

            {impactReport.symbol_diagnostics && impactReport.symbol_diagnostics.length > 0 && (
              <div className="space-y-2 pt-1">
                {impactReport.symbol_diagnostics.map((diag, idx) => (
                  <div
                    key={`${diag.importing_file}-${diag.imported_symbol}-${idx}`}
                    className="rounded-lg border border-rose-500/35 bg-rose-950/20 p-3 text-xs space-y-1"
                  >
                    <div className="font-mono text-rose-200 flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold">{diag.importing_file}</span>
                      <span className="text-slate-400">imports</span>
                      <code className="px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-200 font-bold">
                        {diag.imported_symbol}
                      </code>
                      <span className="text-slate-400">from</span>
                      <code className="px-1.5 py-0.5 rounded bg-slate-900 text-amber-300">
                        {diag.source_module}
                      </code>
                    </div>
                    <p className="text-slate-300 leading-relaxed">{diag.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Directly & Indirectly Affected Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Direct Dependents */}
        <section className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>
                2. Directly Affected Files ({impactReport.direct_dependents.length}:{' '}
                {impactReport.direct_production_count ??
                  impactReport.direct_dependents.filter((d) => !d.is_test).length}{' '}
                prod,{' '}
                {impactReport.direct_test_count ??
                  impactReport.direct_dependents.filter((d) => d.is_test).length}{' '}
                test)
              </span>
            </h2>
            <span className="text-xs font-mono text-amber-300">Distance = 1 hop</span>
          </div>

          {impactReport.direct_dependents.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center bg-slate-950/40 rounded-xl border border-slate-800">
              No files directly import <code className="font-mono">{impactReport.selected_file.name}</code>.
            </p>
          ) : (
            <div className="space-y-3">
              {impactReport.direct_dependents.map((dep) => {
                const hasBrokenSymbols =
                  (dep.missing_symbols?.length ?? 0) > 0 ||
                  (dep.symbol_diagnostics?.length ?? 0) > 0;
                return (
                  <div
                    key={dep.file_path}
                    className={`rounded-xl border p-4 space-y-2 ${
                      hasBrokenSymbols
                        ? 'border-rose-500/40 bg-rose-950/15'
                        : 'border-amber-500/30 bg-amber-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold font-mono text-amber-200">{dep.file_path}</span>
                      <div className="flex items-center gap-1.5">
                        {hasBrokenSymbols && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            Missing Export
                          </span>
                        )}
                        {dep.is_test && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/20 text-indigo-300">
                            Test File
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-300">
                      {dep.dependency_path.map((step, i) => (
                        <React.Fragment key={step}>
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                            {step.split('/').pop()}
                          </span>
                          {i < dep.dependency_path.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    {dep.imported_symbols && dep.imported_symbols.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="text-slate-400">Imported symbols:</span>
                        {dep.imported_symbols.map((sym) => {
                          const isMissing = dep.missing_symbols?.includes(sym);
                          return (
                            <span
                              key={sym}
                              className={`px-2 py-0.5 rounded border ${
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
                    <p className="text-xs text-slate-300 leading-relaxed">{dep.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Indirect Dependents */}
        <section className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400" />
              <span>
                3. Indirectly Affected Files ({impactReport.indirect_dependents.length}:{' '}
                {impactReport.indirect_production_count ??
                  impactReport.indirect_dependents.filter((d) => !d.is_test).length}{' '}
                prod,{' '}
                {impactReport.indirect_test_count ??
                  impactReport.indirect_dependents.filter((d) => d.is_test).length}{' '}
                test)
              </span>
            </h2>
            <span className="text-xs font-mono text-purple-300">Distance ≥ 2 hops</span>
          </div>

          {impactReport.indirect_dependents.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center bg-slate-950/40 rounded-xl border border-slate-800">
              No transitive multi-hop dependents found for{' '}
              <code className="font-mono">{impactReport.selected_file.name}</code>.
            </p>
          ) : (
            <div className="space-y-3">
              {impactReport.indirect_dependents.map((dep) => {
                const hasBrokenSymbols =
                  (dep.missing_symbols?.length ?? 0) > 0 ||
                  (dep.symbol_diagnostics?.length ?? 0) > 0;
                return (
                  <div
                    key={dep.file_path}
                    className={`rounded-xl border p-4 space-y-2 ${
                      hasBrokenSymbols
                        ? 'border-rose-500/40 bg-rose-950/15'
                        : 'border-purple-500/30 bg-purple-950/10'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold font-mono text-purple-200">{dep.file_path}</span>
                      <div className="flex items-center gap-1.5">
                        {hasBrokenSymbols && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">
                            Missing Export
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300">
                          {dep.distance} hops
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-300">
                      {dep.dependency_path.map((step, i) => (
                        <React.Fragment key={step}>
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                            {step.split('/').pop()}
                          </span>
                          {i < dep.dependency_path.length - 1 && (
                            <ArrowRight className="w-3.5 h-3.5 text-purple-400" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                    {dep.imported_symbols && dep.imported_symbols.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                        <span className="text-slate-400">Imported symbols:</span>
                        {dep.imported_symbols.map((sym) => {
                          const isMissing = dep.missing_symbols?.includes(sym);
                          return (
                            <span
                              key={sym}
                              className={`px-2 py-0.5 rounded border ${
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
                    <p className="text-xs text-slate-300 leading-relaxed">{dep.explanation}</p>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Suggested Tests Section */}
      <section className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-4">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-sky-400" />
          <span>4. Suggested Verification Tests ({impactReport.suggested_tests.length})</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {impactReport.suggested_tests.map((test, idx) => (
            <div
              key={`${test.recommended_name}-${idx}`}
              className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold font-mono text-white">
                  {test.recommended_name}
                </span>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                      test.exists_in_project
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {test.exists_in_project ? 'Exists in Project' : 'Recommended New Test'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-sky-300">
                    {test.priority} Priority
                  </span>
                </div>
              </div>
              {test.test_file && (
                <p className="text-[11px] font-mono text-slate-400">{test.test_file}</p>
              )}
              <p className="text-xs text-slate-300 leading-relaxed">{test.reason}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Analysis Limitations & Static Scope */}
      <section className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
          <Info className="w-4 h-4 text-sky-400" />
          <span>5. Static Analysis Scope & Limitations</span>
        </h2>
        <ul className="space-y-2 text-xs text-slate-400 leading-relaxed list-disc pl-5">
          {impactReport.limitations.map((lim, idx) => (
            <li key={idx}>{lim}</li>
          ))}
        </ul>
      </section>
    </div>
  );
};
