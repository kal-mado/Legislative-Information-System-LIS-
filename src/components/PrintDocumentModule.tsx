import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, FileText, CheckCircle2, AlertCircle, RefreshCw, 
  Settings, Shield, ZoomIn, ZoomOut, Maximize2, ShieldCheck, 
  Layers, Copy, Stamp, Calendar, User, Eye, Download, 
  Building2, Hash, AlertTriangle, ChevronRight, Check, HelpCircle,
  FileCheck, ExternalLink, Sliders
} from 'lucide-react';
import { 
  LegislativeDocument, 
  PrinterDevice, 
  PrintJobSettings, 
  PrintLogEntry, 
  PaperSize, 
  ColorMode, 
  OrientationMode, 
  WatermarkType, 
  UserRole 
} from '../types';
import { 
  INITIAL_MUNICIPAL_PRINTERS, 
  generateSecurityHash, 
  canApplyWatermark, 
  triggerNativePrint,
  applyPrintPageStyles
} from '../utils/printerService';
import { PrintAuditModal } from './PrintAuditModal';

interface PrintDocumentModuleProps {
  documents: LegislativeDocument[];
  preSelectedDocument?: LegislativeDocument | null;
  onSelectDocumentForDetail?: (doc: LegislativeDocument) => void;
}

export const PrintDocumentModule: React.FC<PrintDocumentModuleProps> = ({
  documents,
  preSelectedDocument,
  onSelectDocumentForDetail,
}) => {
  // Document Selection State
  const [selectedDocId, setSelectedDocId] = useState<string>(
    preSelectedDocument?.id || documents[0]?.id || ''
  );
  const [docSearchQuery, setDocSearchQuery] = useState('');

  // Active Document
  const currentDoc = documents.find(d => d.id === selectedDocId) || documents[0] || null;

  // Active Authenticated User & Role Simulation (RBAC)
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>('Secretariat Administrator');
  const [currentUserName, setCurrentUserName] = useState('Hon. Maria Elena Santos');

  // Discovered Printers State
  const [printers, setPrinters] = useState<PrinterDevice[]>(INITIAL_MUNICIPAL_PRINTERS);
  const [isScanningPrinters, setIsScanningPrinters] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Print Job Settings
  const [settings, setSettings] = useState<PrintJobSettings>({
    printerId: INITIAL_MUNICIPAL_PRINTERS[0]?.id || 'prn-m608-session',
    paperSize: 'Legal', // Default to Philippine LGU Standard (8.5" x 14")
    orientation: 'Portrait',
    colorMode: 'Grayscale / Monochrome',
    pageRange: 'all',
    customRange: '1',
    copies: 1,
    collate: true,
    watermark: 'CERTIFIED TRUE COPY',
    showLineNumbers: false,
    showQrSeal: true,
    twoSided: 'none',
    margins: 'default',
  });

  // UI States
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isDispatchingPrint, setIsDispatchingPrint] = useState(false);
  const [printSuccessReceipt, setPrintSuccessReceipt] = useState<PrintLogEntry | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [showArchWireframe, setShowArchWireframe] = useState(false);

  // Print Audit Logs Repository
  const [printLogs, setPrintLogs] = useState<PrintLogEntry[]>([]);

  // Fetch initial printers and logs from backend
  useEffect(() => {
    fetch('/api/printers')
      .then(r => r.json())
      .then(data => {
        if (data.printers) setPrinters(data.printers);
      })
      .catch(err => console.error('Failed to load printers:', err));

    fetch('/api/print-logs')
      .then(r => r.json())
      .then(data => {
        if (data.logs) setPrintLogs(data.logs);
      })
      .catch(err => console.error('Failed to load print logs:', err));
  }, []);

  // Update selected doc if prop changes
  useEffect(() => {
    if (preSelectedDocument) {
      setSelectedDocId(preSelectedDocument.id);
    }
  }, [preSelectedDocument]);

  const selectedPrinter = printers.find(p => p.id === settings.printerId) || printers[0];

  // RBAC Permission Check for selected Watermark
  const watermarkPermission = canApplyWatermark(currentUserRole, settings.watermark);

  // Refresh / Scan Network Printers
  const handleScanPrinters = async () => {
    setIsScanningPrinters(true);
    setScanMessage(null);
    try {
      const res = await fetch('/api/printers/discover', { method: 'POST' });
      const data = await res.json();
      if (data.printers) {
        setPrinters(data.printers);
        setScanMessage(`Discovery complete: ${data.discoveredCount} devices verified online.`);
      }
    } catch (e) {
      setScanMessage('Failed to query municipal print spooler.');
    } finally {
      setIsScanningPrinters(false);
      setTimeout(() => setScanMessage(null), 4000);
    }
  };

  // Dispatch Print Job to Connected Hardware & Record in Audit Log
  const handleDispatchPrintJob = async () => {
    if (!currentDoc) return;
    setPrintError(null);
    setPrintSuccessReceipt(null);

    // Enforce RBAC
    if (!watermarkPermission.allowed) {
      setPrintError(watermarkPermission.reason || 'Access denied for this watermark.');
      return;
    }

    setIsDispatchingPrint(true);
    try {
      const payload = {
        document_id: currentDoc.id,
        resolution_number: currentDoc.resolution_number,
        subject_title: currentDoc.subject_title,
        printed_by_id: currentUserRole === 'Secretariat Administrator' ? 'USR-SEC-01' : 'USR-STF-02',
        printed_by_name: currentUserName,
        printed_by_role: currentUserRole,
        printer_id: selectedPrinter.id,
        printer_name: selectedPrinter.name,
        copies_printed: settings.copies,
        watermark_applied: settings.watermark,
        paper_size: settings.paperSize,
        orientation: settings.orientation,
        color_mode: settings.colorMode,
      };

      const res = await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch print job.');
      }

      setPrintSuccessReceipt(data.receipt);
      setPrintLogs(prev => [data.receipt, ...prev]);
    } catch (err: any) {
      setPrintError(err.message || 'Error executing print dispatch.');
    } finally {
      setIsDispatchingPrint(false);
    }
  };

  // Native Browser Print (Ctrl+P fallback)
  const handleNativeBrowserPrint = () => {
    if (!currentDoc) return;
    if (!watermarkPermission.allowed) {
      setPrintError(watermarkPermission.reason || 'Access denied for this watermark.');
      return;
    }

    // Automatically record an entry in the audit trail for native print jobs as well!
    fetch('/api/print-jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        document_id: currentDoc.id,
        resolution_number: currentDoc.resolution_number,
        subject_title: currentDoc.subject_title,
        printed_by_id: currentUserRole === 'Secretariat Administrator' ? 'USR-SEC-01' : 'USR-STF-02',
        printed_by_name: currentUserName,
        printed_by_role: currentUserRole,
        printer_id: 'prn-system-dialog',
        printer_name: `System Print Dialog (${selectedPrinter.name})`,
        copies_printed: settings.copies,
        watermark_applied: settings.watermark,
        paper_size: settings.paperSize,
        orientation: settings.orientation,
        color_mode: settings.colorMode,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.receipt) {
          setPrintLogs(prev => [data.receipt, ...prev]);
        }
      })
      .catch(console.error);

    triggerNativePrint('lis-live-print-sheet', settings);
  };

  // Filtered documents for the picker
  const filteredDocList = documents.filter(d => 
    d.resolution_number.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
    d.subject_title.toLowerCase().includes(docSearchQuery.toLowerCase())
  );

  // Security Hash for Document Preview
  const previewSecurityHash = currentDoc 
    ? generateSecurityHash(currentDoc.resolution_number, currentUserRole) 
    : 'MUTIA-SB-PREVIEW';

  // Audit count for active document
  const docPrintCount = printLogs.filter(l => l.document_id === currentDoc?.id).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 w-full space-y-6">
      
      {/* Top Banner & Action Controls */}
      <div className="bg-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-lg border border-emerald-400/30 flex-shrink-0">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-white font-sans">
                Official Document Print & Dispatch Studio
              </h2>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 font-semibold">
                Sangguniang Bayan Spooler
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Configure, water-mark, and output official Philippine LGU legislative resolutions and ordinances to detected local USB and network LAN printers with immutable audit logging.
            </p>
          </div>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => setShowArchWireframe(!showArchWireframe)}
            className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="View module architectural specification"
          >
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            <span>{showArchWireframe ? 'Hide Architecture' : 'Module Architecture'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuditModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-blue-200" />
            <span>Print Audit Trail ({printLogs.length})</span>
          </button>
        </div>
      </div>

      {/* Architecture & Integration Specs Drawer */}
      {showArchWireframe && (
        <div className="bg-slate-900/95 border border-slate-700 rounded-2xl p-5 text-xs text-slate-300 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <h3 className="font-bold text-white text-sm">
                Deliverable 1 & 2: Architectural Wireframe & Printer API Integration Blueprint
              </h3>
            </div>
            <button
              onClick={() => setShowArchWireframe(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px]">
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <h4 className="text-blue-400 font-bold uppercase text-xs">1. Web Print API Strategy</h4>
              <p className="text-slate-400">
                Browsers sandbox direct USB/LAN socket calls. The system applies dynamic CSS <code className="text-emerald-400">@page &#123; size: Legal portrait; margin: 0.75in; &#125;</code> rules to match Philippine Sangguniang Bayan Legal paper (8.5" x 14") with 0-margin clipping prevention.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <h4 className="text-emerald-400 font-bold uppercase text-xs">2. Network IPP / CUPS Spooler</h4>
              <p className="text-slate-400">
                Network printers (<code className="text-blue-300">192.168.10.x</code>) receive jobs via Backend Node IPP client (RFC 8011) and RAW port 9100. Discovered status and queues are polled via mDNS Bonjour & SNMP.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <h4 className="text-amber-400 font-bold uppercase text-xs">3. Immutable Security Audit</h4>
              <p className="text-slate-400">
                Every print event writes to <code className="text-blue-300">print_logs</code> table with SHA-256 cryptographic token (<code className="text-purple-300">MUTIA-SB-***</code>) and user role validation (LGC RA 7160 Section 54 compliance).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Studio Layout: Sidebar Controls + Live Paper Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: PRINT CONTROLS SIDEBAR (4 cols)              */}
        {/* ========================================================= */}
        <div className="lg:col-span-4 space-y-5">
          
          {/* 1. DOCUMENT SELECTION CARD */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Select Legislative Measure
              </label>
              <span className="text-[11px] font-mono text-slate-500">
                {documents.length} in Archive
              </span>
            </div>

            <div className="space-y-2">
              <input
                type="text"
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                placeholder="Filter resolutions (e.g. 2026-045, Health)..."
                className="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />

              <select
                value={selectedDocId}
                onChange={(e) => setSelectedDocId(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-slate-50 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
              >
                {filteredDocList.map(doc => (
                  <option key={doc.id} value={doc.id}>
                    {doc.resolution_number} — {doc.subject_title.slice(0, 60)}...
                  </option>
                ))}
              </select>
            </div>

            {/* Document Brief Badge */}
            {currentDoc && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-700">
                    {currentDoc.resolution_number}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {currentDoc.classification_status}
                  </span>
                </div>
                <p className="text-slate-700 font-medium line-clamp-2 leading-relaxed">
                  {currentDoc.subject_title}
                </p>
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/80">
                  <span>Passed: {currentDoc.date_passed}</span>
                  <span className="text-blue-600 font-semibold">
                    Printed {docPrintCount} {docPrintCount === 1 ? 'time' : 'times'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 2. PRINTER DISCOVERY & SELECTION CARD */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                Target Printer Hardware
              </label>
              <button
                type="button"
                onClick={handleScanPrinters}
                disabled={isScanningPrinters}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                title="Scan local network for active printers"
              >
                <RefreshCw className={`w-3 h-3 ${isScanningPrinters ? 'animate-spin' : ''}`} />
                <span>{isScanningPrinters ? 'Scanning...' : 'Scan LAN'}</span>
              </button>
            </div>

            {scanMessage && (
              <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                <span>{scanMessage}</span>
              </div>
            )}

            {/* Printer Selector Dropdown */}
            <div className="space-y-1">
              <select
                value={settings.printerId}
                onChange={(e) => setSettings({ ...settings, printerId: e.target.value })}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name} {printer.isDefault ? '★ (Default LIS)' : ''} [{printer.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Active Printer Details Box */}
            {selectedPrinter && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{selectedPrinter.model}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                    selectedPrinter.status === 'Ready'
                      ? 'bg-emerald-100 text-emerald-800'
                      : selectedPrinter.status === 'Busy'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      selectedPrinter.status === 'Ready' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}></span>
                    {selectedPrinter.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 block">Connection:</span>
                    <span className="font-medium text-slate-700">{selectedPrinter.connectionType}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Endpoint / Port:</span>
                    <span className="font-mono text-slate-700">{selectedPrinter.ipAddress || 'USB'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Print Speed:</span>
                    <span className="text-slate-700">{selectedPrinter.speedPpm || 45} PPM</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Spool Queue:</span>
                    <span className="text-slate-700">{selectedPrinter.queueLength} Jobs waiting</span>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic pt-1 border-t border-slate-200/70">
                  Location: {selectedPrinter.location}
                </p>
              </div>
            )}
          </div>

          {/* 3. USER ROLE & RBAC ACCESS CONTROL */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-600" />
                Active Officer & Role (RBAC)
              </label>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                RA 7160 Sec. 54
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Printed By (Officer)
                </label>
                <input
                  type="text"
                  value={currentUserName}
                  onChange={(e) => setCurrentUserName(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">
                  Authorized Role
                </label>
                <select
                  value={currentUserRole}
                  onChange={(e) => setCurrentUserRole(e.target.value as UserRole)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none"
                >
                  <option value="Secretariat Administrator">Secretariat Admin</option>
                  <option value="SB Legislative Staff">SB Staff</option>
                  <option value="Committee Stenographer">Stenographer</option>
                  <option value="Public Inquirer">Public Inquirer</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. PRINT SETTINGS & CONFIGURATIONS */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5 text-slate-600" />
              Print Configurations
            </h3>

            {/* Paper Size & Orientation */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Paper Format
                </label>
                <select
                  value={settings.paperSize}
                  onChange={(e) => setSettings({ ...settings, paperSize: e.target.value as PaperSize })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Legal">Legal (8.5" × 14") [LGU Standard]</option>
                  <option value="Letter">Letter (8.5" × 11")</option>
                  <option value="A4">A4 (210 × 297mm)</option>
                  <option value="Executive">Executive (7.25" × 10.5")</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Orientation
                </label>
                <select
                  value={settings.orientation}
                  onChange={(e) => setSettings({ ...settings, orientation: e.target.value as OrientationMode })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Portrait">Portrait (Vertical)</option>
                  <option value="Landscape">Landscape (Horizontal)</option>
                </select>
              </div>
            </div>

            {/* Copies & Collation */}
            <div className="grid grid-cols-2 gap-3 text-xs items-center">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Copies
                </label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={settings.copies}
                  onChange={(e) => setSettings({ ...settings, copies: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 font-mono text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={settings.collate}
                    onChange={(e) => setSettings({ ...settings, collate: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="font-medium text-slate-700 text-xs">Collate copies</span>
                </label>
              </div>
            </div>

            {/* Layout Color & Duplex */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Color Mode
                </label>
                <select
                  value={settings.colorMode}
                  onChange={(e) => setSettings({ ...settings, colorMode: e.target.value as ColorMode })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none"
                >
                  <option value="Grayscale / Monochrome">Grayscale (Official Copy)</option>
                  <option value="Official Full Color">Full Color (Gold Seal)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Duplex / 2-Sided
                </label>
                <select
                  value={settings.twoSided}
                  onChange={(e) => setSettings({ ...settings, twoSided: e.target.value as any })}
                  className="w-full px-2.5 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none"
                >
                  <option value="none">Single-Sided</option>
                  <option value="long_edge">2-Sided (Long-Edge)</option>
                  <option value="short_edge">2-Sided (Short-Edge)</option>
                </select>
              </div>
            </div>

            {/* Watermark Selector with Security Warning */}
            <div className="text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Stamp className="w-3.5 h-3.5 text-blue-600" />
                  Official Status Watermark
                </label>
                {settings.watermark === 'CERTIFIED TRUE COPY' && (
                  <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    Authorized Stamp
                  </span>
                )}
              </div>

              <select
                value={settings.watermark}
                onChange={(e) => setSettings({ ...settings, watermark: e.target.value as WatermarkType })}
                className={`w-full px-3 py-2 rounded-lg border text-xs font-semibold focus:outline-none ${
                  !watermarkPermission.allowed 
                    ? 'border-rose-400 bg-rose-50 text-rose-900' 
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                <option value="CERTIFIED TRUE COPY">CERTIFIED TRUE COPY (Secretariat)</option>
                <option value="OFFICIAL COPY">OFFICIAL COPY (Standard Distribution)</option>
                <option value="DRAFT - NOT FOR CIRCULATION">DRAFT - NOT FOR CIRCULATION</option>
                <option value="FOR COMMITTEE REVIEW ONLY">FOR COMMITTEE REVIEW ONLY</option>
                <option value="ARCHIVAL RECORD">ARCHIVAL RECORD</option>
                <option value="NONE">NO WATERMARK (Clean)</option>
              </select>

              {!watermarkPermission.allowed && (
                <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium pt-1">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  {watermarkPermission.reason}
                </p>
              )}
            </div>

            {/* Line Numbering & QR Verification Toggles */}
            <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  Legislative Line Numbers (Session Gutter)
                </span>
                <input
                  type="checkbox"
                  checked={settings.showLineNumbers}
                  onChange={(e) => setSettings({ ...settings, showLineNumbers: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer select-none">
                <span className="font-medium text-slate-700 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-slate-400" />
                  QR Verification Seal & Cryptographic Hash
                </span>
                <input
                  type="checkbox"
                  checked={settings.showQrSeal}
                  onChange={(e) => setSettings({ ...settings, showQrSeal: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 5. EXECUTE PRINT BUTTONS */}
          <div className="space-y-2.5">
            {/* Direct Hardware Dispatch Button */}
            <button
              type="button"
              id="btn-dispatch-print"
              onClick={handleDispatchPrintJob}
              disabled={isDispatchingPrint || !watermarkPermission.allowed}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>
                {isDispatchingPrint 
                  ? 'Spooling to Hardware...' 
                  : `Send to ${selectedPrinter?.name.slice(0, 24)}...`}
              </span>
            </button>

            {/* Native OS Print Dialog Backup */}
            <button
              type="button"
              id="btn-native-print"
              onClick={handleNativeBrowserPrint}
              disabled={!watermarkPermission.allowed}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              <span>Open System Print Dialog (Ctrl+P / Cmd+P)</span>
            </button>

            {/* Error or Success feedback banners */}
            {printError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{printError}</span>
              </div>
            )}

            {printSuccessReceipt && (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs space-y-2 shadow-sm animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Print Job Dispatched & Audit Committed</span>
                </div>
                <div className="font-mono text-[11px] space-y-0.5 text-emerald-900">
                  <p>Job ID: {printSuccessReceipt.print_id}</p>
                  <p>Printer: {printSuccessReceipt.printer_name}</p>
                  <p>Token: {printSuccessReceipt.security_hash}</p>
                  <p>Watermark: {printSuccessReceipt.watermark_applied}</p>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between">
                  <button
                    onClick={() => setIsAuditModalOpen(true)}
                    className="text-blue-700 font-bold hover:underline"
                  >
                    View in Audit Ledger →
                  </button>
                  <button
                    onClick={() => setPrintSuccessReceipt(null)}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: LIVE REAL-TIME PRINT PREVIEW (8 cols)       */}
        {/* ========================================================= */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Preview Toolbar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-bold text-slate-800">Live Paper Rendering</span>
              <span className="font-mono text-slate-500 text-[11px]">
                [{settings.paperSize} • {settings.orientation} • {settings.colorMode}]
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-[11px] font-bold text-slate-700">
                  {zoomLevel}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
                  className="p-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {onSelectDocumentForDetail && currentDoc && (
                <button
                  type="button"
                  onClick={() => onSelectDocumentForDetail(currentDoc)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>Inspect Record</span>
                </button>
              )}
            </div>
          </div>

          {/* Paper Viewport Stage */}
          <div className="bg-slate-200/80 rounded-2xl p-4 sm:p-8 overflow-auto border border-slate-300 flex justify-center min-h-[850px] shadow-inner">
            
            {/* The Physical Sheet Container */}
            <div 
              id="lis-live-print-sheet"
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                width: settings.orientation === 'Portrait' 
                  ? (settings.paperSize === 'Legal' ? '8.5in' : '8.5in')
                  : (settings.paperSize === 'Legal' ? '14in' : '11in'),
                minHeight: settings.orientation === 'Portrait'
                  ? (settings.paperSize === 'Legal' ? '14in' : '11in')
                  : '8.5in',
              }}
              className="bg-white shadow-2xl rounded-sm text-slate-950 font-serif relative overflow-hidden transition-transform duration-200 flex flex-col justify-between"
            >
              
              {/* ------------------------------------------------------------- */}
              {/* WATERMARK OVERLAY                                             */}
              {/* ------------------------------------------------------------- */}
              {settings.watermark !== 'NONE' && (
                <div 
                  className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 select-none overflow-hidden"
                  aria-hidden="true"
                >
                  <div 
                    className="transform -rotate-45 text-center font-sans font-black tracking-widest leading-none"
                    style={{
                      fontSize: settings.orientation === 'Portrait' ? '4.8rem' : '6rem',
                      color: settings.watermark === 'CERTIFIED TRUE COPY'
                        ? 'rgba(16, 185, 129, 0.12)'
                        : settings.watermark === 'OFFICIAL COPY'
                        ? 'rgba(37, 99, 235, 0.11)'
                        : 'rgba(239, 68, 68, 0.12)',
                      border: '6px dashed currentColor',
                      padding: '1.5rem 3rem',
                      borderRadius: '1rem',
                    }}
                  >
                    {settings.watermark}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* DOCUMENT CONTENT CANVAS (With Optional Legislative Line Gutter) */}
              {/* ------------------------------------------------------------- */}
              <div className="p-8 sm:p-12 flex-1 relative flex">
                
                {/* Optional Legislative Line Numbers Gutter */}
                {settings.showLineNumbers && (
                  <div className="w-8 select-none font-mono text-[10px] text-slate-400 font-bold border-r border-slate-300 pr-2 mr-4 text-right space-y-2 pt-28">
                    {Array.from({ length: 36 }, (_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                )}

                {/* Main Legislative Legal Content */}
                <div className="flex-1 space-y-6">
                  
                  {/* Official Municipal Letterhead */}
                  <div className="text-center pb-5 border-b-2 border-slate-900 space-y-1">
                    <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-1.5 shadow-sm">
                      <Building2 className="w-7 h-7 text-slate-800" />
                    </div>
                    <p className="text-xs font-sans tracking-widest uppercase font-semibold text-slate-700">
                      Republic of the Philippines
                    </p>
                    <p className="text-xs font-sans tracking-wider uppercase font-medium text-slate-700">
                      Province of Zamboanga del Norte
                    </p>
                    <h3 className="text-base font-sans tracking-wide uppercase font-extrabold text-slate-950">
                      Municipality of Mutia
                    </h3>
                    <p className="text-xs font-sans tracking-widest uppercase font-bold text-blue-900 pt-0.5">
                      Office of the Sangguniang Bayan
                    </p>
                  </div>

                  {/* Session Excerpts Meta Box */}
                  <div className="text-xs font-sans text-slate-700 space-y-1.5 pb-4 border-b border-slate-200">
                    <p className="italic text-center font-medium leading-tight">
                      EXCERPT FROM THE MINUTES OF THE REGULAR SESSION OF THE SANGGUNIANG BAYAN OF MUTIA, ZAMBOANGA DEL NORTE HELD AT THE LEGISLATIVE SESSION HALL.
                    </p>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-sans">
                      <div>
                        <strong className="text-slate-800">Date Passed:</strong> {currentDoc?.date_passed}
                      </div>
                      <div>
                        <strong className="text-slate-800">Date Approved:</strong> {currentDoc?.date_approved}
                      </div>
                      <div className="col-span-2">
                        <strong className="text-slate-800">Principal Sponsors:</strong> {currentDoc?.author_sponsors.join(', ')}
                      </div>
                    </div>
                  </div>

                  {/* Resolution Number & Title Header */}
                  <div className="text-center space-y-3 pt-2">
                    <h2 className="text-lg font-sans font-extrabold uppercase tracking-tight text-slate-950">
                      {currentDoc?.resolution_number}
                    </h2>
                    <p className="text-sm font-sans font-bold uppercase text-slate-900 max-w-xl mx-auto leading-snug px-4">
                      {currentDoc?.subject_title}
                    </p>
                  </div>

                  {/* Legal Clauses / Resolution Body */}
                  <div className="space-y-4 text-justify text-slate-900 text-xs sm:text-[13px] leading-relaxed">
                    {currentDoc?.ocr_fulltext && currentDoc.ocr_fulltext.includes('WHEREAS') ? (
                      <div className="whitespace-pre-line leading-relaxed font-sans text-slate-900">
                        {currentDoc.ocr_fulltext}
                      </div>
                    ) : (
                      <>
                        <p className="indent-8">
                          <strong>WHEREAS,</strong> the Sangguniang Bayan of the Municipality of Mutia, Province of Zamboanga del Norte, is empowered under Republic Act No. 7160 (The Local Government Code of 1991) to enact legislative measures that uphold public interest, social advancement, and institutional development;
                        </p>
                        <p className="indent-8">
                          <strong>WHEREAS,</strong> after thorough deliberation and favorable committee endorsement by the <em>{currentDoc?.committee_referral || 'Committee on Rules'}</em>, this August Body deems the adoption of this measure paramount to municipal welfare;
                        </p>
                        <p className="indent-8">
                          <strong>NOW, THEREFORE,</strong> on motion of {currentDoc?.author_sponsors[0] || 'the Sponsoring Committee'}, duly seconded by the members present:
                        </p>
                        <p className="indent-8 font-semibold text-slate-950">
                          <strong>BE IT RESOLVED, AS IT IS HEREBY RESOLVED,</strong> by the Sangguniang Bayan of Mutia, Zamboanga del Norte in session assembled, to approve and enact:
                        </p>
                        <div className="p-3 rounded bg-slate-50 border border-slate-300 text-center font-sans font-bold text-slate-900 uppercase my-2 text-xs">
                          "{currentDoc?.resolution_title}"
                        </div>
                        <p className="indent-8">
                          <strong>RESOLVED FURTHER,</strong> that certified copies of this Resolution be forwarded to relevant municipal departments, provincial offices, and executing authorities for their information, guidance, and prompt implementation.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Signatures & Attestation Blocks */}
                  <div className="pt-8 mt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs font-sans">
                    <div>
                      <p className="text-slate-500 font-semibold mb-6">ATTESTED AND CERTIFIED CORRECT:</p>
                      <p className="font-bold text-slate-900 uppercase">
                        {currentDoc?.author_sponsors[0] || 'HON. VICE MAYOR & PRESIDING OFFICER'}
                      </p>
                      <p className="text-slate-600">Municipal Vice Mayor & Presiding Officer</p>
                      <p className="text-[11px] text-slate-500">Municipality of Mutia</p>
                    </div>

                    <div className="text-right">
                      <p className="text-slate-500 font-semibold mb-6">APPROVED:</p>
                      <p className="font-bold text-slate-900 uppercase">MUNICIPAL MAYOR</p>
                      <p className="text-slate-600">Local Chief Executive</p>
                      <p className="text-[11px] text-slate-500">Municipality of Mutia, Zamboanga del Norte</p>
                    </div>
                  </div>

                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* FOOTER & CRYPTOGRAPHIC VERIFICATION BARCODE                   */}
              {/* ------------------------------------------------------------- */}
              <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] font-sans text-slate-600">
                <div className="flex items-center gap-3">
                  {settings.showQrSeal && (
                    <div className="w-10 h-10 bg-slate-900 text-white flex items-center justify-center rounded p-1 font-mono text-[8px] text-center font-bold tracking-tighter">
                      QR SEAL
                    </div>
                  )}
                  <div>
                    <span className="font-mono font-bold text-slate-800 block">
                      VERIFICATION HASH: {previewSecurityHash}
                    </span>
                    <span className="text-slate-500 text-[10px]">
                      Authentic Municipal Legislative Copy • LIS Mutia ZDN
                    </span>
                  </div>
                </div>

                <div className="text-right font-mono text-xs text-slate-700">
                  <span>Page 1 of 1</span>
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      {/* Print Audit Logs Modal */}
      <PrintAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={printLogs}
        selectedDocumentId={currentDoc?.id}
      />

    </div>
  );
};
