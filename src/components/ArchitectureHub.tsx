import React, { useState } from 'react';
import { 
  Database, GitBranch, Terminal, Layout, Copy, Check, 
  Code, ShieldCheck, Cpu, ArrowRight, CheckCircle2, Layers,
  ExternalLink, Sparkles, BookOpen
} from 'lucide-react';
import { 
  DATABASE_SCHEMA_SQL, 
  FILE_PROCESSING_WORKFLOW_STEPS, 
  TITLE_SEARCH_SQL_QUERY 
} from '../data/architectureDocs';

export const ArchitectureHub: React.FC = () => {
  const [activeDeliverable, setActiveDeliverable] = useState<'schema' | 'workflow' | 'search_sql' | 'wireframes'>('schema');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-bold font-mono tracking-wider">
                ARCHITECTURAL DELIVERABLES
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans tracking-tight">
                System Specifications & Engineering Deliverables
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Complete production-grade technical specifications for the Legislative Information System (LIS), including Relational PostgreSQL DDL, Asynchronous Ingestion State Machines, and Trigram Search Engine Queries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              PostgreSQL 15+ & pg_trgm
            </span>
          </div>
        </div>

        {/* Deliverables Switcher Tabs */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveDeliverable('schema')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeDeliverable === 'schema'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>1. Database Schema (SQL)</span>
          </button>

          <button
            onClick={() => setActiveDeliverable('workflow')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeDeliverable === 'workflow'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>2. File Processing Workflow</span>
          </button>

          <button
            onClick={() => setActiveDeliverable('search_sql')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeDeliverable === 'search_sql'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>3. Title Search Engine SQL</span>
          </button>

          <button
            onClick={() => setActiveDeliverable('wireframes')}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 cursor-pointer ${
              activeDeliverable === 'wireframes'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>4. UI Wireframe Specifications</span>
          </button>
        </div>
      </div>

      {/* DELIVERABLE 1: DATABASE SCHEMA (SQL) */}
      {activeDeliverable === 'schema' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-600" />
                  PostgreSQL Production DDL (legislative_documents)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Stores resolutions and ordinances with deterministic normalized titles, generated tsvectors, and pg_trgm indices.
                </p>
              </div>

              <button
                onClick={() => handleCopy(DATABASE_SCHEMA_SQL, 'schema_sql')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copiedCode === 'schema_sql' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedCode === 'schema_sql' ? 'Copied SQL' : 'Copy DDL'}
              </button>
            </div>

            {/* SQL Code Block */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="bg-slate-900 px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-800 flex items-center justify-between">
                <span>01_init_legislative_documents.sql</span>
                <span className="text-[11px] text-emerald-400">PostgreSQL 15+ Target</span>
              </div>
              <pre className="p-4 text-slate-100 font-mono text-xs overflow-x-auto leading-relaxed max-h-[500px]">
                <code>{DATABASE_SCHEMA_SQL}</code>
              </pre>
            </div>

            {/* Schema Field Explanations Table */}
            <div className="mt-6 pt-4 border-t border-slate-200">
              <h4 className="font-bold text-slate-900 text-sm mb-3">Required Schema Columns & Indexing Rationale</h4>
              <div className="overflow-x-auto rounded-xl border border-slate-200 text-xs">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-3">Column Name</th>
                      <th className="p-3">Data Type</th>
                      <th className="p-3">Indexing Strategy</th>
                      <th className="p-3">Functional Purpose</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">id</td>
                      <td className="p-3 font-mono text-slate-600">UUID</td>
                      <td className="p-3 text-slate-600">Primary Key (B-Tree)</td>
                      <td className="p-3 text-slate-700">Global immutable identifier across distributed regional repositories.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">resolution_number</td>
                      <td className="p-3 font-mono text-slate-600">VARCHAR(64)</td>
                      <td className="p-3 text-slate-600">UNIQUE B-Tree + Trigram GIN</td>
                      <td className="p-3 text-slate-700">Standardized series identifier e.g., "Resolution No. 2026-045".</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">resolution_title</td>
                      <td className="p-3 font-mono text-slate-600">TEXT</td>
                      <td className="p-3 text-slate-600">Full-text GIN (title_search_vector)</td>
                      <td className="p-3 text-slate-700">Full verbatim title as officially enrolled and approved.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-indigo-700">normalized_title</td>
                      <td className="p-3 font-mono text-slate-600">TEXT</td>
                      <td className="p-3 font-semibold text-emerald-700">GIN (normalized_title gin_trgm_ops)</td>
                      <td className="p-3 text-slate-700">Cleaned, unpunctuated uppercase string for exact & fuzzy trigram matching.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">keywords</td>
                      <td className="p-3 font-mono text-slate-600">TEXT[]</td>
                      <td className="p-3 text-slate-600">GIN Index</td>
                      <td className="p-3 text-slate-700">Subject taxonomy tags for rapid faceted topic filtering.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">date_passed / date_approved</td>
                      <td className="p-3 font-mono text-slate-600">DATE</td>
                      <td className="p-3 text-slate-600">B-Tree (date_approved DESC)</td>
                      <td className="p-3 text-slate-700">Legislative enactment timeline & chronological sorting.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">author_sponsors</td>
                      <td className="p-3 font-mono text-slate-600">TEXT[]</td>
                      <td className="p-3 text-slate-600">GIN Index</td>
                      <td className="p-3 text-slate-700">Council members and committee sponsors.</td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono font-bold text-blue-700">file_path & ocr_fulltext</td>
                      <td className="p-3 font-mono text-slate-600">VARCHAR(512) & TEXT</td>
                      <td className="p-3 text-purple-700 font-semibold">GIN (body_search_vector)</td>
                      <td className="p-3 text-slate-700">Immutable object storage path and secondary full-text OCR stream.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERABLE 2: FILE PROCESSING WORKFLOW */}
      {activeDeliverable === 'workflow' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-indigo-600" />
                End-to-End File Processing & Ingestion Workflow
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                From Batch Upload/Scan -&gt; Adaptive OCR -&gt; Regex/NLP Header Parsing -&gt; Title Normalization -&gt; Database Save.
              </p>
            </div>

            {/* Workflow Step Cards */}
            <div className="space-y-4">
              {FILE_PROCESSING_WORKFLOW_STEPS.map((step) => (
                <div
                  key={step.step}
                  className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-300 transition-all"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold font-mono text-xs flex items-center justify-center shadow-sm">
                        {step.step}
                      </span>
                      <h4 className="font-bold text-slate-900 text-sm sm:text-base">{step.title}</h4>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2.5 py-1 rounded bg-slate-200/80 text-slate-700">
                      {step.actor}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                    {step.description}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded bg-white border border-slate-200">
                      <span className="font-bold text-slate-500 uppercase text-[10px] block">Technology Stack:</span>
                      <span className="font-mono text-slate-800 text-[11px] font-medium">{step.tech}</span>
                    </div>
                    <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-900">
                      <span className="font-bold text-emerald-700 uppercase text-[10px] block">Artifact / Output:</span>
                      <span className="font-medium text-[11px]">{step.output}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* DELIVERABLE 3: TITLE SEARCH SQL QUERY */}
      {activeDeliverable === 'search_sql' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-emerald-600" />
                  Title-Based Precision Search Query (Production SQL)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Implements 3-tier ranking (Priority 1: 100%, Priority 2: Word Order, Priority 3: Fuzzy Trigram) via PostgreSQL CTE.
                </p>
              </div>

              <button
                onClick={() => handleCopy(TITLE_SEARCH_SQL_QUERY, 'search_sql')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
              >
                {copiedCode === 'search_sql' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copiedCode === 'search_sql' ? 'Copied Query' : 'Copy SQL'}
              </button>
            </div>

            {/* SQL Code Block */}
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
              <div className="bg-slate-900 px-4 py-2 text-xs font-mono text-slate-400 border-b border-slate-800 flex items-center justify-between">
                <span>02_query_precision_title_search.sql</span>
                <span className="text-[11px] text-emerald-400">pg_trgm + tsvector Execution</span>
              </div>
              <pre className="p-4 text-emerald-400 font-mono text-xs overflow-x-auto leading-relaxed max-h-[520px]">
                <code>{TITLE_SEARCH_SQL_QUERY}</code>
              </pre>
            </div>

            {/* Architectural Highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-4 border-t border-slate-200 text-xs">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="font-bold text-emerald-900 block mb-1">Priority 1 (Exact Match):</span>
                <p className="text-emerald-800 leading-relaxed">
                  Evaluates exact series numbers (e.g. <code className="bg-white px-1 py-0.5 rounded">2026-045</code>), exact normalized titles, or exact quoted phrases inside title. Returns an absolute 100% score.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200">
                <span className="font-bold text-blue-900 block mb-1">Priority 2 (Word Order):</span>
                <p className="text-blue-800 leading-relaxed">
                  Uses <code className="bg-white px-1 py-0.5 rounded">phraseto_tsquery</code> and sequential word substring scans. Scores range between 75% and 95%.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="font-bold text-amber-900 block mb-1">Priority 3 (Fuzzy Trigram):</span>
                <p className="text-amber-800 leading-relaxed">
                  Invokes <code className="bg-white px-1 py-0.5 rounded">similarity(normalized_title, :query) &gt;= 0.30</code> via the GIN index to tolerate spelling and typing errors.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERABLE 4: UI WIREFRAME STRUCTURES */}
      {activeDeliverable === 'wireframes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg flex items-center gap-2">
                <Layout className="w-5 h-5 text-blue-600" />
                UI Wireframe Layout Blueprints & System Interface Architecture
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Structural layouts and interaction models for the Upload & Review Page and the Title Precision Search Interface.
              </p>
            </div>

            {/* Wireframe 1: Title Search Interface */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-blue-600 text-white font-mono text-xs flex items-center justify-center">W1</span>
                  Wireframe: Title Precision Search Interface
                </h4>
                <span className="text-xs text-slate-500 font-mono">View: /search</span>
              </div>

              {/* Wireframe Visual Mock */}
              <div className="border border-slate-300 rounded-lg bg-white p-4 font-mono text-[11px] text-slate-600 space-y-3 shadow-inner">
                <div className="border border-dashed border-slate-300 p-2 rounded bg-slate-50 text-center font-bold text-slate-800">
                  [Institutional Top Header: Republic / LGU Seal | Indexed Count (7 Measures) | Title Standard Rules Link]
                </div>

                <div className="border border-blue-300 bg-blue-50/50 p-3 rounded space-y-2">
                  <div className="border border-blue-400 bg-white p-2 rounded text-slate-900 flex justify-between items-center font-sans">
                    <span>🔍 [Search Input Bar: "Health Services" | 2026-045 | AND / OR Syntax]</span>
                    <span className="bg-blue-600 text-white px-2 py-0.5 rounded text-[10px]">Search</span>
                  </div>
                  <div className="flex gap-1 text-[10px] text-blue-800">
                    <span>Syntax Badges: [Exact Series: 2026-045] ["Quoted Phrase"] [AND / OR] [Fuzzy: Heatlh]</span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2 text-center text-[10px]">
                  <div className="col-span-5 border border-slate-200 p-2 rounded bg-slate-50">
                    [Toggle: Targeted Title Search (Zero Noise) vs Full-Text OCR]
                  </div>
                  <div className="col-span-4 border border-slate-200 p-2 rounded bg-slate-50">
                    [Prefix Filter Dropdown: A RESOLUTION AUTHORIZING...]
                  </div>
                  <div className="col-span-3 border border-slate-200 p-2 rounded bg-slate-50">
                    [Facets: Type | Year | Sort]
                  </div>
                </div>

                <div className="border border-slate-300 p-3 rounded space-y-2 bg-slate-50/30">
                  <div className="text-[10px] font-bold text-slate-500 flex justify-between">
                    <span>SEARCH RESULTS FEED (Sorted by Priority 1 -&gt; 2 -&gt; 3)</span>
                    <span>3 Measures Matched</span>
                  </div>

                  <div className="border border-emerald-400 bg-white p-3 rounded shadow-sm text-left font-sans space-y-1">
                    <div className="flex gap-2 text-[10px]">
                      <span className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">Resolution No. 2026-045</span>
                      <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">Priority 1: Exact Title Match (100%)</span>
                    </div>
                    <p className="font-bold text-xs text-slate-900">
                      A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES
                    </p>
                    <div className="text-[10px] text-slate-500 flex justify-between pt-1 border-t border-slate-100">
                      <span>Sponsors: Hon. Maria Elena Santos</span>
                      <span className="text-blue-600 font-semibold">[Inspect Record -&gt;]</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Wireframe 2: Upload & Review Page */}
            <div className="p-5 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span className="w-6 h-6 rounded bg-indigo-600 text-white font-mono text-xs flex items-center justify-center">W2</span>
                  Wireframe: Upload, Scanning & Metadata Review Interface
                </h4>
                <span className="text-xs text-slate-500 font-mono">View: /upload</span>
              </div>

              {/* Wireframe Visual Mock */}
              <div className="border border-slate-300 rounded-lg bg-white p-4 font-mono text-[11px] text-slate-600 space-y-3 shadow-inner">
                <div className="border border-dashed border-blue-400 bg-blue-50/40 p-4 rounded text-center font-sans space-y-1">
                  <p className="font-bold text-slate-800 text-xs">📁 Drag & Drop Legislative Scans (PDF, DOCX, PNG, JPG)</p>
                  <p className="text-[10px] text-slate-500">Auto-OCR Digitization • Fast Sample Buttons: [Load Health MOA] [Load DRRM Plan]</p>
                </div>

                <div className="grid grid-cols-12 gap-3">
                  {/* Left Column */}
                  <div className="col-span-5 border border-slate-300 p-3 rounded bg-slate-900 text-emerald-400 text-[10px] space-y-1">
                    <span className="font-bold text-white block pb-1 border-b border-slate-800">
                      [Document OCR Stream Preview - 98.4% Confidence]
                    </span>
                    <p className="text-slate-300">EXCERPTS FROM SANGGUNIAN MINUTES...</p>
                    <p className="text-slate-300">RESOLUTION NO. 2026-045</p>
                    <p className="text-slate-300">A RESOLUTION AUTHORIZING LOCAL CHIEF EXECUTIVE...</p>
                  </div>

                  {/* Right Column */}
                  <div className="col-span-7 border border-slate-300 p-3 rounded bg-white text-slate-800 text-[10px] space-y-2">
                    <div className="border border-emerald-300 bg-emerald-50 p-2 rounded text-emerald-950 font-sans font-bold">
                      ✓ Title Conforms: [Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <div className="border p-1.5 rounded">Type: Resolution</div>
                      <div className="border p-1.5 rounded font-mono">No. 2026-045</div>
                      <div className="border p-1.5 rounded">Status: Enacted</div>
                    </div>
                    <div className="border p-1.5 rounded bg-slate-50">
                      Title: Resolution No. 2026-045: A RESOLUTION AUTHORIZING...
                    </div>
                    <div className="border border-indigo-200 bg-indigo-50 p-1.5 rounded text-indigo-900 font-mono">
                      Normalized Index: RESOLUTION NO 2026-045 A RESOLUTION AUTHORIZING...
                    </div>
                    <div className="flex justify-end pt-1">
                      <span className="bg-emerald-600 text-white px-3 py-1 rounded font-bold">
                        [Save & Index to Database]
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
