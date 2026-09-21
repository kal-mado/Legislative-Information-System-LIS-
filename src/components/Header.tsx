import React from 'react';
import { Search, UploadCloud, Database, FileText, CheckCircle2, ShieldCheck, Sparkles, BookOpen } from 'lucide-react';

interface HeaderProps {
  activeTab: 'search' | 'upload' | 'architecture';
  setActiveTab: (tab: 'search' | 'upload' | 'architecture') => void;
  documentCount: number;
  onOpenFormatGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  documentCount,
  onOpenFormatGuide,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-30 shadow-md">
      {/* Top Meta Bar */}
      <div className="bg-slate-950/80 border-b border-slate-800/80 px-4 py-1.5 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-medium">
              <ShieldCheck className="w-3 h-3" />
              SANGGUNIAN OFFICIAL ARCHIVE
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline">Legislative Management Information System (LIS)</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>PostgreSQL + pg_trgm Engine:</span>
              <span className="font-semibold text-emerald-400">{documentCount} Measures Indexed</span>
            </div>
            <button
              onClick={onOpenFormatGuide}
              className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              Title Standard Rules
            </button>
          </div>
        </div>
      </div>

      {/* Main Navigation Header */}
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg border border-blue-400/30 flex-shrink-0">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                LegisTrack <span className="text-blue-400 font-semibold">LIS</span>
              </h1>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-900/60 text-blue-300 border border-blue-700/50">
                v2.6 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Precision Legislative Repository • Resolutions & Ordinances
            </p>
          </div>
        </div>

        {/* Primary Tabs */}
        <nav className="flex items-center gap-1 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800">
          <button
            id="tab-title-search"
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'search'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-4 h-4" />
            <span>Title Precision Search</span>
          </button>

          <button
            id="tab-upload-review"
            onClick={() => setActiveTab('upload')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'upload'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload & OCR Review</span>
          </button>

          <button
            id="tab-architecture-specs"
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer ${
              activeTab === 'architecture'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>System Architecture & SQL</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
