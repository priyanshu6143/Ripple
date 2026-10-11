import React from 'react';
import {
  LayoutDashboard,
  FolderUp,
  GitFork,
  FileSpreadsheet,
  Info,
  Sparkles,
  RotateCcw,
  Activity,
} from 'lucide-react';
import { NavTab, ProjectSummary } from '../types';

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  activeProject: ProjectSummary | null;
  backendHealthy: boolean | null;
  onLoadSample: () => void;
  onResetSession: () => void;
  isLoading: boolean;
}

export const RippleLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => (
  <svg
    viewBox="0 0 44 44"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-label="Ripple Logo"
  >
    <defs>
      <linearGradient id="rippleGradPrimary" x1="4" y1="4" x2="40" y2="40" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" />
        <stop offset="55%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#A855F7" />
      </linearGradient>
      <linearGradient id="rippleGradGlow" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#A855F7" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    {/* Outer container ring */}
    <rect x="2" y="2" width="40" height="40" rx="11" fill="url(#rippleGradGlow)" stroke="url(#rippleGradPrimary)" strokeWidth="1.5" />
    {/* Concentric dependency ripple waves */}
    <circle cx="22" cy="22" r="14.5" stroke="url(#rippleGradPrimary)" strokeWidth="1.25" strokeDasharray="4 3" opacity="0.65" />
    <circle cx="22" cy="22" r="9.5" stroke="url(#rippleGradPrimary)" strokeWidth="1.5" opacity="0.9" />
    {/* Connected dependency edges */}
    <line x1="22" y1="22" x2="32.5" y2="12" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="22" y1="22" x2="11.5" y2="30.5" stroke="#A855F7" strokeWidth="1.6" strokeLinecap="round" />
    <line x1="22" y1="22" x2="33" y2="29.5" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
    {/* Central source node */}
    <circle cx="22" cy="22" r="4" fill="#38BDF8" />
    <circle cx="22" cy="22" r="2" fill="#FFFFFF" />
    {/* Satellite dependent nodes */}
    <circle cx="32.5" cy="12" r="2.6" fill="#38BDF8" stroke="#060913" strokeWidth="1" />
    <circle cx="11.5" cy="30.5" r="2.6" fill="#A855F7" stroke="#060913" strokeWidth="1" />
    <circle cx="33" cy="29.5" r="2.4" fill="#818CF8" stroke="#060913" strokeWidth="1" />
  </svg>
);

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onSelectTab,
  activeProject,
  backendHealthy,
  onLoadSample,
  onResetSession,
  isLoading,
}) => {
  const navItems: { id: NavTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'analyze', label: 'Analyze Project', icon: <FolderUp className="w-4 h-4" /> },
    {
      id: 'graph',
      label: 'Dependency Graph',
      icon: <GitFork className="w-4 h-4" />,
      badge: activeProject ? String(activeProject.total_files) : undefined,
    },
    { id: 'reports', label: 'Reports', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'about', label: 'About Ripple', icon: <Info className="w-4 h-4" /> },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#070B16]/90 backdrop-blur-md">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className="flex items-center gap-3 text-left group focus:outline-none"
          >
            <RippleLogo className="w-9 h-9 transition-transform duration-200 group-hover:scale-105" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-sky-200 to-purple-300 bg-clip-text text-transparent">
                  Ripple
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/25">
                  Static Impact Engine
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden md:block">
                Understand the impact before you change the code.
              </p>
            </div>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex items-center gap-1 overflow-x-auto py-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-sky-500/20 to-purple-500/20 text-sky-200 border border-sky-500/40 shadow-sm shadow-sky-950/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                }`}
              >
                <span className={isActive ? 'text-sky-400' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
                {item.badge && (
                  <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions & Status */}
        <div className="flex items-center gap-2.5">
          {activeProject ? (
            <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Project:</span>
              <span className="font-mono text-slate-200 font-medium truncate max-w-[160px]">
                {activeProject.project_name}
              </span>
              <button
                type="button"
                onClick={onResetSession}
                title="Start a new analysis or switch project"
                className="ml-1 text-slate-400 hover:text-sky-300 transition-colors p-0.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={isLoading}
              onClick={onLoadSample}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/15 hover:bg-purple-500/25 text-purple-200 border border-purple-500/30 transition-all disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Try Sample Project</span>
            </button>
          )}

          {/* API Health Indicator */}
          <div
            title={
              backendHealthy === null
                ? 'Checking backend API status...'
                : backendHealthy
                ? 'FastAPI Backend Connected (GET /api/health OK)'
                : 'Backend API unreachable'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono border ${
              backendHealthy === null
                ? 'bg-slate-900/80 border-slate-800 text-slate-400'
                : backendHealthy
                ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/50 border-rose-500/40 text-rose-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden md:inline">
              {backendHealthy === null ? 'API...' : backendHealthy ? 'API Online' : 'API Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
