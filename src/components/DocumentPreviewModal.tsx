import React, { useState, useEffect } from 'react';
import { 
  X, Download, Printer, ZoomIn, ZoomOut, RotateCcw, 
  Building2, QrCode, FileText, CheckCircle2, Shield
} from 'lucide-react';
import { LegislativeDocument } from '../types';
import { downloadResolutionPdf } from '../utils/pdfGenerator';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: LegislativeDocument;
  onPrint?: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  document: doc,
  onPrint,
}) => {
  const [zoom, setZoom] = useState<number>(100);

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDownload = () => {
    downloadResolutionPdf(doc);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-slate-900 rounded-2xl w-full max-w-5xl h-[94vh] flex flex-col shadow-2xl border border-slate-700 overflow-hidden">
        
        {/* Top Floating Control Bar */}
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-6 flex items-center justify-between border-b border-slate-800 gap-3 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-indigo-400 shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-blue-400">
                  {doc.resolution_number}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 text-emerald-400 border border-emerald-800/60">
                  Official Preview
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-[280px] sm:max-w-md hidden sm:block">
                {doc.subject_title}
              </p>
            </div>
          </div>

          {/* Center Zoom & Actions Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-xs">
              <button
                onClick={() => setZoom(z => Math.max(60, z - 10))}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] px-1.5 text-slate-200 min-w-[40px] text-center font-bold">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(140, z + 10))}
                className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoom !== 100 && (
                <button
                  onClick={() => setZoom(100)}
                  className="p-1 rounded hover:bg-slate-700 text-blue-400 hover:text-blue-300 cursor-pointer ml-0.5"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              )}
            </div>

            <button
              onClick={handleDownload}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
              title="Download official PDF file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download PDF</span>
            </button>

            {onPrint && (
              <button
                onClick={onPrint}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                title="Print resolution"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0 ml-1"
              title="Close preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Canvas Viewport */}
        <div className="flex-1 overflow-auto p-4 sm:p-10 bg-slate-800/80 flex justify-center items-start">
          <div 
            className="bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-16 font-serif border border-slate-300 transition-all duration-150 max-w-[850px] w-full my-4"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {/* Official Letterhead */}
            <div className="text-center pb-6 border-b-2 border-slate-900 space-y-1">
              <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-800 mb-2 shadow-xs">
                <Building2 className="w-7 h-7 text-slate-800" />
              </div>
              <p className="text-xs font-sans tracking-widest uppercase font-semibold text-slate-700">
                Republic of the Philippines
              </p>
              <p className="text-xs font-sans tracking-wider uppercase font-medium text-slate-700">
                Province of Zamboanga del Norte
              </p>
              <h3 className="text-lg font-sans tracking-wide uppercase font-extrabold text-slate-950">
                Municipality of Mutia
              </h3>
              <p className="text-xs font-sans tracking-widest uppercase font-bold text-blue-900 pt-0.5">
                Office of the Sangguniang Bayan
              </p>
            </div>

            {/* Legislative Session Excerpt */}
            <div className="pt-6 pb-4 text-xs font-sans text-slate-600 italic space-y-1">
              <p>
                EXCERPTS FROM THE MINUTES OF THE REGULAR SESSION OF THE SANGGUNIANG BAYAN OF MUTIA, ZAMBOANGA DEL NORTE HELD AT THE LEGISLATIVE SESSION HALL.
              </p>
              {doc.author_sponsors && doc.author_sponsors.length > 0 && (
                <p className="font-semibold text-slate-800 not-italic pt-1 font-sans">
                  Authored & Sponsored by: <span className="text-slate-950 font-bold">{doc.author_sponsors.join(', ')}</span>
                </p>
              )}
            </div>

            {/* Resolution Number Banner */}
            <div className="my-5 py-2.5 px-4 rounded bg-slate-100 border border-slate-300 text-center">
              <h4 className="font-sans font-extrabold text-lg tracking-wider text-slate-950 uppercase">
                {doc.resolution_number}
              </h4>
            </div>

            {/* Full Resolution Subject Title */}
            <div className="py-2 text-center">
              <h2 className="font-serif font-bold text-base sm:text-lg text-slate-950 uppercase leading-snug tracking-wide">
                {doc.subject_title || doc.resolution_title}
              </h2>
            </div>

            <hr className="my-5 border-slate-300" />

            {/* Full Resolution Clauses and Preamble */}
            <div className="space-y-4 text-sm sm:text-base leading-relaxed sm:leading-loose text-justify text-slate-800">
              {doc.ocr_fulltext ? (
                doc.ocr_fulltext
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
                      <p key={idx} className={isKeyword ? 'font-serif font-bold indent-8 text-slate-950' : 'indent-8'}>
                        {paragraph}
                      </p>
                    );
                  })
              ) : (
                <>
                  <p className="font-bold indent-8 text-slate-950">
                    WHEREAS, Section 16 of Republic Act No. 7160, otherwise known as the Local Government Code of 1991, provides that local government units shall exercise powers necessary and appropriate to ensure and promote the general welfare of their inhabitants;
                  </p>
                  <p className="font-bold indent-8 text-slate-950">
                    WHEREAS, the Sangguniang Bayan of Mutia, upon thorough review and favorable recommendation of the committee, deemed it advantageous and necessary to enact this measure;
                  </p>
                  <p className="font-bold indent-8 text-slate-950">
                    NOW THEREFORE, on motion of the sponsoring members, duly seconded by all members present:
                  </p>
                  <p className="font-bold indent-8 text-slate-950">
                    BE IT RESOLVED, AS IT IS HEREBY RESOLVED, by the Sangguniang Bayan of Mutia in session assembled, to approve and enact: {doc.subject_title}.
                  </p>
                </>
              )}

              <p className="italic text-xs text-slate-600 pt-3">
                UNANIMOUSLY APPROVED this {doc.date_approved || doc.date_passed || 'official session date'}.
              </p>
            </div>

            {/* Official Signatures & Attestation */}
            <div className="pt-12 grid grid-cols-2 gap-8 text-xs font-sans">
              <div>
                <p className="text-slate-500 font-semibold mb-8">ATTESTED AND CERTIFIED CORRECT:</p>
                <p className="font-bold text-slate-950 uppercase border-b border-slate-400 pb-1">
                  ATTY. ROBERTO V. MENDOZA
                </p>
                <p className="text-slate-600 text-[11px] pt-1">Secretary to the Sangguniang Bayan</p>
              </div>

              <div>
                <p className="text-slate-500 font-semibold mb-8">APPROVED AND CONCURRED:</p>
                <p className="font-bold text-slate-950 uppercase border-b border-slate-400 pb-1">
                  HON. MARIA ELENA SANTOS
                </p>
                <p className="text-slate-600 text-[11px] pt-1">Municipal Vice Mayor & Presiding Officer</p>
              </div>
            </div>

            {/* Official Verification Seal & Hash Footnote */}
            <div className="mt-10 pt-4 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-sans">
              <div className="flex items-center gap-2.5">
                <QrCode className="w-7 h-7 text-slate-400" />
                <div>
                  <p className="font-bold text-slate-700">Official Municipal Legislative Record</p>
                  <p className="font-mono text-[10px]">Security Hash: {doc.id.slice(0, 16)} • Verified True Copy</p>
                </div>
              </div>
              <div className="text-right text-[10px]">
                <p>Digitized via Legislative Information System (LIS)</p>
                <p>Municipality of Mutia, Zamboanga del Norte</p>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
