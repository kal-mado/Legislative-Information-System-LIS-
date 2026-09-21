import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, SlidersHorizontal, ArrowUpDown, Filter, Sparkles, AlertCircle, 
  CheckCircle2, FileText, Calendar, User, Tag, ExternalLink, Zap, 
  BookOpen, ChevronRight, X, Layers, ShieldCheck
} from 'lucide-react';
import { LegislativeDocument, SearchPriority, SearchResultItem, SearchQueryFilters } from '../types';
import { rankDocumentForQuery } from '../utils/titleEngine';

interface PrecisionSearchModuleProps {
  documents: LegislativeDocument[];
  onSelectDocument: (item: SearchResultItem) => void;
  onOpenFormatGuide: () => void;
  onSwitchToUpload: () => void;
}

export const PrecisionSearchModule: React.FC<PrecisionSearchModuleProps> = ({
  documents,
  onSelectDocument,
  onOpenFormatGuide,
  onSwitchToUpload,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullText, setIsFullText] = useState(false);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('');
  const [selectedDocType, setSelectedDocType] = useState<'ALL' | 'Resolution' | 'Ordinance'>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'relevance' | 'date_desc' | 'date_asc' | 'number_asc'>('relevance');

  // Quick Prefix List
  const PREFIX_OPTIONS = [
    { label: 'All Document Prefixes', value: '' },
    { label: 'A RESOLUTION AUTHORIZING...', value: 'A RESOLUTION AUTHORIZING' },
    { label: 'A RESOLUTION APPROVING...', value: 'A RESOLUTION APPROVING' },
    { label: 'A RESOLUTION ACCREDITING...', value: 'A RESOLUTION ACCREDITING' },
    { label: 'A RESOLUTION FAVORABLY ENDORSING...', value: 'A RESOLUTION FAVORABLY ENDORSING' },
    { label: 'AN ORDINANCE REGULATING...', value: 'AN ORDINANCE REGULATING' },
    { label: 'AN ORDINANCE ENACTING...', value: 'AN ORDINANCE ENACTING' },
  ];

  // Quick Preset Queries to easily test the system
  const PRESET_QUERIES = [
    { label: 'Exact Series: 2026-045', query: '2026-045', desc: 'Triggers Priority 1 Series Match (100%)' },
    { label: 'Quoted: "Health Services"', query: '"Health Services"', desc: 'Triggers Priority 1 Title Phrase Match' },
    { label: 'Boolean: Health AND Agreement', query: 'Health AND Agreement', desc: 'Triggers Priority 2 Boolean AND Match' },
    { label: 'Word Order: Disaster Risk Reduction', query: 'Disaster Risk Reduction', desc: 'Triggers Priority 2 Monotonic Title Sequence' },
    { label: 'Fuzzy / Typo: Heatlh Servces', query: 'Heatlh Servces', desc: 'Triggers Priority 3 pg_trgm Trigram Match' },
  ];

  // Execute Ranking Engine
  const searchResults = useMemo(() => {
    let pool = documents;

    // Filter by Type
    if (selectedDocType !== 'ALL') {
      pool = pool.filter(d => d.doc_type === selectedDocType);
    }
    // Filter by Year
    if (selectedYear !== 'ALL') {
      const yr = parseInt(selectedYear, 10);
      pool = pool.filter(d => d.series_year === yr);
    }

    // Rank documents
    const results: SearchResultItem[] = [];
    for (const doc of pool) {
      const ranked = rankDocumentForQuery(doc, searchQuery, isFullText, selectedPrefix);
      if (ranked) {
        results.push(ranked);
      }
    }

    // Sort Results
    results.sort((a, b) => {
      if (sortBy === 'relevance') {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return b.score - a.score;
      } else if (sortBy === 'date_desc') {
        return new Date(b.document.date_approved).getTime() - new Date(a.document.date_approved).getTime();
      } else if (sortBy === 'date_asc') {
        return new Date(a.document.date_approved).getTime() - new Date(b.document.date_approved).getTime();
      } else {
        return a.document.resolution_number.localeCompare(b.document.resolution_number);
      }
    });

    return results;
  }, [documents, searchQuery, isFullText, selectedPrefix, selectedDocType, selectedYear, sortBy]);

  // Highlight helper
  const highlightMatches = (text: string, query: string) => {
    if (!query.trim()) return text;
    const cleanQ = query.replace(/["]/g, '').trim();
    const words = cleanQ.split(/\s+/).filter(w => w.toUpperCase() !== 'AND' && w.toUpperCase() !== 'OR' && w.length > 1);
    if (words.length === 0) return text;

    try {
      const pattern = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
      const parts = text.split(pattern);
      return (
        <span>
          {parts.map((part, i) =>
            pattern.test(part) ? (
              <mark key={i} className="bg-amber-200 text-amber-950 font-semibold px-0.5 rounded">
                {part}
              </mark>
            ) : (
              part
            )
          )}
        </span>
      );
    } catch {
      return text;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-800 text-xs font-bold font-mono tracking-wider">
                CORE MODULE 3
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans tracking-tight">
                Title-Based Precision Search Engine
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Strictly prioritizes the <strong>Title Field</strong> and <strong>Resolution Series</strong> to prevent noisy or irrelevant search results from matching arbitrary body text.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenFormatGuide}
              className="px-3.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-blue-600" />
              Standard Syntax
            </button>
            <button
              onClick={onSwitchToUpload}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Upload & Scan
            </button>
          </div>
        </div>

        {/* Primary Search Input Box */}
        <div className="mt-5 space-y-3">
          <div className="relative flex items-center">
            <div className="absolute left-4 text-slate-400 pointer-events-none">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <input
              id="precision-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search resolutions e.g., 'Health Services', 2026-045, Health AND Agreement..."
              className="w-full pl-12 pr-28 py-3.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm sm:text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-24 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                title="Clear query"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => {}}
              className="absolute right-2.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow cursor-pointer"
            >
              Search
            </button>
          </div>

          {/* Quick Syntax Presets */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium mr-1 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Try Precision Criteria:
            </span>
            {PRESET_QUERIES.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setSearchQuery(preset.query)}
                className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer text-[11px]"
                title={preset.desc}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Mode & Prefix Control Bar */}
        <div className="mt-5 pt-4 border-t border-slate-200/70 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          {/* Targeted Title Search vs Full-Text Mode Switch */}
          <div className="lg:col-span-5 p-2 rounded-xl bg-slate-100/80 border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${!isFullText ? 'bg-emerald-500' : 'bg-purple-500'}`}></span>
              <div>
                <span className="text-xs font-bold text-slate-900">
                  {!isFullText ? 'Targeted Title Search' : 'Full-Text Search Mode'}
                </span>
                <p className="text-[10px] text-slate-500">
                  {!isFullText ? 'Restricted to title & series (Zero body noise)' : 'Includes document body OCR text'}
                </p>
              </div>
            </div>

            <button
              id="toggle-full-text-mode"
              onClick={() => setIsFullText(!isFullText)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isFullText
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
              }`}
            >
              {isFullText ? 'Full-Text Active' : 'Enable Full-Text'}
            </button>
          </div>

          {/* Prefix Filter Dropdown */}
          <div className="lg:col-span-4 flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <select
              id="prefix-filter-select"
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
            >
              {PREFIX_OPTIONS.map((opt, i) => (
                <option key={i} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Facets & Sort */}
          <div className="lg:col-span-3 flex items-center gap-2 justify-end">
            <select
              value={selectedDocType}
              onChange={(e) => setSelectedDocType(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="Resolution">Resolutions</option>
              <option value="Ordinance">Ordinances</option>
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Years</option>
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="relevance">Sort: Score</option>
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="number_asc">Series No.</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results Header Info Bar */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{searchResults.length}</span>
          <span>measures matched</span>
          {searchQuery && (
            <span>
              for <strong className="text-blue-700">"{searchQuery}"</strong>
            </span>
          )}
          {selectedPrefix && (
            <span className="bg-slate-200 px-2 py-0.5 rounded text-[11px]">
              Prefix: {selectedPrefix}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Priority 1: Exact
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span> Priority 2: Word Order
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span> Priority 3: Fuzzy
          </span>
        </div>
      </div>

      {/* Search Results List */}
      <div className="space-y-3">
        {searchResults.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Search className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800">No Legislative Measures Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Your title-focused query did not match any standardized resolution or ordinance titles in the active catalog.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Clear Search Filter
              </button>
              <button
                onClick={() => setIsFullText(true)}
                className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Try Full-Text OCR Mode
              </button>
            </div>
          </div>
        ) : (
          searchResults.map((item) => {
            const doc = item.document;
            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(item)}
                className="bg-white rounded-xl p-4 sm:p-5 border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group relative overflow-hidden"
              >
                {/* Priority Top Edge Accent */}
                <div
                  className={`absolute top-0 left-0 right-0 h-1 ${
                    item.priority === 1
                      ? 'bg-emerald-500'
                      : item.priority === 2
                      ? 'bg-blue-500'
                      : item.priority === 3
                      ? 'bg-amber-500'
                      : 'bg-purple-500'
                  }`}
                />

                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  {/* Left Column: Number and Titles */}
                  <div className="space-y-1.5 flex-1">
                    {/* Header Row: Series Number & Priority Badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs sm:text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {highlightMatches(doc.resolution_number, searchQuery)}
                      </span>

                      {/* Priority Ranking Pill */}
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          item.priority === 1
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : item.priority === 2
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : item.priority === 3
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-purple-100 text-purple-800 border border-purple-300'
                        }`}
                      >
                        {item.priority === 1 && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {item.priorityLabel} ({item.score}%)
                      </span>

                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs text-slate-500 font-medium">
                        Approved: {doc.date_approved}
                      </span>
                    </div>

                    {/* Verbatim Resolution Title with highlights */}
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-700 transition-colors leading-snug">
                      {highlightMatches(doc.resolution_title, searchQuery)}
                    </h3>

                    {/* Matched Criteria Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {item.matchedCriteria.map((crit, cIdx) => (
                        <span
                          key={cIdx}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                        >
                          ✓ {crit}
                        </span>
                      ))}
                    </div>

                    {/* Full-Text snippet if applicable */}
                    {item.bodyMatchSnippet && (
                      <div className="mt-2 p-2 rounded-lg bg-purple-50/80 border border-purple-200 text-xs text-purple-900 font-mono">
                        <span className="font-sans font-semibold text-purple-700 mr-1">[Body OCR Match]:</span>
                        {item.bodyMatchSnippet}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Metadata & Details Action */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 flex-shrink-0 pt-2 sm:pt-0">
                    <div className="text-right hidden sm:block">
                      <span className="text-[11px] font-mono text-slate-500 block">
                        Series #{doc.series_number_only}
                      </span>
                      <span className="text-[11px] text-slate-400 block truncate max-w-[150px]">
                        {doc.file_name}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-800">
                      <span>Inspect Record</span>
                      <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* Footer Metadata Row */}
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-medium text-slate-700 truncate max-w-[280px]">
                      {doc.author_sponsors.slice(0, 2).join(', ')}
                      {doc.author_sponsors.length > 2 && ` +${doc.author_sponsors.length - 2} more`}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {doc.keywords.slice(0, 3).map((kw, kIdx) => (
                      <span key={kIdx} className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
