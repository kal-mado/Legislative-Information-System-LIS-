export type DocumentType = 'Resolution' | 'Ordinance';

export type ClassificationStatus = 'Enacted' | 'Approved' | 'Pending Review' | 'Archived' | 'Vetoed';

export interface LegislativeDocument {
  id: string; // UUID Primary Key
  doc_type: DocumentType;
  resolution_number: string; // e.g. "Res. No. 2026-045" or "Resolution No. 2026-045"
  series_header: string; // e.g. "Resolution No. 2026-045"
  series_year: number; // e.g. 2026
  series_number_only: string; // e.g. "2026-045" or "045"
  subject_title: string; // e.g. "A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES"
  resolution_title: string; // Full verbatim title: "[Doc Type] No. [YYYY]-[Number]: [Subject]"
  normalized_title: string; // Cleaned, uppercase, unpunctuated title string for index matching
  keywords: string[]; // Extracted key subject tags
  date_passed: string; // YYYY-MM-DD
  date_approved: string; // YYYY-MM-DD
  author_sponsors: string[]; // Authors / Sponsors
  file_path: string; // Storage path e.g. "/storage/legislative/2026/res-2026-045.pdf"
  file_name: string; // Original uploaded filename
  file_size_kb: number;
  mime_type: string;
  ocr_fulltext: string; // Full digitized OCR text content
  ocr_confidence?: number; // OCR quality percentage (0-100)
  classification_status: ClassificationStatus;
  committee_referral?: string;
  created_at: string;
  updated_at: string;
}

export type SearchPriority = 1 | 2 | 3 | 4;

export interface SearchResultItem {
  document: LegislativeDocument;
  score: number; // 0 - 100
  priority: SearchPriority;
  priorityLabel: string;
  matchedCriteria: string[];
  titleMatchedFragment?: string;
  bodyMatchSnippet?: string;
}

export interface SearchQueryFilters {
  query: string;
  isFullText: boolean; // default false (Strictly Title Search)
  prefixFilter: string; // e.g., "A Resolution Authorizing", "A Resolution Approving"
  docType: 'ALL' | 'Resolution' | 'Ordinance';
  year: string; // 'ALL' or specific year
  author: string; // 'ALL' or specific author
  sortBy: 'relevance' | 'date_desc' | 'date_asc' | 'number_asc';
}

export interface UploadBatchItem {
  id: string;
  file?: File;
  fileName: string;
  fileSizeKb: number;
  fileType: 'pdf' | 'docx' | 'png' | 'jpg';
  status: 'queued' | 'uploading' | 'scanning_ocr' | 'extracting_metadata' | 'ready_for_review' | 'saved' | 'error';
  progress: number;
  extractedData?: Partial<LegislativeDocument>;
  validationErrors?: string[];
  rawOcrPreview?: string;
  error?: string;
}

export interface TitleStandardValidationResult {
  isValid: boolean;
  docType?: DocumentType;
  year?: number;
  seriesNumber?: string;
  seriesHeader?: string;
  subjectTitle?: string;
  normalizedTitle?: string;
  suggestedFormattedTitle?: string;
  errors: string[];
}
