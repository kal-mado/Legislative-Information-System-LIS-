import React, { useState } from 'react';
import { X, FileText, Calendar, User, Tag, HardDrive, CheckCircle2, Shield, Copy, Check, Code, Eye, FileSpreadsheet, Trash2 } from 'lucide-react';
import { LegislativeDocument, SearchResultItem } from '../types';

interface DocumentDetailModalProps {
  item: SearchResultItem | null;
  onClose: () => void;
  onDeleteDocument?: (id: string) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ item, onClose, onDeleteDocument }) => {
  const [activeTab, setActiveTab] = useState<'details' | 'ocr' | 'database' | 'diagnostics'>('details');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!item) return null;
  const doc = item.document;

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const sqlInsertPreview = `INSERT INTO legislative_documents (
  id, doc_type, resolution_number, series_header, series_year,
  series_number_only, resolution_title, subject_title, normalized_title,
  keywords, date_passed, date_approved, author_sponsors, file_path, file_name,
  file_size_bytes, mime_type, classification_status, ocr_fulltext, ocr_confidence
) VALUES (
  '${doc.id}',
  '${doc.doc_type}',
  '${doc.resolution_number}',
  '${doc.series_header}',
  ${doc.series_year},
  '${doc.series_number_only}',
  '${doc.resolution_title.replace(/'/g, "''")}',
  '${doc.subject_title.replace(/'/g, "''")}',
  '${doc.normalized_title.replace(/'/g, "''")}',
  ARRAY[${doc.keywords.map(k => `'${k.replace(/'/g, "''")}'`).join(', ')}],
  '${doc.date_passed}',
  '${doc.date_approved}',
  ARRAY[${doc.author_sponsors.map(a => `'${a.replace(/'/g, "''")}'`).join(', ')}],
  '${doc.file_path}',
  '${doc.file_name}',
  ${doc.file_size_kb * 1024},
  '${doc.mime_type}',
  '${doc.classification_status}',
  '${(doc.ocr_fulltext || '').slice(0, 80).replace(/'/g, "''")}...',
  ${doc.ocr_confidence || 98.0}
);`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono tracking-wide ${
              doc.doc_type === 'Ordinance'
                ? 'bg-purple-900/80 text-purple-300 border border-purple-700/50'
                : 'bg-blue-900/80 text-blue-300 border border-blue-700/50'
            }`}>
              {doc.doc_type.toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm sm:text-base font-bold text-blue-400">
                  {doc.resolution_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium">
                  {doc.classification_status}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white mt-1 leading-snug font-sans">
                {doc.subject_title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-4 pt-2 border-b border-slate-200 flex items-center gap-2 text-xs sm:text-sm">
          <button
            onClick={() => setActiveTab('details')}
            className={`px-3 py-2 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'details'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FileText className="w-4 h-4" />
              Document Record
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ocr')}
            className={`px-3 py-2 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'ocr'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4" />
              OCR Full-Text ({doc.ocr_confidence ? `${doc.ocr_confidence}%` : 'Digitized'})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-2 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              Search Score Breakdown
            </span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-2 font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'database'
                ? 'border-blue-600 text-blue-600 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Code className="w-4 h-4" />
              SQL Schema Row
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 text-sm">
          {/* TAB 1: DETAILS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Title & Normalization Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Verbatim Standard Title
                  </span>
                  <button
                    onClick={() => handleCopy(doc.resolution_title, 'title')}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'title' ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="font-mono text-xs sm:text-sm text-slate-900 font-semibold bg-white p-3 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                  {doc.resolution_title}
                </p>

                {/* Normalized Title comparison */}
                <div className="mt-3 pt-3 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      Cleaned Normalized Title Index (Unpunctuated)
                    </span>
                    <button
                      onClick={() => handleCopy(doc.normalized_title, 'norm')}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      {copiedField === 'norm' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'norm' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-indigo-950 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 break-words">
                    {doc.normalized_title}
                  </p>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Legislative Timeline & Identifiers
                  </h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">UUID Primary Key:</span>
                    <span className="font-mono text-slate-800 text-[11px] truncate max-w-[200px]" title={doc.id}>
                      {doc.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Date Passed:</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {doc.date_passed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Date Approved:</span>
                    <span className="font-medium text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {doc.date_approved}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-500">Series Year / Sequence:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {doc.series_year} — #{doc.series_number_only}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Storage & Audit Records
                  </h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">Physical Storage Path:</span>
                    <span className="font-mono text-blue-700 text-[11px] truncate max-w-[220px]" title={doc.file_path}>
                      {doc.file_path}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">File Name & Size:</span>
                    <span className="text-slate-800 text-xs">
                      {doc.file_name} ({doc.file_size_kb} KB)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100">
                    <span className="text-slate-500">MIME Type:</span>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {doc.mime_type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-500">OCR Extraction Confidence:</span>
                    <span className="font-bold text-emerald-600">
                      {doc.ocr_confidence ? `${doc.ocr_confidence}%` : '98.0%'} (Tesseract/Gemini)
                    </span>
                  </div>
                </div>
              </div>

              {/* Authors & Sponsors */}
              <div className="p-3.5 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" />
                  Authors, Sponsors & Committee
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {doc.author_sponsors.map((author, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-medium border border-blue-200">
                      {author}
                    </span>
                  ))}
                  {doc.committee_referral && (
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs border border-slate-300">
                      {doc.committee_referral}
                    </span>
                  )}
                </div>
              </div>

              {/* Keywords */}
              <div className="p-3.5 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  Indexed Subject Keywords
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {doc.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs border border-indigo-200 font-medium">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: OCR FULL-TEXT */}
          {activeTab === 'ocr' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Optical Character Recognition (OCR) Status: <strong>Digitized & Indexed</strong></span>
                </div>
                <span className="font-mono font-bold">Confidence: {doc.ocr_confidence || 98.4}%</span>
              </div>

              <div className="relative">
                <div className="absolute right-3 top-3">
                  <button
                    onClick={() => handleCopy(doc.ocr_fulltext, 'ocr')}
                    className="px-2.5 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-700 flex items-center gap-1 cursor-pointer shadow"
                  >
                    {copiedField === 'ocr' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedField === 'ocr' ? 'Copied' : 'Copy Text'}
                  </button>
                </div>
                <pre className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[380px] border border-slate-800">
                  {doc.ocr_fulltext || 'No OCR body text stored for this record.'}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS */}
          {activeTab === 'diagnostics' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2">Search Relevance Evaluation</h4>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                    item.priority === 1 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                    item.priority === 2 ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                    item.priority === 3 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                    'bg-purple-100 text-purple-800 border border-purple-300'
                  }`}>
                    {item.priorityLabel}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-xs">
                    <span className="text-slate-500">Calculated Score:</span>
                    <span className="font-bold text-slate-900 text-sm">{item.score}%</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-semibold text-slate-600">Matched Rules & Clauses:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.matchedCriteria.map((c, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-white text-slate-800 text-xs border border-slate-200 font-medium">
                        ✓ {c}
                      </span>
                    ))}
                  </div>
                </div>

                {item.bodyMatchSnippet && (
                  <div className="mt-3 p-3 rounded bg-purple-50 border border-purple-200 text-xs text-purple-900">
                    <span className="font-bold">Full-Text Body Snippet:</span>
                    <p className="font-mono mt-1 text-slate-700 bg-white/70 p-2 rounded">{item.bodyMatchSnippet}</p>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-600">
                <p className="font-semibold text-slate-900">Search Engine Architecture Notes:</p>
                <p>
                  • <strong>Targeted Title Search:</strong> Evaluates queries exclusively against <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">resolution_title</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">resolution_number</code>, and <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">normalized_title</code>.
                </p>
                <p>
                  • <strong>Anti-Noise Guarantee:</strong> By separating body OCR from the primary title index, legislative searches for terms like <em>"Health Services"</em> return resolutions genuinely titled for health authorization, rather than every routine ordinance containing passing mentions in section bodies.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: DATABASE SQL */}
          {activeTab === 'database' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>Relational PostgreSQL Record Payload:</span>
                <button
                  onClick={() => handleCopy(sqlInsertPreview, 'sql')}
                  className="px-2.5 py-1 rounded bg-slate-800 text-white text-xs hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  {copiedField === 'sql' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedField === 'sql' ? 'Copied' : 'Copy SQL'}
                </button>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed border border-slate-800 max-h-[360px]">
                {sqlInsertPreview}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>Legislative Record ID: {doc.id.slice(0, 18)}...</span>
            {onDeleteDocument && (
              <button
                type="button"
                onClick={() => {
                  onDeleteDocument(doc.id);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                title="Remove this resolution from catalog"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove Resolution</span>
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Document
          </button>
        </div>
      </div>
    </div>
  );
};
