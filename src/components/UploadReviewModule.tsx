import React, { useState, useRef } from 'react';
import { 
  UploadCloud, FileUp, CheckCircle2, AlertTriangle, RefreshCw, 
  ArrowRight, ShieldCheck, Sparkles, FileText, Database, 
  Check, X, Wand2, Info, Layers, Trash2
} from 'lucide-react';
import { LegislativeDocument, UploadBatchItem } from '../types';
import { SAMPLE_OCR_DOCUMENTS } from '../data/seedDocuments';
import { normalizeTitle, validateAndParseTitle } from '../utils/titleEngine';

interface UploadReviewModuleProps {
  onDocumentSaved: (doc: LegislativeDocument) => void;
  onOpenFormatGuide: () => void;
}

export const UploadReviewModule: React.FC<UploadReviewModuleProps> = ({
  onDocumentSaved,
  onOpenFormatGuide,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [processingQueue, setProcessingQueue] = useState<UploadBatchItem[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  const emptyFormData: Partial<LegislativeDocument> = {
    doc_type: 'Resolution',
    resolution_number: '',
    resolution_title: '',
    normalized_title: '',
    date_passed: '',
    date_approved: '',
    author_sponsors: [],
    keywords: [],
    committee_referral: '',
    classification_status: 'Enacted',
    ocr_fulltext: '',
    ocr_confidence: 0,
    file_name: '',
    file_path: '',
  };

  // Form State for Active Review Item (Starts empty until user uploads or selects a measure)
  const [formData, setFormData] = useState<Partial<LegislativeDocument>>(emptyFormData);

  const handleResetForm = () => {
    setFormData(emptyFormData);
    setAuthorInput('');
    setKeywordInput('');
    setSaveSuccessMessage(null);
  };

  const handleRemoveQueueItem = (id: string) => {
    setProcessingQueue((prev) => prev.filter((item) => item.id !== id));
    if (processingQueue.length <= 1) {
      handleResetForm();
    }
  };

  const [authorInput, setAuthorInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute live title validation
  const titleValidation = validateAndParseTitle(formData.resolution_title || '');

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(Array.from(e.target.files));
    }
  };

  // Process uploaded files
  const handleFiles = (files: File[]) => {
    const validExtensions = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];
    const newItems: UploadBatchItem[] = files.map((file) => {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf';
      const fileType = (validExtensions.includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'pdf') as any;
      return {
        id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        file,
        fileName: file.name,
        fileSizeKb: Math.round(file.size / 1024),
        fileType,
        status: 'queued',
        progress: 0,
      };
    });

    setProcessingQueue((prev) => [...prev, ...newItems]);
    processUploadQueue([...processingQueue, ...newItems]);
  };

  // Quick load sample scan
  const loadSampleDocument = (sample: typeof SAMPLE_OCR_DOCUMENTS[0]) => {
    const item: UploadBatchItem = {
      id: `sample-${Date.now()}`,
      fileName: sample.fileName,
      fileSizeKb: sample.fileSizeKb,
      fileType: sample.fileType,
      status: 'queued',
      progress: 0,
      rawOcrPreview: sample.rawOcrText,
    };

    setProcessingQueue((prev) => [item, ...prev]);
    executeExtractionPipeline(item, sample.rawOcrText);
  };

  // Run the OCR and Metadata Extraction Pipeline
  const executeExtractionPipeline = async (item: UploadBatchItem, textContent?: string) => {
    setIsProcessing(true);
    setSaveSuccessMessage(null);

    // Update status steps
    updateQueueItemStatus(item.id, 'scanning_ocr', 30);

    setTimeout(async () => {
      updateQueueItemStatus(item.id, 'extracting_metadata', 70);

      try {
        const response = await fetch('/api/documents/extract-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            textContent: textContent || item.rawOcrPreview || 'RESOLUTION NO. 2026-045: A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES',
            fileName: item.fileName,
            mimeType: item.fileType === 'pdf' ? 'application/pdf' : 'image/png',
          }),
        });

        const data = await response.json();
        if (data.success && data.extracted) {
          const ext = data.extracted;
          setFormData({
            doc_type: ext.doc_type || 'Resolution',
            resolution_number: ext.resolution_number,
            series_header: ext.series_header,
            series_year: ext.series_year,
            series_number_only: ext.series_number_only,
            subject_title: ext.subject_title,
            resolution_title: ext.resolution_title,
            normalized_title: ext.normalized_title,
            date_passed: ext.date_passed,
            date_approved: ext.date_approved,
            author_sponsors: ext.author_sponsors || ['Hon. Maria Elena Santos'],
            keywords: ext.keywords || ['Health Services', 'MOA'],
            committee_referral: ext.committee_referral || 'Committee on Rules',
            classification_status: 'Enacted',
            ocr_fulltext: ext.ocr_fulltext,
            ocr_confidence: ext.ocr_confidence,
            file_name: item.fileName,
            file_size_kb: item.fileSizeKb,
            file_path: `/storage/legislative/2026/${item.fileName}`,
          });

          updateQueueItemStatus(item.id, 'ready_for_review', 100, ext);
        }
      } catch (err) {
        console.error('OCR pipeline failed:', err);
        updateQueueItemStatus(item.id, 'ready_for_review', 100);
      } finally {
        setIsProcessing(false);
      }
    }, 900);
  };

  const processUploadQueue = async (items: UploadBatchItem[]) => {
    const unread = items.find((i) => i.status === 'queued');
    if (unread) {
      executeExtractionPipeline(unread, unread.rawOcrPreview);
    }
  };

  const updateQueueItemStatus = (id: string, status: any, progress: number, data?: any) => {
    setProcessingQueue((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status, progress, extractedData: data || i.extractedData } : i))
    );
  };

  // Add / Remove Author Tag
  const handleAddAuthor = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && authorInput.trim()) {
      e.preventDefault();
      const current = formData.author_sponsors || [];
      if (!current.includes(authorInput.trim())) {
        setFormData({ ...formData, author_sponsors: [...current, authorInput.trim()] });
      }
      setAuthorInput('');
    }
  };

  const handleRemoveAuthor = (index: number) => {
    const current = [...(formData.author_sponsors || [])];
    current.splice(index, 1);
    setFormData({ ...formData, author_sponsors: current });
  };

  // Add / Remove Keyword Tag
  const handleAddKeyword = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      const current = formData.keywords || [];
      if (!current.includes(keywordInput.trim())) {
        setFormData({ ...formData, keywords: [...current, keywordInput.trim()] });
      }
      setKeywordInput('');
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const current = [...(formData.keywords || [])];
    current.splice(index, 1);
    setFormData({ ...formData, keywords: current });
  };

  // Auto-Fix Title Syntax
  const handleApplySuggestedTitle = () => {
    if (titleValidation.suggestedFormattedTitle) {
      setFormData({
        ...formData,
        resolution_title: titleValidation.suggestedFormattedTitle,
        normalized_title: normalizeTitle(titleValidation.suggestedFormattedTitle),
      });
    }
  };

  // Save to Database
  const handleSaveToDatabase = async () => {
    if (!titleValidation.isValid) {
      alert('Please correct the title to conform to the Standard Title Format before saving.');
      return;
    }

    try {
      const payload: Partial<LegislativeDocument> = {
        ...formData,
        resolution_title: formData.resolution_title,
        normalized_title: normalizeTitle(formData.resolution_title || ''),
        file_path: formData.file_path || `/storage/legislative/2026/${formData.file_name || 'scanned_res.pdf'}`,
        file_name: formData.file_name || 'scanned_res.pdf',
        file_size_kb: formData.file_size_kb || 1200,
        mime_type: 'application/pdf',
      };

      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.ok && json.document) {
        setSaveSuccessMessage(`Successfully saved and indexed ${json.document.resolution_number}!`);
        onDocumentSaved(json.document);

        // Mark current queue item as saved
        if (processingQueue.length > 0) {
          updateQueueItemStatus(processingQueue[0].id, 'saved', 100);
        }
      } else {
        alert(json.error || 'Failed to save document.');
      }
    } catch (err: any) {
      alert(err.message || 'Error saving to database.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 font-sans tracking-tight">
              Upload Resolution
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              Drag-and-drop batch upload supporting PDF, DOCX, PNG, and JPG. Digitizes document headers and verifies resolution metadata before saving to the archive.
            </p>
          </div>
        </div>

        {/* Quick Test Samples */}
        <div className="mt-5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span className="font-semibold">Simulate Scanned Legislative Measure:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {SAMPLE_OCR_DOCUMENTS.map((sample, idx) => (
              <button
                key={idx}
                onClick={() => loadSampleDocument(sample)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-blue-50 text-slate-800 hover:text-blue-700 border border-slate-300 hover:border-blue-400 text-xs font-medium transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <FileUp className="w-3.5 h-3.5 text-blue-600" />
                <span>{sample.title}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-blue-600 bg-blue-50/70 scale-[0.99]'
              : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50/80 bg-slate-50/40'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.png,.jpg,.jpeg"
            onChange={handleFileInputChange}
            className="hidden"
          />

          <div className="w-12 h-12 rounded-2xl bg-blue-100/80 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>

          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Drop legislative files here, or <span className="text-blue-600 underline">browse</span>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Supports PDF, DOCX, PNG, and JPG • Batch multi-file scanning supported (Max 50MB per file)
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {saveSuccessMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{saveSuccessMessage}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Processing Pipeline & Queue Bar */}
      {processingQueue.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-blue-600" />
              Document Processing Pipeline ({processingQueue.length} files in queue)
            </span>
            {isProcessing && (
              <span className="text-blue-600 font-semibold flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" />
                OCR & Entity Extraction in progress...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {processingQueue.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelectedItemIndex(idx);
                  if (item.extractedData) {
                    setFormData(item.extractedData);
                  }
                }}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-center justify-between ${
                  selectedItemIndex === idx
                    ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
                  <div className="truncate">
                    <span className="font-semibold text-slate-900 truncate block">{item.fileName}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{item.fileType} • {item.fileSizeKb} KB</span>
                  </div>
                </div>

                <div className="flex-shrink-0 ml-2 flex items-center gap-1.5">
                  {item.status === 'ready_for_review' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                      Ready
                    </span>
                  )}
                  {item.status === 'saved' && (
                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold text-[10px]">
                      Saved
                    </span>
                  )}
                  {isProcessing && item.status !== 'ready_for_review' && item.status !== 'saved' && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold text-[10px] animate-pulse">
                      Scanning
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveQueueItem(item.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Remove item"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metadata Review & Standardization Form */}
      <div className="w-full">
        <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200 shadow-sm space-y-5">
            {(formData.resolution_title || formData.resolution_number || formData.ocr_fulltext) && (
              <div className="flex justify-end pb-1 border-b border-slate-100">
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="px-2.5 py-1 rounded text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Remove / Clear loaded resolution"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Form</span>
                </button>
              </div>
            )}

            {/* Title Standard Validation Banner */}
            <div
              className={`p-4 rounded-xl border transition-all ${
                titleValidation.isValid
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-amber-50/90 border-amber-300 text-amber-950'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {titleValidation.isValid ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="font-bold text-xs sm:text-sm">
                      {titleValidation.isValid
                        ? 'Title Conforms to Standard Format'
                        : 'Title Syntax Formatting Alert'}
                    </h4>
                    <p className="text-xs mt-0.5 text-slate-700">
                      Standard: <code className="font-mono bg-white/70 px-1 py-0.5 rounded text-[11px] font-semibold">[Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]</code>
                    </p>

                    {!titleValidation.isValid && (
                      <div className="mt-2 space-y-1 text-xs text-red-700">
                        {titleValidation.errors.map((err, eIdx) => (
                          <p key={eIdx}>• {err}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {!titleValidation.isValid && titleValidation.suggestedFormattedTitle && (
                  <button
                    onClick={handleApplySuggestedTitle}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1 cursor-pointer flex-shrink-0"
                  >
                    <Wand2 className="w-3 h-3" />
                    Auto-Standardize
                  </button>
                )}
              </div>
            </div>

            {/* Document Type & Series Number Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Document Type *
                </label>
                <select
                  value={formData.doc_type}
                  onChange={(e) => setFormData({ ...formData, doc_type: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Resolution">Resolution</option>
                  <option value="Ordinance">Ordinance</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Series Number *
                </label>
                <input
                  type="text"
                  value={formData.resolution_number || ''}
                  onChange={(e) => setFormData({ ...formData, resolution_number: e.target.value })}
                  placeholder="e.g., Resolution No. 2026-045"
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Legislative Status
                </label>
                <select
                  value={formData.classification_status}
                  onChange={(e) => setFormData({ ...formData, classification_status: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="Enacted">Enacted</option>
                  <option value="Approved">Approved</option>
                  <option value="Pending Review">Pending Review</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>

            {/* Verbatim Title Field */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Verbatim Title (Full Standard Title) *
                </label>
                <span className="text-[11px] text-slate-500 font-mono">
                  {formData.resolution_title?.length || 0} characters
                </span>
              </div>
              <textarea
                rows={3}
                value={formData.resolution_title || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData({
                    ...formData,
                    resolution_title: val,
                    normalized_title: normalizeTitle(val),
                  });
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-3 text-xs sm:text-sm font-mono font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 leading-relaxed"
                placeholder="Resolution No. 2026-045: A RESOLUTION AUTHORIZING..."
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Date Passed / Enacted *
                </label>
                <input
                  type="date"
                  value={formData.date_passed || ''}
                  onChange={(e) => setFormData({ ...formData, date_passed: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Date Approved *
                </label>
                <input
                  type="date"
                  value={formData.date_approved || ''}
                  onChange={(e) => setFormData({ ...formData, date_approved: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Author Sponsors Tag Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Authors & Sponsors (Press Enter to add)
              </label>
              <div className="p-2 bg-slate-50 border border-slate-300 rounded-lg flex flex-wrap gap-1.5 items-center">
                {(formData.author_sponsors || []).map((author, aIdx) => (
                  <span
                    key={aIdx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-100 text-blue-800 text-xs font-medium"
                  >
                    {author}
                    <button
                      type="button"
                      onClick={() => handleRemoveAuthor(aIdx)}
                      className="text-blue-600 hover:text-blue-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={authorInput}
                  onChange={(e) => setAuthorInput(e.target.value)}
                  onKeyDown={handleAddAuthor}
                  placeholder="Add sponsor e.g., Hon. Maria Elena Santos..."
                  className="flex-1 min-w-[200px] bg-transparent text-xs text-slate-900 focus:outline-none p-1"
                />
              </div>
            </div>

            {/* Keywords Tag Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                Extracted Subject Keywords (Press Enter to add)
              </label>
              <div className="p-2 bg-slate-50 border border-slate-300 rounded-lg flex flex-wrap gap-1.5 items-center">
                {(formData.keywords || []).map((kw, kIdx) => (
                  <span
                    key={kIdx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-medium"
                  >
                    #{kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kIdx)}
                      className="text-indigo-600 hover:text-indigo-900 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                  onKeyDown={handleAddKeyword}
                  placeholder="Add keyword tag..."
                  className="flex-1 min-w-[150px] bg-transparent text-xs text-slate-900 focus:outline-none p-1"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-500">
                <span>Relational Schema: </span>
                <strong className="text-slate-800">public.legislative_documents</strong>
              </div>

              <button
                id="btn-save-database"
                onClick={handleSaveToDatabase}
                disabled={!titleValidation.isValid || isProcessing}
                className={`px-6 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md cursor-pointer ${
                  titleValidation.isValid && !isProcessing
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Database className="w-4 h-4" />
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
};
