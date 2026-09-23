import React from 'react';
import { Search, UploadCloud, FileText } from 'lucide-react';

interface HeaderProps {
  activeTab: 'search' | 'upload';
  setActiveTab: (tab: 'search' | 'upload') => void;
  documentCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <header className="sticky top-0 z-30 shadow-md">
      {/* Top Municipal Banner Header */}
      <div className="bg-slate-900 border-b border-slate-800 text-white py-3 sm:py-4 px-4 relative overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-center text-center bg-slate-900">
          <h2 
            className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-[0.16em] sm:tracking-[0.22em] uppercase text-white font-cinzel drop-shadow-md select-none"
            style={{ fontFamily: "'Cinzel', Georgia, serif" }}
          >
            Sangguniang Bayan ng Mutia
          </h2>
        </div>
      </div>

      {/* Main Navigation Header (LIS) - Header 2 */}
      <div className="bg-slate-900 border-b border-slate-800 text-white shadow-[0_8px_24px_-4px_rgba(0,0,0,0.45)] relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Brand & Identity */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-lg border border-blue-400/30 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Legislative Information System <span className="text-blue-400 font-semibold">(LIS)</span>
              </h1>
              <p className="text-xs text-slate-300 font-medium">
                Municipality of Mutia, Zamboanga del Norte
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
              <span>Upload Resolution</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
};
