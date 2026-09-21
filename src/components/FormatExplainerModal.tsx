import React from 'react';
import { X, CheckCircle2, AlertTriangle, ArrowRight, Shield, Database, Sparkles } from 'lucide-react';

interface FormatExplainerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FormatExplainerModal: React.FC<FormatExplainerModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 rounded-t-2xl flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Standardized Legislative Title Format</h2>
              <p className="text-xs text-slate-400">Legislative Information System (LIS) Indexing Specification</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 text-sm text-slate-700">
          {/* Rule Box */}
          <div className="p-4 rounded-xl bg-blue-50/80 border border-blue-200">
            <h3 className="font-semibold text-blue-950 flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Mandatory Syntax Formula
            </h3>
            <div className="p-3 bg-white rounded-lg border border-blue-200/80 font-mono text-xs sm:text-sm text-blue-900 font-semibold shadow-inner">
              [Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]
            </div>
            <p className="mt-2 text-xs text-blue-800">
              Example Standard Format:
            </p>
            <p className="font-mono text-xs text-slate-800 bg-white/70 p-2 rounded border border-blue-100 mt-1">
              Resolution No. 2026-045: A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES
            </p>
          </div>

          {/* Normalization Rules */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-600" />
              Title Normalization Engine Rules
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  1
                </span>
                <div>
                  <p className="font-medium text-slate-900">Strip Non-Alphanumerics & Whitespace</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Strips redundant double spaces, trailing periods, semicolons, and non-alphanumeric punctuation. Converts to an uppercase, unpunctuated representation (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">normalized_title</code>) to ensure clean exact matches without typographic noise.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200/70">
                <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                  2
                </span>
                <div>
                  <p className="font-medium text-slate-900">Separate Series Header from Subject Title</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Isolates the <strong>Document Series Header</strong> (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">Resolution No. 2026-045</code>) from the <strong>Subject Title</strong> (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">A RESOLUTION AUTHORIZING...</code>) into dedicated database columns and separate GIN search vectors.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 3-Tier Ranking Table */}
          <div>
            <h3 className="font-semibold text-slate-900 mb-2">Priority Ranking & Relevance Tiers</h3>
            <div className="overflow-hidden rounded-xl border border-slate-200 text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Priority</th>
                    <th className="p-2.5">Criteria</th>
                    <th className="p-2.5">Score Range</th>
                    <th className="p-2.5">Database Mechanism</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="p-2.5 font-semibold text-emerald-700 bg-emerald-50/50">Priority 1</td>
                    <td className="p-2.5">Exact Series (e.g. 2026-045) or Exact Title Match</td>
                    <td className="p-2.5 font-mono font-bold text-emerald-600">100%</td>
                    <td className="p-2.5 text-slate-600">B-Tree Exact / Quoted Phrase Match</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-blue-700 bg-blue-50/50">Priority 2</td>
                    <td className="p-2.5">Title Word Order Match & Boolean AND/OR</td>
                    <td className="p-2.5 font-mono font-bold text-blue-600">75% - 95%</td>
                    <td className="p-2.5 text-slate-600">Monotonic positional scan & ts_rank</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-amber-700 bg-amber-50/50">Priority 3</td>
                    <td className="p-2.5">Fuzzy Match in Title (typos / trigram)</td>
                    <td className="p-2.5 font-mono font-bold text-amber-600">40% - 70%</td>
                    <td className="p-2.5 text-slate-600">pg_trgm trigram similarity &gt; 0.35</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-semibold text-purple-700 bg-purple-50/50">Full-Text</td>
                    <td className="p-2.5">Body OCR Match (Only when explicitly toggled)</td>
                    <td className="p-2.5 font-mono font-bold text-purple-600">45%</td>
                    <td className="p-2.5 text-slate-600">body_search_vector @@ plainto_tsquery</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-slate-900 text-white font-medium text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
