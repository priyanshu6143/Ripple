import React, { useRef, useState } from 'react';
import {
  FolderUp,
  FileArchive,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Download,
  Shield,
  Loader2,
  X,
} from 'lucide-react';
import { getSampleZipDownloadUrl } from '../api';

interface AnalyzeViewProps {
  isLoading: boolean;
  errorMessage: string | null;
  onClearError: () => void;
  onUploadZip: (file: File) => Promise<void>;
  onLoadSample: () => Promise<void>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export const AnalyzeView: React.FC<AnalyzeViewProps> = ({
  isLoading,
  errorMessage,
  onClearError,
  onUploadZip,
  onLoadSample,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  const handleFileCandidate = (file: File | undefined | null) => {
    onClearError();
    setLocalValidationError(null);
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setSelectedFile(null);
      setLocalValidationError(
        `Unsupported file "${file.name}". Please select a valid .zip archive containing .java, .js, .jsx, .ts, or .tsx source files.`
      );
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setLocalValidationError(`The selected archive "${file.name}" is empty (0 bytes).`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setSelectedFile(null);
      setLocalValidationError(
        `Archive "${file.name}" (${formatBytes(file.size)}) exceeds the 25 MB maximum upload size.`
      );
      return;
    }

    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    handleFileCandidate(droppedFile);
  };

  const handleSubmit = async () => {
    if (!selectedFile || isLoading) return;
    await onUploadZip(selectedFile);
  };

  const activeError = localValidationError || errorMessage;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Analyze a Software Project</h1>
        <p className="text-sm text-slate-400 mt-1">
          Upload a project `.zip` archive for deterministic static import resolution, or run the built-in
          sample microservice project.
        </p>
      </div>

      {/* Error Alert Banner */}
      {activeError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/50 bg-rose-950/40 p-4 flex items-start justify-between gap-3 text-rose-200"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm">
              <p className="font-semibold text-rose-300">Upload / Analysis Error</p>
              <p className="mt-0.5 text-rose-200/90">{activeError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setLocalValidationError(null);
              onClearError();
            }}
            className="text-rose-400 hover:text-rose-200 p-1"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Drag-and-Drop ZIP Upload Card */}
        <div className="lg:col-span-3 rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-6 flex flex-col justify-between space-y-5">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FolderUp className="w-4 h-4 text-sky-400" />
              <span>Upload Project ZIP Archive</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Supported source languages: Java (`.java`), TypeScript (`.ts`, `.tsx`), and JavaScript (`.js`, `.jsx`).
            </p>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all ${
              isDragging
                ? 'border-sky-400 bg-sky-500/10'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-700/80 hover:border-sky-500/50 bg-slate-950/50 hover:bg-slate-900/50'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              onChange={(e) => handleFileCandidate(e.target.files?.[0])}
            />

            {selectedFile ? (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <FileArchive className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-200 font-mono">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Size: {formatBytes(selectedFile.size)}
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready for static analysis
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-xs text-slate-400 hover:text-rose-300 underline ml-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto">
                  <FolderUp className="w-6 h-6 text-sky-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">
                    Drag & drop your project <code className="text-sky-300 font-mono">.zip</code> here
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    or click to browse local files (Max 25 MB)
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                >
                  Browse Files
                </button>
              </div>
            )}
          </div>

          {/* Progress / Action Footer */}
          <div className="space-y-3">
            {isLoading && (
              <div className="rounded-xl bg-sky-950/40 border border-sky-500/30 p-3.5 flex items-center gap-3 text-xs text-sky-200">
                <Loader2 className="w-4 h-4 text-sky-400 animate-spin shrink-0" />
                <div>
                  <p className="font-semibold">Running Static Dependency Analysis...</p>
                  <p className="text-sky-300/80">
                    Validating archive safety, parsing imports, and building directed graph...
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedFile || isLoading}
              onClick={handleSubmit}
              className="w-full py-3 px-5 rounded-xl font-semibold text-sm bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white shadow-lg shadow-sky-500/15 transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Analyzing Archive...</span>
                </>
              ) : (
                <>
                  <FolderUp className="w-4 h-4" />
                  <span>Upload and Analyze</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Built-in Sample Project & Security Assurances */}
        <div className="lg:col-span-2 space-y-5">
          <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-b from-purple-950/30 to-[#0B1020] p-6 space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[11px] font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Instant Demonstration Mode</span>
            </div>
            <h3 className="text-base font-semibold text-white">
              Try Built-In Sample Project
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              Loads <code className="text-purple-300 font-mono">acme-identity-service.zip</code>, a
              realistic multi-layered Java & TypeScript codebase containing{' '}
              <code className="font-mono text-slate-200">UserRepository.java</code>,{' '}
              <code className="font-mono text-slate-200">UserService.java</code>,{' '}
              <code className="font-mono text-slate-200">NotificationService.java</code>,{' '}
              <code className="font-mono text-slate-200">UserController.java</code>, and{' '}
              <code className="font-mono text-slate-200">UserServiceTest.java</code>.
            </p>
            <p className="text-[11px] text-slate-400">
              Passes through the exact same ZIP extraction and static dependency resolution engine as
              uploaded archives.
            </p>

            <div className="pt-1 space-y-2.5">
              <button
                type="button"
                disabled={isLoading}
                onClick={onLoadSample}
                className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-950/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load & Analyze Sample Project</span>
              </button>

              <a
                href={getSampleZipDownloadUrl()}
                download="acme-identity-service.zip"
                className="w-full py-2 px-4 rounded-xl font-medium text-xs bg-slate-900/90 hover:bg-slate-800 text-slate-300 border border-slate-700/80 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span>Download Sample .zip to Test Drag & Drop</span>
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0B1020]/90 p-5 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Sandbox & Security Guardrails</span>
            </h3>
            <ul className="text-xs text-slate-400 space-y-2 leading-relaxed">
              <li>• Uploaded code is parsed strictly as text and is never executed.</li>
              <li>• ZIP Slip / path traversal (`..`) and absolute paths are rejected.</li>
              <li>• Automatically ignores `.git`, `node_modules`, `dist`, `build`, and `target`.</li>
              <li>• Unresolved local imports are surfaced as transparent warnings.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
