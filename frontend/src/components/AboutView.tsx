import React from 'react';
import {
  GitFork,
  ShieldCheck,
  Code2,
  Layers,
  AlertCircle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { NavTab } from '../types';

interface AboutViewProps {
  onNavigate: (tab: NavTab) => void;
  onLoadSample: () => void;
}

export const AboutView: React.FC<AboutViewProps> = ({ onNavigate, onLoadSample }) => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0D152B] via-[#0B1020] to-[#130F29] p-7 space-y-3">
        <h1 className="text-2xl font-bold text-white">About Ripple</h1>
        <p className="text-sm text-slate-300 leading-relaxed">
          <strong>Ripple</strong> is a deterministic static code-analysis tool designed to help
          software engineers understand how changes to a single source file propagate through a
          project's dependency graph before committing code.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-3">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm">
            <GitFork className="w-4 h-4" />
            <h2>Graph Direction & Edge Semantics</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            In Ripple's dependency graph, a directed edge{' '}
            <code className="font-mono text-sky-300">A → B</code> means{' '}
            <strong>File A imports (depends on) File B</strong>.
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            When you select <strong>File B</strong> as the changed file, impact flows in the{' '}
            <strong>reverse direction</strong> (<code className="font-mono text-amber-300">B ← A ← C</code>):
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>
              <strong className="text-amber-300">Direct Dependents (1 hop)</strong>: Files like{' '}
              <code>A</code> that directly import <code>B</code>.
            </li>
            <li>
              <strong className="text-purple-300">Indirect Dependents (2+ hops)</strong>: Files like{' '}
              <code>C</code> that import <code>A</code>, which in turn imports <code>B</code>.
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-3">
          <div className="flex items-center gap-2 text-purple-400 font-semibold text-sm">
            <Code2 className="w-4 h-4" />
            <h2>Supported Languages & Resolution</h2>
          </div>
          <ul className="text-xs text-slate-300 space-y-2 leading-relaxed">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>TypeScript & JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)</strong>: Strips line
                and block comments, extracts ES module <code>import</code> / <code>export ... from</code>{' '}
                and CommonJS <code>require()</code> specifiers, and resolves relative paths, index
                files, and project aliases.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Java (`.java`)</strong>: Extracts <code>package</code> and{' '}
                <code>import</code> declarations, resolves fully-qualified class names and wildcard
                package imports, and detects same-package class references.
              </span>
            </li>
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Layers className="w-4 h-4" />
            <h2>Cycle-Safe Transitive Traversal & Risk</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ripple traverses reverse dependency edges using Breadth-First Search (BFS) with an
            explicit visited set and path tracker. This guarantees shortest-hop dependency chains
            and prevents infinite loops even when circular dependencies exist (`A → B → C → A`).
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Risk scores (`0–100`, mapped to `Low`, `Medium`, `High`) are computed transparently from
            direct production dependent counts, transitive blast radius percentage, architectural
            layer classification, and linked test coverage.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <h2>Honest Static Analysis Boundaries</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Ripple performs deterministic static source analysis. It does not invoke external paid
            LLMs, execute uploaded code, or claim guaranteed bug detection.
          </p>
          <ul className="text-xs text-slate-400 space-y-1.5 list-disc pl-4">
            <li>Runtime reflection or string-built dynamic imports cannot be statically resolved.</li>
            <li>Cross-language HTTP/RPC boundaries (e.g., TS frontend calling Java REST endpoints) are decoupled at the import level.</li>
            <li>Unresolved local imports are reported as warnings rather than fabricated edges.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 text-sky-400 shrink-0" />
          <div>
            <h3 className="text-sm font-semibold text-white">Ready to explore Ripple?</h3>
            <p className="text-xs text-slate-400">
              Try the built-in multi-file sample project or upload your own ZIP archive.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Load Sample Project</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analyze')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
          >
            <span>Upload ZIP</span>
          </button>
        </div>
      </div>
    </div>
  );
};
