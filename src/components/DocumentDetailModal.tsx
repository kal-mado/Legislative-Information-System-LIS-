import React, { useState, useEffect, useRef } from 'react';
import { 
  X, FileText, Calendar, User, Tag, CheckCircle2, Shield, Copy, Check, 
  Trash2, Printer, Edit3, Save, RotateCcw, AlertCircle, Wand2, Building2,
  Share2, ArrowRight, RefreshCw, HardDrive, Stamp, Hash, CheckSquare,
  Layers, ExternalLink, QrCode, Sliders, Download, FileDown, Eye, ZoomIn, ZoomOut,
  UploadCloud, AlertTriangle
} from 'lucide-react';
import { LegislativeDocument, SearchResultItem, PrintLogEntry, PrinterDevice, PaperSize, WatermarkType } from '../types';
import { normalizeTitle, validateAndParseTitle } from '../utils/titleEngine';
import { 
  applyPrintPageStyles, 
  INITIAL_MUNICIPAL_PRINTERS, 
  generateSecurityHash, 
  canApplyWatermark 
} from '../utils/printerService';
import { downloadResolutionPdf, downloadResolutionText } from '../utils/pdfGenerator';
import { PrinterSelectionModal } from './PrinterSelectionModal';
import { PrintAuditModal } from './PrintAuditModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';

interface DocumentDetailModalProps {
  item: SearchResultItem | null;
  initialTab?: 'pdf' | 'download' | 'record' | 'print' | 'edit';
  onClose: () => void;
  onDeleteDocument?: (id: string) => void;
  onUpdateDocument?: (updatedDoc: LegislativeDocument) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ 
  item, 
  initialTab = 'pdf',
  onClose, 
  onDeleteDocument,
  onUpdateDocument,
}) => {
  const [activeTab, setActiveTab] = useState<'pdf' | 'download' | 'record' | 'print' | 'edit'>(initialTab);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // PDF Viewer & Download State
  const [pdfZoom, setPdfZoom] = useState<number>(100);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Local document state (allows instant updates when edited)
  const [currentDoc, setCurrentDoc] = useState<LegislativeDocument | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<LegislativeDocument | null>(null);
  const [authorInput, setAuthorInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);

  // Edit sub-tab state & file upload
  const [editSubTab, setEditSubTab] = useState<'details' | 'upload'>('details');
  const [editFileDragActive, setEditFileDragActive] = useState(false);
  const [stagedFileName, setStagedFileName] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const handleEditFileSelected = (file: File) => {
    if (!editForm) return;
    const fileSizeKb = Math.max(1, Math.round(file.size / 1024));
    setStagedFileName(file.name);

    setEditForm(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        file_name: file.name,
        file_size_kb: fileSizeKb,
        mime_type: file.type || 'application/pdf',
        file_path: `/storage/legislative/${file.name}`,
      };
    });

    if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text && text.trim().length > 0) {
          setEditForm(prev => prev ? { ...prev, ocr_fulltext: text } : prev);
        }
      };
      reader.readAsText(file);
    }
  };

  // Available Printers & Audit Trail Modal States
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<PrintLogEntry[]>([]);

  // Installed Printers state displayed in Tab 2
  const [installedPrinters, setInstalledPrinters] = useState<PrinterDevice[]>(INITIAL_MUNICIPAL_PRINTERS);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('prn-m608-session');
  const [paperSize, setPaperSize] = useState<PaperSize>('Legal');
  const [pageScope, setPageScope] = useState<'all' | 'page1' | 'page2'>('all');
  const [copies, setCopies] = useState<number>(1);
  const [watermark, setWatermark] = useState<WatermarkType>('OFFICIAL COPY');
  const [showLineNumbers, setShowLineNumbers] = useState<boolean>(false);
  const [showQrSeal, setShowQrSeal] = useState<boolean>(true);
  const [isScanningPrinters, setIsScanningPrinters] = useState<boolean>(false);
  const [isSpooling, setIsSpooling] = useState<boolean>(false);
  const [spoolSuccess, setSpoolSuccess] = useState<{
    jobId: string;
    printerName: string;
    securityHash: string;
  } | null>(null);

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/print-jobs');
      if (res.ok) {
        const data = await res.json();
        if (data.jobs && Array.isArray(data.jobs)) {
          setAuditLogs(data.jobs);
        }
      }
    } catch (err) {
      console.warn('Failed to load audit logs:', err);
    }
  };

  const fetchInstalledPrinters = async () => {
    try {
      const res = await fetch('/api/printers');
      if (res.ok) {
        const data = await res.json();
        if (data.printers && Array.isArray(data.printers)) {
          setInstalledPrinters(data.printers);
          const def = data.printers.find((p: PrinterDevice) => p.isDefault) || data.printers[0];
          if (def && !selectedPrinterId) {
            setSelectedPrinterId(def.id);
          }
        }
      }
    } catch (err) {
      console.warn('Using default municipal printers:', err);
    }
  };

  const handleScanPrinters = async () => {
    setIsScanningPrinters(true);
    try {
      const res = await fetch('/api/printers/discover', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.printers) setInstalledPrinters(data.printers);
      }
    } catch (err) {
      console.warn('Scan complete:', err);
    } finally {
      setTimeout(() => setIsScanningPrinters(false), 600);
    }
  };

  useEffect(() => {
    fetchInstalledPrinters();
  }, []);

  useEffect(() => {
    if (item) {
      setCurrentDoc(item.document);
      setEditForm({ ...item.document });
      setSaveMessage(null);
      setSaveError(null);
      setShowDeleteConfirm(false);
      setActiveTab(initialTab || 'pdf');
    }
  }, [item, initialTab]);

  if (!item || !currentDoc || !editForm) return null;

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleDownloadPdf = () => {
    if (!currentDoc) return;
    try {
      downloadResolutionPdf(currentDoc);
      setDownloadSuccess(`Downloaded official legal PDF for ${currentDoc.resolution_number}`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('PDF download error:', err);
    }
  };

  const handleDownloadText = () => {
    if (!currentDoc) return;
    try {
      downloadResolutionText(currentDoc);
      setDownloadSuccess(`Downloaded text transcript for ${currentDoc.resolution_number}`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('Text download error:', err);
    }
  };

  const handleDownloadJson = () => {
    if (!currentDoc) return;
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentDoc, null, 2));
      const a = document.createElement('a');
      a.href = dataStr;
      const cleanNum = currentDoc.resolution_number.replace(/[^a-zA-Z0-9-_]/g, '_');
      a.download = `${cleanNum}_record.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setDownloadSuccess(`Downloaded JSON record for ${currentDoc.resolution_number}`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    } catch (err) {
      console.error('JSON download error:', err);
    }
  };

  // Title validation for edit form
  const titleValidation = validateAndParseTitle(editForm.resolution_title || '');

  // Auto-Fix Title Syntax in Edit Tab
  const handleApplySuggestedTitle = () => {
    const suggested = titleValidation.suggestedFormattedTitle;
    if (suggested) {
      setEditForm(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          resolution_title: suggested,
          normalized_title: normalizeTitle(suggested),
          subject_title: titleValidation.subjectTitle || prev.subject_title,
          resolution_number: titleValidation.seriesHeader || prev.resolution_number,
          series_header: titleValidation.seriesHeader || prev.series_header,
        };
      });
    }
  };

  // Handle Add Author
  const handleAddAuthor = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && authorInput.trim()) {
      e.preventDefault();
      const current = editForm.author_sponsors || [];
      if (!current.includes(authorInput.trim())) {
        setEditForm({ ...editForm, author_sponsors: [...current, authorInput.trim()] });
      }
      setAuthorInput('');
    }
  };

  const handleRemoveAuthor = (index: number) => {
    const current = [...(editForm.author_sponsors || [])];
    current.splice(index, 1);
    setEditForm({ ...editForm, author_sponsors: current });
  };

  // Handle Add Keyword
  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      const current = editForm.keywords || [];
      if (!current.includes(keywordInput.trim())) {
        setEditForm({ ...editForm, keywords: [...current, keywordInput.trim()] });
      }
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const current = [...(editForm.keywords || [])];
    current.splice(index, 1);
    setEditForm({ ...editForm, keywords: current });
  };

  // Reset Edit Form
  const handleResetEdit = () => {
    setEditForm({ ...currentDoc });
    setAuthorInput('');
    setKeywordInput('');
    setSaveMessage(null);
    setSaveError(null);
    setStagedFileName(null);
  };

  // Save Edits to Server and App State
  const handleSaveEdits = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      const updatedData: LegislativeDocument = {
        ...editForm,
        normalized_title: normalizeTitle(editForm.resolution_title || ''),
        updated_at: new Date().toISOString(),
      };

      const res = await fetch(`/api/documents/${currentDoc.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });

      if (!res.ok) {
        throw new Error('Failed to update resolution record on server.');
      }

      const data = await res.json();
      const savedDoc = data.document || updatedData;

      setCurrentDoc(savedDoc);
      setEditForm({ ...savedDoc });
      setStagedFileName(null);
      setSaveMessage('Resolution successfully updated and saved.');

      if (onUpdateDocument) {
        onUpdateDocument(savedDoc);
      }
    } catch (err: any) {
      setSaveError(err.message || 'An error occurred while saving.');
    } finally {
      setIsSaving(false);
    }
  };

  // Direct print of all pages to the selected installed printer
  const handlePrintAllPages = async (useSystemDialog = true) => {
    if (!currentDoc) return;
    setIsSpooling(true);
    const targetPrinter = installedPrinters.find(p => p.id === selectedPrinterId) || installedPrinters[0];
    const securityHash = generateSecurityHash(currentDoc.resolution_number, 'Secretariat Administrator');

    const payload = {
      document_id: currentDoc.id,
      resolution_number: currentDoc.resolution_number,
      subject_title: currentDoc.subject_title,
      printed_by_id: 'USR-SEC-01',
      printed_by_name: 'Hon. Maria Elena Santos',
      printed_by_role: 'Secretariat Administrator',
      printer_id: targetPrinter.id,
      printer_name: targetPrinter.name,
      printer_type: targetPrinter.connectionType,
      printer_ip: targetPrinter.ipAddress,
      copies_printed: copies,
      collated: true,
      paper_size: paperSize,
      orientation: 'Portrait',
      color_mode: 'Grayscale / Monochrome',
      two_sided: 'none',
      watermark_applied: watermark,
      line_numbers_enabled: showLineNumbers,
      qr_seal_enabled: showQrSeal,
      security_hash: securityHash,
    };

    try {
      await fetch('/api/print-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      applyPrintPageStyles(paperSize, 'Portrait', 'default');

      const jobToken = `PRN-${Math.floor(100000 + Math.random() * 900000)}`;
      setSpoolSuccess({
        jobId: jobToken,
        printerName: targetPrinter.name,
        securityHash,
      });

      fetchAuditLogs();

      if (useSystemDialog) {
        setTimeout(() => {
          window.print();
        }, 300);
      }
    } catch (err) {
      console.error('Print spool error:', err);
    } finally {
      setIsSpooling(false);
    }
  };

  // Open the Available Printers and Spooler selection dialog
  const handlePrint = () => {
    setIsPrinterModalOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-start justify-between gap-4 border-b border-slate-800">
          <div className="flex items-start gap-3">
            <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono tracking-wide ${
              currentDoc.doc_type === 'Ordinance'
                ? 'bg-purple-900/80 text-purple-300 border border-purple-700/50'
                : 'bg-blue-900/80 text-blue-300 border border-blue-700/50'
            }`}>
              {currentDoc.doc_type.toUpperCase()}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm sm:text-base font-bold text-blue-400">
                  {currentDoc.resolution_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/60 font-medium">
                  {currentDoc.classification_status}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-bold text-white mt-1 leading-snug font-sans">
                {currentDoc.subject_title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer flex-shrink-0"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation: PDF Full Resolution, Print, Edit */}
        <div className="bg-slate-100 px-4 sm:px-6 pt-3.5 sm:pt-4 border-b border-slate-200 flex items-center gap-1.5 sm:gap-2 text-xs sm:text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('pdf')}
            className={`px-3 sm:px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 rounded-t-md whitespace-nowrap ${
              activeTab === 'pdf'
                ? 'border-blue-600 text-blue-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileDown className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <span>PDF Full Resolution</span>
          </button>

          <button
            onClick={() => setActiveTab('print')}
            className={`px-3 sm:px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 rounded-t-md whitespace-nowrap ${
              activeTab === 'print'
                ? 'border-emerald-600 text-emerald-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Printer className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setActiveTab('edit')}
            className={`px-3 sm:px-3.5 py-2 font-semibold border-b-2 transition-all cursor-pointer flex-shrink-0 flex items-center gap-1.5 rounded-t-md whitespace-nowrap ${
              activeTab === 'edit'
                ? 'border-indigo-600 text-indigo-700 bg-white shadow-xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
            <span>Edit</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 text-sm bg-slate-50/50">
          
          {/* TAB: PDF DOCUMENT VIEW */}
          {activeTab === 'pdf' && (
            <div className="space-y-4">
              {/* PDF Viewer Layout - Displays the uploaded resolution directly in PDF Form */}
              <div className="bg-slate-200/80 rounded-2xl p-4 sm:p-8 flex flex-col items-center overflow-x-auto shadow-inner border border-slate-300 relative">
                {/* PDF Reader Floating Toolbar */}
                <div className="sticky top-2 z-20 mb-6 bg-slate-900/95 backdrop-blur-md text-white px-4 py-2 rounded-xl border border-slate-700 shadow-xl flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPdfZoom(z => Math.max(70, z - 10))}
                      className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Zoom out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono text-[11px] px-1 text-slate-300 min-w-[42px] text-center font-bold">
                      {pdfZoom}%
                    </span>
                    <button
                      onClick={() => setPdfZoom(z => Math.min(130, z + 10))}
                      className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Zoom in"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    {pdfZoom !== 100 && (
                      <button
                        onClick={() => setPdfZoom(100)}
                        className="text-[10px] text-blue-400 hover:text-blue-300 underline ml-1 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  <div className="h-4 w-px bg-slate-700"></div>

                  <span className="font-mono text-slate-300 text-[11px] font-bold">
                    {currentDoc.resolution_number}
                  </span>

                  <div className="h-4 w-px bg-slate-700"></div>

                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(true)}
                    className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Open Document Preview in full view"
                  >
                    <Eye className="w-3 h-3" />
                    <span>Document Preview</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-bold text-[11px] flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                    title="Download official PDF document"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download PDF</span>
                  </button>
                </div>

                {/* Resolution Document in Official PDF Form */}
                <div 
                  className="bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-14 font-serif border border-slate-300 transition-all duration-150 relative max-w-[800px] w-full"
                  style={{ transform: `scale(${pdfZoom / 100})`, transformOrigin: 'top center' }}
                >
                  {/* Official Letterhead */}
                  <div className="text-center pb-5 border-b-2 border-slate-900 space-y-1">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-1.5 shadow-xs">
                      <Building2 className="w-6 h-6 text-slate-800" />
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

                  {/* Legislative Body & Minutes Excerpt */}
                  <div className="pt-5 pb-3 text-xs font-sans text-slate-600 italic space-y-1">
                    <p>
                      EXCERPTS FROM THE MINUTES OF THE REGULAR SESSION OF THE SANGGUNIANG BAYAN OF MUTIA, ZAMBOANGA DEL NORTE HELD AT THE LEGISLATIVE SESSION HALL.
                    </p>
                    {currentDoc.author_sponsors && currentDoc.author_sponsors.length > 0 && (
                      <p className="font-semibold text-slate-700 not-italic pt-1 font-sans">
                        Authored & Sponsored by: <span className="text-slate-900">{currentDoc.author_sponsors.join(', ')}</span>
                      </p>
                    )}
                  </div>

                  {/* Resolution Number Banner */}
                  <div className="my-4 py-2 px-4 rounded bg-slate-100 border border-slate-300 text-center">
                    <h4 className="font-sans font-extrabold text-base tracking-wider text-slate-950 uppercase">
                      {currentDoc.resolution_number}
                    </h4>
                  </div>

                  {/* Full Resolution Title */}
                  <div className="py-2 text-center">
                    <h2 className="font-serif font-bold text-sm sm:text-base text-slate-950 uppercase leading-snug tracking-wide">
                      {currentDoc.subject_title || currentDoc.resolution_title}
                    </h2>
                  </div>

                  <hr className="my-4 border-slate-300" />

                  {/* Full Resolution Text & Clauses */}
                  <div className="space-y-4 text-sm sm:text-[15px] leading-relaxed sm:leading-loose text-justify text-slate-800">
                    {currentDoc.ocr_fulltext ? (
                      currentDoc.ocr_fulltext
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => line.length > 0)
                        .map((paragraph, idx) => {
                          const isKeyword = paragraph.startsWith('WHEREAS') || 
                                            paragraph.startsWith('NOW THEREFORE') || 
                                            paragraph.startsWith('RESOLVED') ||
                                            paragraph.startsWith('BE IT RESOLVED') ||
                                            paragraph.startsWith('APPROVED');
                          return (
                            <p key={idx} className={isKeyword ? 'font-serif font-bold indent-6 text-slate-950' : 'indent-6'}>
                              {paragraph}
                            </p>
                          );
                        })
                    ) : (
                      <>
                        <p className="font-bold indent-6 text-slate-950">
                          WHEREAS, Section 16 of Republic Act No. 7160, otherwise known as the Local Government Code of 1991, provides that local government units shall exercise powers necessary and appropriate to ensure and promote the general welfare of their inhabitants;
                        </p>
                        <p className="font-bold indent-6 text-slate-950">
                          WHEREAS, the Sangguniang Bayan of Mutia, upon thorough review and favorable recommendation of the committee, deemed it advantageous and necessary to enact this measure;
                        </p>
                        <p className="font-bold indent-6 text-slate-950">
                          NOW THEREFORE, on motion of the sponsoring members, duly seconded by all members present:
                        </p>
                        <p className="font-bold indent-6 text-slate-950">
                          BE IT RESOLVED, AS IT IS HEREBY RESOLVED, by the Sangguniang Bayan of Mutia in session assembled, to approve and enact: {currentDoc.subject_title}.
                        </p>
                      </>
                    )}

                    <p className="italic text-xs text-slate-600 pt-2">
                      UNANIMOUSLY APPROVED this {currentDoc.date_approved || currentDoc.date_passed || 'recent session'}.
                    </p>
                  </div>

                  {/* Official Signatures & Attestation */}
                  <div className="pt-10 grid grid-cols-2 gap-8 text-xs font-sans">
                    <div>
                      <p className="text-slate-500 font-semibold mb-6">ATTESTED AND CERTIFIED CORRECT:</p>
                      <p className="font-bold text-slate-950 uppercase border-b border-slate-400 pb-1">
                        ATTY. ROBERTO V. MENDOZA
                      </p>
                      <p className="text-slate-600 text-[11px] pt-1">Secretary to the Sangguniang Bayan</p>
                    </div>

                    <div>
                      <p className="text-slate-500 font-semibold mb-6">APPROVED AND CONCURRED:</p>
                      <p className="font-bold text-slate-950 uppercase border-b border-slate-400 pb-1">
                        HON. MARIA ELENA SANTOS
                      </p>
                      <p className="text-slate-600 text-[11px] pt-1">Municipal Vice Mayor & Presiding Officer</p>
                    </div>
                  </div>

                  {/* Official Verification Seal & QR Footnote */}
                  <div className="mt-8 pt-4 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-500 font-sans">
                    <div className="flex items-center gap-2">
                      <QrCode className="w-6 h-6 text-slate-400" />
                      <div>
                        <p className="font-bold text-slate-700">Official Municipal Legislative Record</p>
                        <p className="font-mono">Security Hash: {currentDoc.id.slice(0, 16)} • Verified True Copy</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p>Digitized via Legislative Information System (LIS)</p>
                      <p>Municipality of Mutia, Zamboanga del Norte</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DOWNLOAD FILE */}
          {activeTab === 'download' && (
            <div className="space-y-5 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
              {/* Banner */}
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
                <FileDown className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm text-blue-950">Download Resolution Files</h3>
                  <p className="text-xs text-blue-800 mt-0.5">
                    Select your preferred format to export or download <strong>{currentDoc.resolution_number}</strong>. All files are generated with certified municipal metadata and verbatim legal text.
                  </p>
                </div>
              </div>

              {/* Download success banner */}
              {downloadSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center justify-between shadow-xs animate-in fade-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{downloadSuccess}</span>
                  </div>
                  <button
                    onClick={() => setDownloadSuccess(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline cursor-pointer"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Export Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Official PDF Document */}
                <div className="p-5 rounded-xl border border-slate-200 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 transition-all flex flex-col justify-between space-y-4 group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1.5">
                        <FileDown className="w-4 h-4 text-rose-600" />
                        <span>Official PDF Document</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">.pdf</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Converted Official Resolution PDF</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Publication-grade Philippine legal format (8.5" × 14") with municipal letterhead, official seals, whereas clauses, and signature certification.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download PDF Document</span>
                  </button>
                </div>

                {/* 2. Plain Text Verbatim Transcript */}
                <div className="p-5 rounded-xl border border-slate-200 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-100/50 transition-all flex flex-col justify-between space-y-4 group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-slate-200 text-slate-800 font-bold text-xs flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-slate-600" />
                        <span>Plain Text Archive</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">.txt</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Verbatim Full-Text Transcript</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Clean UTF-8 plain text transcription containing complete minutes excerpts, legislative preamble, and operative clauses.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadText}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Plain Text</span>
                  </button>
                </div>

                {/* 3. JSON Archival Record */}
                <div className="p-5 rounded-xl border border-slate-200 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/20 transition-all flex flex-col justify-between space-y-4 group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-indigo-100 text-indigo-800 font-bold text-xs flex items-center gap-1.5">
                        <Hash className="w-4 h-4 text-indigo-600" />
                        <span>Digital Metadata</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">.json</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Legislative Schema Record</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Machine-readable JSON schema export with full normalized title indexes, classification status, sponsors, and audit timestamps.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadJson}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download JSON Record</span>
                  </button>
                </div>

                {/* 4. Network Print & Municipal Spooler */}
                <div className="p-5 rounded-xl border border-slate-200 hover:border-emerald-400 bg-slate-50/50 hover:bg-emerald-50/20 transition-all flex flex-col justify-between space-y-4 group">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                        <Printer className="w-4 h-4 text-emerald-600" />
                        <span>Print Spooler</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">Physical Print</span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-sm">Send to Municipal Printer</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Send directly to Sangguniang Bayan network laser printers with watermarking, line numbering, and audit trail logging.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('print')}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Open Print Spooler</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* TAB 1: DOCUMENT RECORD */}
          {activeTab === 'record' && (
            <div className="space-y-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              {/* Title & Normalization Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Verbatim Standard Title
                  </span>
                  <button
                    onClick={() => handleCopy(currentDoc.resolution_title, 'title')}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedField === 'title' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'title' ? 'Copied' : 'Copy Title'}
                  </button>
                </div>
                <p className="font-mono text-xs sm:text-sm text-slate-900 font-semibold bg-white p-3 rounded-lg border border-slate-200 shadow-sm leading-relaxed">
                  {currentDoc.resolution_title}
                </p>

                {/* Normalized Title Index */}
                <div className="mt-3 pt-3 border-t border-slate-200/80">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                      Cleaned Normalized Title Index (Unpunctuated)
                    </span>
                    <button
                      onClick={() => handleCopy(currentDoc.normalized_title, 'norm')}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer font-medium"
                    >
                      {copiedField === 'norm' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'norm' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-indigo-950 bg-indigo-50/60 p-2.5 rounded-lg border border-indigo-100 break-words">
                    {currentDoc.normalized_title}
                  </p>
                </div>
              </div>

              {/* Grid Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Legislative Timeline & Identifiers
                  </h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Jurisdiction / LGU:</span>
                    <span className="font-semibold text-slate-800">Municipality of Mutia</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Date Passed:</span>
                    <span className="font-medium text-slate-800 flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {currentDoc.date_passed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Date Approved:</span>
                    <span className="font-medium text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      {currentDoc.date_approved}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-500">Series Year / Sequence:</span>
                    <span className="font-mono text-slate-800 font-medium">
                      {currentDoc.series_year} — #{currentDoc.series_number_only}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Catalog & Classification
                  </h4>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Classification Status:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px]">
                      {currentDoc.classification_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Committee Referral:</span>
                    <span className="text-slate-800 font-medium truncate max-w-[200px]">
                      {currentDoc.committee_referral || 'Committee on Rules'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-200/70">
                    <span className="text-slate-500">Physical Storage:</span>
                    <span className="font-mono text-blue-700 text-[11px] truncate max-w-[200px]" title={currentDoc.file_path}>
                      {currentDoc.file_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-500">Record ID:</span>
                    <span className="font-mono text-slate-600 text-[11px] truncate max-w-[180px]">
                      {currentDoc.id}
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
                  {currentDoc.author_sponsors.map((author, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 text-xs font-medium border border-blue-200">
                      {author}
                    </span>
                  ))}
                  {currentDoc.committee_referral && (
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs border border-slate-300">
                      {currentDoc.committee_referral}
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
                  {currentDoc.keywords.map((kw, i) => (
                    <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs border border-indigo-200 font-medium">
                      #{kw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRINT RESOLUTION */}
          {activeTab === 'print' && (
            <div className="space-y-5">
              {/* 1. INSTALLED & CONNECTED PRINTERS BAR (Visible in this tab) */}
              <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-slate-800 print:hidden space-y-4">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm sm:text-base text-white">
                          Installed Legislative Printers
                        </h3>
                        <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Online Spooler
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Select target municipal printer to print all pages of this saved resolution
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleScanPrinters}
                      disabled={isScanningPrinters}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                      title="Refresh and discover municipal printers"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isScanningPrinters ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                      <span>{isScanningPrinters ? 'Scanning...' : 'Scan / Refresh'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        fetchAuditLogs();
                        setIsAuditModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                      title="View Legislative Print Audit Logs"
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>Audit Logs</span>
                    </button>
                  </div>
                </div>

                {/* Installed Printers Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {installedPrinters.map((prn) => {
                    const isSelected = prn.id === selectedPrinterId;
                    return (
                      <button
                        key={prn.id}
                        type="button"
                        onClick={() => setSelectedPrinterId(prn.id)}
                        className={`text-left p-3 rounded-xl border transition-all relative flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-blue-950/70 border-blue-500 shadow-md ring-1 ring-blue-500/50'
                            : 'bg-slate-800/60 border-slate-700 hover:bg-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Printer className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                            <span className="font-bold text-xs text-white leading-tight line-clamp-1">
                              {prn.name}
                            </span>
                          </div>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
                          <span className="truncate">{prn.location}</span>
                          <span className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                            prn.status === 'Ready'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                              : prn.status === 'Busy'
                              ? 'bg-amber-950 text-amber-400 border border-amber-800/60'
                              : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                          }`}>
                            {prn.status}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                          <span>{prn.ipAddress || prn.connectionType}</span>
                          <span>{prn.speedPpm} PPM</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Print Configuration Controls */}
                <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  {/* Page Scope: All Pages (Default) */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Layers className="w-3 h-3 text-blue-400" />
                      Print Page Scope
                    </label>
                    <select
                      value={pageScope}
                      onChange={(e) => setPageScope(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                    >
                      <option value="all">All Pages (Page 1 & 2 - Complete)</option>
                      <option value="page1">Page 1 Only (Preamble & Whereas)</option>
                      <option value="page2">Page 2 Only (Enacting & Signatures)</option>
                    </select>
                  </div>

                  {/* Paper Format */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Paper Format
                    </label>
                    <select
                      value={paperSize}
                      onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                    >
                      <option value="Legal">Legal (8.5" × 14" • LGU Standard)</option>
                      <option value="Letter">Letter (8.5" × 11")</option>
                      <option value="A4">A4 (210 × 297 mm)</option>
                    </select>
                  </div>

                  {/* Security Watermark */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                      <Stamp className="w-3 h-3 text-emerald-400" />
                      Security Watermark
                    </label>
                    <select
                      value={watermark}
                      onChange={(e) => setWatermark(e.target.value as WatermarkType)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer text-xs"
                    >
                      <option value="OFFICIAL COPY">OFFICIAL COPY</option>
                      <option value="CERTIFIED TRUE COPY">CERTIFIED TRUE COPY</option>
                      <option value="DRAFT - NOT FOR CIRCULATION">DRAFT</option>
                      <option value="NONE">NO WATERMARK</option>
                    </select>
                  </div>

                  {/* Copies */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Copies
                    </label>
                    <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setCopies(prev => Math.max(1, prev - 1))}
                        className="px-3 py-1.5 text-slate-300 hover:bg-slate-700 font-bold"
                      >
                        -
                      </button>
                      <span className="flex-1 text-center font-mono font-bold text-white text-xs">
                        {copies}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCopies(prev => Math.min(50, prev + 1))}
                        className="px-3 py-1.5 text-slate-300 hover:bg-slate-700 font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Options & Print Action Buttons */}
                  <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-4 text-[11px] text-slate-300">
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showLineNumbers}
                          onChange={(e) => setShowLineNumbers(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span>Line Numbers (Gutter 1-35)</span>
                      </label>
                      <label className="flex items-center gap-1.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showQrSeal}
                          onChange={(e) => setShowQrSeal(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span>Cryptographic QR Seal</span>
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handlePrintAllPages(true)}
                        disabled={isSpooling}
                        className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-900/30 transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Printer className="w-4 h-4" />
                        <span>
                          {isSpooling
                            ? 'Spooling All Pages...'
                            : `Print ${pageScope === 'all' ? 'All Pages (Pages 1 & 2)' : pageScope === 'page1' ? 'Page 1 Only' : 'Page 2 Only'} to ${installedPrinters.find(p => p.id === selectedPrinterId)?.name.slice(0, 22) || 'Printer'}`}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Spool Success Banner */}
                {spoolSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-200 text-xs flex items-center justify-between gap-3 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      <span>
                        <strong>Job #{spoolSuccess.jobId} Spooled:</strong> Sent all pages to <strong>{spoolSuccess.printerName}</strong>. Security Hash: <code className="text-[10px] bg-emerald-900/60 px-1 py-0.5 rounded font-mono">{spoolSuccess.securityHash}</code>
                      </span>
                    </div>
                    <button
                      onClick={() => setSpoolSuccess(null)}
                      className="text-emerald-400 hover:text-white text-xs font-bold underline cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* 2. PRINTABLE LEGAL RESOLUTION CONTAINER (ALL PAGES) */}
              <div 
                id="printable-resolution"
                className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-md max-w-4xl mx-auto font-serif text-slate-900 leading-relaxed text-sm relative"
              >
                {/* ---------------- PAGE 1 ---------------- */}
                {(pageScope === 'all' || pageScope === 'page1') && (
                  <div className="relative min-h-[750px] flex flex-col justify-between">
                    {/* Watermark overlay */}
                    {watermark !== 'NONE' && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 select-none overflow-hidden" aria-hidden="true">
                        <div 
                          className="transform -rotate-45 text-center font-sans font-black tracking-widest leading-none"
                          style={{
                            fontSize: '4.5rem',
                            color: watermark === 'CERTIFIED TRUE COPY'
                              ? 'rgba(16, 185, 129, 0.10)'
                              : watermark === 'OFFICIAL COPY'
                              ? 'rgba(37, 99, 235, 0.10)'
                              : 'rgba(239, 68, 68, 0.10)',
                            border: '6px dashed currentColor',
                            padding: '1.2rem 2.5rem',
                            borderRadius: '1rem',
                          }}
                        >
                          {watermark}
                        </div>
                      </div>
                    )}

                    <div className="flex">
                      {/* Optional Line Numbers Gutter */}
                      {showLineNumbers && (
                        <div className="w-8 select-none font-mono text-[10px] text-slate-400 font-bold border-r border-slate-300 pr-2 mr-4 text-right space-y-2 pt-28">
                          {Array.from({ length: 30 }, (_, i) => (
                            <div key={i}>{i + 1}</div>
                          ))}
                        </div>
                      )}

                      <div className="flex-1 space-y-5">
                        {/* Official Letterhead */}
                        <div className="text-center pb-5 border-b-2 border-slate-900 space-y-1">
                          <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-1.5 shadow-sm">
                            <Building2 className="w-6 h-6 text-slate-800" />
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

                        {/* Session Header Excerpt */}
                        <div className="text-xs font-sans text-slate-700 space-y-1.5 pb-4 border-b border-slate-200">
                          <p className="font-semibold text-slate-800 italic text-center leading-snug">
                            EXCERPTS FROM THE MINUTES OF THE REGULAR SESSION OF THE SANGGUNIANG BAYAN OF MUTIA, ZAMBOANGA DEL NORTE HELD AT THE LEGISLATIVE SESSION HALL.
                          </p>
                          <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] font-sans">
                            <div>
                              <strong className="text-slate-900">Date Passed:</strong> {currentDoc.date_passed}
                            </div>
                            <div>
                              <strong className="text-slate-900">Date Approved:</strong> {currentDoc.date_approved}
                            </div>
                            <div className="col-span-2">
                              <strong className="text-slate-900">Principal Sponsors:</strong> {currentDoc.author_sponsors.join(', ')}
                            </div>
                            {currentDoc.committee_referral && (
                              <div className="col-span-2">
                                <strong className="text-slate-900">Committee Referral:</strong> {currentDoc.committee_referral}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Resolution Header */}
                        <div className="text-center space-y-2 pt-1">
                          <h2 className="text-base sm:text-lg font-bold tracking-tight uppercase text-slate-950 font-sans">
                            {currentDoc.resolution_number}
                          </h2>
                          <p className="text-xs sm:text-sm font-bold uppercase text-slate-900 max-w-xl mx-auto leading-snug px-2">
                            {currentDoc.subject_title}
                          </p>
                        </div>

                        {/* Preamble & Whereas Clauses (Page 1) */}
                        <div className="space-y-3.5 text-justify text-slate-900 text-xs sm:text-[13px] leading-relaxed">
                          <p className="indent-8">
                            <strong>WHEREAS,</strong> the Sangguniang Bayan of the Municipality of Mutia, Province of Zamboanga del Norte, is empowered under Republic Act No. 7160, otherwise known as the Local Government Code of 1991, to enact legislative measures, approve administrative actions, and adopt official resolutions promoting the general welfare and institutional progress of the municipality;
                          </p>
                          <p className="indent-8">
                            <strong>WHEREAS,</strong> after thorough legislative inquiry, deliberate study, and favorable committee report submitted by the <em>{currentDoc.committee_referral || 'Committee on Rules, Laws, and Ethics'}</em>, this August Body unanimously finds the objectives and operational scope of this measure crucial to municipal governance;
                          </p>
                          <p className="indent-8">
                            <strong>WHEREAS,</strong> the administrative records, budgetary considerations, and inter-agency coordination frameworks have been duly verified to conform with applicable statutory regulations, local executive orders, and national government guidelines;
                          </p>
                          <p className="indent-8">
                            <strong>WHEREAS,</strong> proper stakeholder notifications and public consultations have been conducted in accordance with the Internal Rules of Procedure of the Sangguniang Bayan of Mutia;
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Page 1 Running Footer */}
                    <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] font-sans text-slate-500">
                      <span>Municipality of Mutia • Legislative Information System (LIS)</span>
                      <span className="font-bold">Page 1 of 2</span>
                      <span>{currentDoc.resolution_number}</span>
                    </div>
                  </div>
                )}

                {/* ---------------- PAGE BREAK DIVIDER ---------------- */}
                {pageScope === 'all' && (
                  <div className="print-page-break my-8 border-t-2 border-dashed border-slate-300 py-3 text-center font-sans text-xs font-semibold text-slate-400 print:my-0 print:py-0 print:border-none print:text-transparent">
                    — Page Break (Continuation to Page 2 of 2) —
                  </div>
                )}

                {/* ---------------- PAGE 2 ---------------- */}
                {(pageScope === 'all' || pageScope === 'page2') && (
                  <div className="relative min-h-[750px] flex flex-col justify-between pt-2">
                    {/* Watermark overlay */}
                    {watermark !== 'NONE' && (
                      <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10 select-none overflow-hidden" aria-hidden="true">
                        <div 
                          className="transform -rotate-45 text-center font-sans font-black tracking-widest leading-none"
                          style={{
                            fontSize: '4.5rem',
                            color: watermark === 'CERTIFIED TRUE COPY'
                              ? 'rgba(16, 185, 129, 0.10)'
                              : watermark === 'OFFICIAL COPY'
                              ? 'rgba(37, 99, 235, 0.10)'
                              : 'rgba(239, 68, 68, 0.10)',
                            border: '6px dashed currentColor',
                            padding: '1.2rem 2.5rem',
                            borderRadius: '1rem',
                          }}
                        >
                          {watermark}
                        </div>
                      </div>
                    )}

                    <div className="flex">
                      {/* Optional Line Numbers Gutter */}
                      {showLineNumbers && (
                        <div className="w-8 select-none font-mono text-[10px] text-slate-400 font-bold border-r border-slate-300 pr-2 mr-4 text-right space-y-2 pt-16">
                          {Array.from({ length: 30 }, (_, i) => (
                            <div key={i}>{i + 31}</div>
                          ))}
                        </div>
                      )}

                      <div className="flex-1 space-y-5">
                        {/* Continuation Header */}
                        <div className="text-center pb-4 border-b border-slate-300 text-xs font-sans text-slate-600 space-y-0.5">
                          <p className="uppercase font-semibold tracking-wider text-slate-700">
                            Office of the Sangguniang Bayan • Municipality of Mutia
                          </p>
                          <p className="text-[11px] font-medium text-slate-500">
                            Continuation of {currentDoc.resolution_number} — Page 2 of 2
                          </p>
                        </div>

                        {/* Enacting & Operative Clauses */}
                        <div className="space-y-3.5 text-justify text-slate-900 text-xs sm:text-[13px] leading-relaxed">
                          <p className="indent-8">
                            <strong>NOW, THEREFORE,</strong> on motion of <strong>{currentDoc.author_sponsors[0] || 'the Sponsoring Committee'}</strong>, duly seconded by all members present:
                          </p>
                          
                          <p className="indent-8 font-semibold text-slate-950">
                            <strong>BE IT RESOLVED, AS IT IS HEREBY RESOLVED,</strong> by the Sangguniang Bayan of the Municipality of Mutia, Province of Zamboanga del Norte, in regular legislative session assembled, to approve, adopt, and enact:
                          </p>

                          <div className="p-4 rounded-xl bg-slate-50 border border-slate-300 text-center font-sans font-bold text-slate-950 uppercase text-xs sm:text-sm tracking-wide shadow-sm my-2">
                            "{currentDoc.resolution_title}"
                          </div>

                          <p className="indent-8">
                            <strong>RESOLVED FURTHER,</strong> that certified copies of this official Resolution be promptly furnished to the Office of the Municipal Mayor, the Municipal Planning and Development Office, the Sangguniang Panlalawigan of Zamboanga del Norte, and all relevant municipal bureaus for their information, compliance, and proper implementation.
                          </p>

                          <p className="indent-8">
                            <strong>RESOLVED FINALLY,</strong> that this Resolution shall take effect immediately upon its approval and promulgation in accordance with statutory guidelines.
                          </p>
                        </div>

                        {/* Signatures & Attestation Block */}
                        <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs font-sans print-avoid-break">
                          <div>
                            <p className="text-slate-500 font-semibold mb-8 text-[11px]">
                              ATTESTED AND CERTIFIED CORRECT:
                            </p>
                            <p className="font-extrabold text-slate-950 uppercase text-xs">
                              {currentDoc.author_sponsors[0] || 'HON. VICE MAYOR'}
                            </p>
                            <p className="text-slate-700 font-medium">Vice Mayor & Presiding Officer</p>
                            <p className="text-[11px] text-slate-500">Municipality of Mutia, Zamboanga del Norte</p>
                          </div>
                          
                          <div className="text-right">
                            <p className="text-slate-500 font-semibold mb-8 text-[11px]">
                              APPROVED:
                            </p>
                            <p className="font-extrabold text-slate-950 uppercase text-xs">
                              HON. MUNICIPAL MAYOR
                            </p>
                            <p className="text-slate-700 font-medium">Local Chief Executive</p>
                            <p className="text-[11px] text-slate-500">Municipality of Mutia, Zamboanga del Norte</p>
                          </div>
                        </div>

                        {/* Authenticity Verification Block with QR Seal */}
                        {showQrSeal && (
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-sans text-slate-700 flex items-center justify-between gap-4 print-avoid-break mt-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-10 h-10 rounded-lg bg-blue-100 border border-blue-300 flex items-center justify-center text-blue-900 font-mono font-bold text-xs">
                                QR
                              </div>
                              <div>
                                <p className="font-bold text-[11px] text-slate-900 uppercase">
                                  Secretariat Document Verification Token
                                </p>
                                <p className="font-mono text-[10px] text-slate-600">
                                  MUTIA-SB-{currentDoc.resolution_number.replace(/\s+/g, '-')}-SEC
                                </p>
                              </div>
                            </div>
                            <div className="text-right text-[10px] text-slate-500">
                              <p>Certified Official Copy</p>
                              <p>LIS Archival Vault Ledger</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Page 2 Running Footer */}
                    <div className="mt-8 pt-3 border-t border-slate-200 flex items-center justify-between text-[10px] font-sans text-slate-500">
                      <span>Municipality of Mutia • Legislative Information System (LIS)</span>
                      <span className="font-bold">Page 2 of 2 • End of Document</span>
                      <span>{currentDoc.resolution_number}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: EDIT RESOLUTION */}
          {activeTab === 'edit' && (
            <div className="space-y-5 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
              {/* Status feedback banners */}
              {saveMessage && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{saveMessage}</span>
                </div>
              )}
              {saveError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Sub-tab Navigation: Edit Details | Upload File */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
                <button
                  type="button"
                  onClick={() => setEditSubTab('details')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    editSubTab === 'details'
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Details</span>
                </button>

                <button
                  type="button"
                  onClick={() => setEditSubTab('upload')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                    editSubTab === 'upload'
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload File</span>
                  {stagedFileName && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  )}
                </button>
              </div>

              {/* SUB-TAB 1: EDIT DETAILS */}
              {editSubTab === 'details' && (
                <div className="space-y-4 text-xs">
                {/* Doc Type & Series Identification */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Document Type
                    </label>
                    <select
                      value={editForm.doc_type}
                      onChange={(e) => setEditForm({ ...editForm, doc_type: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="Resolution">Resolution</option>
                      <option value="Ordinance">Ordinance</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Series Year
                    </label>
                    <input
                      type="number"
                      value={editForm.series_year}
                      onChange={(e) => setEditForm({ ...editForm, series_year: parseInt(e.target.value, 10) || 2026 })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Series Number Header
                    </label>
                    <input
                      type="text"
                      value={editForm.resolution_number}
                      onChange={(e) => setEditForm({ ...editForm, resolution_number: e.target.value, series_header: e.target.value })}
                      placeholder="e.g. Resolution No. 2026-045"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Resolution Title with Validation */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>Standard Verbatim Title</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        [Doc Type] No. [YYYY]-[Number]: [Subject]
                      </span>
                    </label>
                    {titleValidation.isValid ? (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Valid Syntax
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleApplySuggestedTitle}
                        className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                        Auto-Fix Syntax
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    value={editForm.resolution_title}
                    onChange={(e) => setEditForm({ ...editForm, resolution_title: e.target.value })}
                    className={`w-full p-3 rounded-lg border font-mono text-xs sm:text-sm text-slate-800 focus:outline-none ${
                      titleValidation.isValid 
                        ? 'border-emerald-300 focus:ring-2 focus:ring-emerald-400' 
                        : 'border-amber-300 focus:ring-2 focus:ring-amber-400'
                    }`}
                  />
                  {!titleValidation.isValid && titleValidation.errors && titleValidation.errors.length > 0 && (
                    <p className="text-[11px] text-amber-700 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {titleValidation.errors[0]}
                    </p>
                  )}
                </div>

                {/* Subject Title */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Subject Matter / Action Title
                  </label>
                  <input
                    type="text"
                    value={editForm.subject_title}
                    onChange={(e) => setEditForm({ ...editForm, subject_title: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Timeline and Classification */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Date Passed
                    </label>
                    <input
                      type="date"
                      value={editForm.date_passed}
                      onChange={(e) => setEditForm({ ...editForm, date_passed: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Date Approved
                    </label>
                    <input
                      type="date"
                      value={editForm.date_approved}
                      onChange={(e) => setEditForm({ ...editForm, date_approved: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 block mb-1">
                      Status
                    </label>
                    <select
                      value={editForm.classification_status}
                      onChange={(e) => setEditForm({ ...editForm, classification_status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    >
                      <option value="Enacted">Enacted</option>
                      <option value="Approved">Approved</option>
                      <option value="Pending Review">Pending Review</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>
                </div>

                {/* Committee Referral */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Committee Referral
                  </label>
                  <input
                    type="text"
                    value={editForm.committee_referral || ''}
                    onChange={(e) => setEditForm({ ...editForm, committee_referral: e.target.value })}
                    placeholder="e.g. Committee on Health and Sanitation"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Authors & Sponsors Tag Editor */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Authors and Sponsors (Press Enter to add)
                  </label>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 flex flex-wrap items-center gap-1.5">
                    {editForm.author_sponsors.map((author, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-blue-100 text-blue-900 font-semibold flex items-center gap-1">
                        <span>{author}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveAuthor(idx)}
                          className="hover:text-rose-600 cursor-pointer text-xs"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={authorInput}
                      onChange={(e) => setAuthorInput(e.target.value)}
                      onKeyDown={handleAddAuthor}
                      placeholder="Add sponsor & press Enter..."
                      className="px-2 py-1 bg-transparent border-none text-xs focus:outline-none flex-1 min-w-[150px]"
                    />
                  </div>
                </div>

                {/* Keywords Tag Editor */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Indexed Keywords (Press Enter to add)
                  </label>
                  <div className="p-2.5 rounded-lg border border-slate-300 bg-slate-50 flex flex-wrap items-center gap-1.5">
                    {editForm.keywords.map((kw, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-900 font-semibold flex items-center gap-1">
                        <span>#{kw}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveKeyword(idx)}
                          className="hover:text-rose-600 cursor-pointer text-xs"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={handleAddKeyword}
                      placeholder="Add keyword & press Enter..."
                      className="px-2 py-1 bg-transparent border-none text-xs focus:outline-none flex-1 min-w-[150px]"
                    />
                  </div>
                </div>

                {/* Resolution Body / OCR Fulltext Editor */}
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Resolution Full Text & Clauses
                  </label>
                  <textarea
                    rows={6}
                    value={editForm.ocr_fulltext || ''}
                    onChange={(e) => setEditForm({ ...editForm, ocr_fulltext: e.target.value })}
                    placeholder="Enter resolution preamble, whereas clauses, and enacted provisions..."
                    className="w-full p-3 rounded-lg border border-slate-300 font-mono text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed"
                  />
                </div>
                </div>
              )}

              {/* SUB-TAB 2: UPLOAD FILE */}
              {editSubTab === 'upload' && (
                <div className="space-y-4 text-xs">
                  {/* Staged File Confirmation Banner */}
                  {stagedFileName && (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span>New file staged: <strong className="font-mono">{stagedFileName}</strong></span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStagedFileName(null);
                          if (currentDoc) {
                            setEditForm(prev => prev ? {
                              ...prev,
                              file_name: currentDoc.file_name,
                              file_size_kb: currentDoc.file_size_kb,
                              mime_type: currentDoc.mime_type,
                              file_path: currentDoc.file_path,
                            } : prev);
                          }
                        }}
                        className="text-slate-500 hover:text-rose-600 font-medium cursor-pointer transition-colors text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Drag and Drop Upload Zone */}
                  <div>
                    <input
                      type="file"
                      ref={editFileInputRef}
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleEditFileSelected(file);
                      }}
                      className="hidden"
                    />

                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setEditFileDragActive(true);
                      }}
                      onDragLeave={() => setEditFileDragActive(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setEditFileDragActive(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) handleEditFileSelected(file);
                      }}
                      onClick={() => editFileInputRef.current?.click()}
                      className={`p-8 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${
                        editFileDragActive
                          ? 'border-blue-500 bg-blue-50/80 scale-[1.01]'
                          : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/70 bg-white'
                      }`}
                    >
                      <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                        <UploadCloud className="w-6 h-6" />
                      </div>
                      <p className="font-bold text-slate-900 text-sm mb-1">
                        Click to browse or drag and drop a replacement file
                      </p>
                      <p className="text-slate-500 text-xs max-w-md mx-auto">
                        Upload an official signed resolution scan, PDF document, or transcription file (supports PDF, DOCX, TXT, images up to 25MB).
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Action Controls */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetEdit}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={isSaving}
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold flex items-center gap-1.5 shadow transition-colors cursor-pointer text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 print:hidden">
          <div className="flex items-center gap-3">
            <span>Legislative Record ID: {currentDoc.id.slice(0, 18)}...</span>
            {onDeleteDocument && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
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

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div 
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-confirm-title"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
              </div>
              <div className="space-y-1 flex-1">
                <h3 id="delete-confirm-title" className="text-base font-bold text-slate-900">
                  Remove Resolution?
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Are you sure you want to remove <strong className="text-slate-900 font-semibold">{currentDoc.resolution_number}</strong> from the municipal legislative archive?
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs text-slate-700 space-y-1">
              <span className="font-semibold text-[11px] text-slate-500 uppercase tracking-wider block">Document Title:</span>
              <p className="line-clamp-2 font-medium text-slate-900 italic">
                "{currentDoc.resolution_title}"
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteDocument) {
                    onDeleteDocument(currentDoc.id);
                  }
                  setShowDeleteConfirm(false);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Yes, Remove Resolution</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Available Printers & Spooler Modal */}
      {isPrinterModalOpen && (
        <PrinterSelectionModal
          isOpen={isPrinterModalOpen}
          onClose={() => setIsPrinterModalOpen(false)}
          document={currentDoc}
          onOpenAuditLogs={() => {
            fetchAuditLogs();
            setIsAuditModalOpen(true);
          }}
        />
      )}

      {/* Print Audit Ledger Modal */}
      <PrintAuditModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        logs={auditLogs}
        selectedDocumentId={currentDoc.id}
      />

      {/* Full Document Preview Modal */}
      {isPreviewModalOpen && (
        <DocumentPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          document={currentDoc}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
};
