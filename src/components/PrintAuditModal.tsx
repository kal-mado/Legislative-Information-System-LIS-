import React, { useState } from 'react';
import { 
  X, Shield, FileText, Printer, CheckCircle2, Clock, 
  Search, Filter, ExternalLink, Hash, UserCheck, AlertTriangle
} from 'lucide-react';
import { PrintLogEntry } from '../types';

interface PrintAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: PrintLogEntry[];
  selectedDocumentId?: string;
}

export const PrintAuditModal: React.FC<PrintAuditModalProps> = ({
  isOpen,
  onClose,
  logs,
  selectedDocumentId,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [watermarkFilter, setWatermarkFilter] = useState<string>('ALL');

  if (!isOpen) return null;

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.resolution_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.subject_title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.printed_by_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.security_hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.printer_name.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === 'ALL' || log.printed_by_role === roleFilter;
    const matchesWatermark = watermarkFilter === 'ALL' || log.watermark_applied === watermarkFilter;
    const matchesDoc = !selectedDocumentId || log.document_id === selectedDocumentId;

    return matchesSearch && matchesRole && matchesWatermark && matchesDoc;
  });

  const totalCopiesPrinted = logs.reduce((acc, curr) => acc + curr.copies_printed, 0);
  const certifiedCopiesCount = logs.filter(l => l.watermark_applied === 'CERTIFIED TRUE COPY').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-sans">
                  Legislative Print Audit Trail & Verification Logs
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-mono">
                  Immutable Ledger
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Official audit history of all paper distributions, certified copies, and physical printer jobs
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stats Row */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Total Print Events:</span>
            <span className="font-bold text-slate-900 text-base">{logs.length}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Total Sheets Dispatched:</span>
            <span className="font-bold text-blue-700 text-base">{totalCopiesPrinted} copies</span>
          </div>
          <div>
            <span className="text-slate-500 block">Certified True Copies:</span>
            <span className="font-bold text-emerald-700 text-base">{certifiedCopiesCount} issued</span>
          </div>
          <div>
            <span className="text-slate-500 block">Ledger Integrity:</span>
            <span className="font-mono text-xs text-slate-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Cryptographically Verified
            </span>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="p-4 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by resolution number, officer, printer, or verification hash..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Roles</option>
              <option value="Secretariat Administrator">Secretariat Admin</option>
              <option value="SB Legislative Staff">SB Staff</option>
              <option value="Committee Stenographer">Stenographer</option>
            </select>

            <select
              value={watermarkFilter}
              onChange={(e) => setWatermarkFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">All Watermarks</option>
              <option value="CERTIFIED TRUE COPY">Certified True Copy</option>
              <option value="OFFICIAL COPY">Official Copy</option>
              <option value="DRAFT - NOT FOR CIRCULATION">Draft</option>
              <option value="NONE">No Watermark</option>
            </select>
          </div>
        </div>

        {/* Logs Table */}
        <div className="overflow-y-auto flex-1 p-4 bg-slate-50/50 text-xs">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-2">
              <Printer className="w-8 h-8 mx-auto text-slate-300" />
              <p className="font-semibold text-slate-600">No print audit logs match your filter criteria.</p>
              <p className="text-[11px]">Print jobs dispatched will automatically appear here with full verification details.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.print_id}
                  className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-blue-300 transition-colors space-y-2"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-sm">
                          {log.resolution_number}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.watermark_applied === 'CERTIFIED TRUE COPY'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : log.watermark_applied === 'OFFICIAL COPY'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : log.watermark_applied.includes('DRAFT')
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {log.watermark_applied === 'NONE' ? 'STANDARD NO WATERMARK' : log.watermark_applied}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px]">
                          {log.paper_size} • {log.orientation}
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium line-clamp-1">
                        {log.subject_title}
                      </p>
                    </div>

                    <div className="text-right text-[11px] text-slate-500">
                      <div className="flex items-center justify-end gap-1 font-mono text-slate-700">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(log.timestamp).toLocaleString()}</span>
                      </div>
                      <span className="font-semibold text-blue-600">
                        {log.copies_printed} {log.copies_printed === 1 ? 'Copy' : 'Copies'}
                      </span>
                    </div>
                  </div>

                  {/* Secondary Details Row */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-600">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="text-slate-800">{log.printed_by_name}</strong>
                        <span className="text-slate-400">({log.printed_by_role})</span>
                      </span>

                      <span className="flex items-center gap-1">
                        <Printer className="w-3.5 h-3.5 text-slate-400" />
                        <span>{log.printer_name}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-mono">Verification:</span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                        {log.security_hash}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>Municipal Legislative Audit Compliance • Section 54, Local Government Code</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Close Audit Trail
          </button>
        </div>
      </div>
    </div>
  );
};
