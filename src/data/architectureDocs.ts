export const DATABASE_SCHEMA_SQL = `-- ==============================================================================
-- LEGISLATIVE INFORMATION SYSTEM (LIS) - ENTERPRISE RELATIONAL SCHEMA
-- Database Target: PostgreSQL 15+ with pg_trgm and full-text indexing extensions
-- Focus: Precision Title Search, OCR Full-Text Storage, and Audited Metadata
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID generator
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- Trigram index for fuzzy title similarity
CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- GIN indexing for scalar types

-- 2. Enumerated Status & Types
DO $$ BEGIN
    CREATE TYPE legislative_doc_type AS ENUM ('Resolution', 'Ordinance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE legislative_status AS ENUM ('Draft', 'Pending Review', 'Approved', 'Enacted', 'Vetoed', 'Archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Core Legislative Documents Table
CREATE TABLE IF NOT EXISTS legislative_documents (
    -- Primary Identifier
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Document Classification
    doc_type legislative_doc_type NOT NULL,
    classification_status legislative_status NOT NULL DEFAULT 'Enacted',
    
    -- Standardized Numbering & Series Header
    -- e.g. "Resolution No. 2026-045"
    resolution_number VARCHAR(64) NOT NULL UNIQUE,
    series_header VARCHAR(128) NOT NULL,            -- "Resolution No. 2026-045"
    series_year SMALLINT NOT NULL,                  -- 2026
    series_number_only VARCHAR(32) NOT NULL,        -- "2026-045" or "045"
    
    -- Verbatim and Processed Title Fields
    -- e.g. "Resolution No. 2026-045: A RESOLUTION AUTHORIZING..."
    resolution_title TEXT NOT NULL,
    subject_title TEXT NOT NULL,                    -- Pure action/subject matter
    
    -- Deterministic Normalized Title:
    -- Cleaned, uppercase, unpunctuated string for zero-noise exact index matching
    normalized_title TEXT NOT NULL,
    
    -- Subject Keywords / Taxonomies (Extracted by OCR/NLP pipeline)
    keywords TEXT[] NOT NULL DEFAULT '{}',
    
    -- Legislative Timeline
    date_passed DATE NOT NULL,
    date_approved DATE NOT NULL,
    session_number VARCHAR(64),
    
    -- Authors & Committee Metadata
    author_sponsors TEXT[] NOT NULL DEFAULT '{}',
    co_sponsors TEXT[] DEFAULT '{}',
    committee_referral VARCHAR(255),
    
    -- Secure File Storage References
    file_path VARCHAR(512) NOT NULL,                -- Cloud Object Store or Encrypted Volume URI
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type VARCHAR(128) NOT NULL,
    file_checksum_sha256 CHAR(64) NOT NULL,
    
    -- OCR Digitization Output
    ocr_fulltext TEXT,                              -- Complete digital text extracted from scan
    ocr_confidence NUMERIC(5,2),                    -- OCR confidence score (0.00 - 100.00%)
    ocr_processed_at TIMESTAMPTZ,
    ocr_engine VARCHAR(64) DEFAULT 'Tesseract-v5/Gemini-Flash-Vision',
    
    -- Generated Full-Text Search Vectors (Stored for blazing performance)
    -- Priority vector strictly for Title & Series
    title_search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(resolution_number, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(subject_title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(normalized_title, '')), 'B')
    ) STORED,
    
    -- Secondary vector for body OCR content (Used only when Full-Text mode is toggled)
    body_search_vector tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(ocr_fulltext, '')), 'D')
    ) STORED,
    
    -- Audit Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(128) DEFAULT 'system_uploader'
);

-- ==============================================================================
-- 4. HIGH-PERFORMANCE SEARCH INDICES (PRIORITY TITLE FIELD INDEXING)
-- ==============================================================================

-- Index 1: Trigram GIN Index on normalized_title for Priority 3 (Fuzzy Matches)
-- Allows similarity(normalized_title, '...') queries with index acceleration
CREATE INDEX IF NOT EXISTS idx_legis_normalized_title_trgm 
    ON legislative_documents USING gin (normalized_title gin_trgm_ops);

-- Index 2: Trigram GIN Index on series_header (handles Res. No. 2026-045 variants)
CREATE INDEX IF NOT EXISTS idx_legis_series_header_trgm 
    ON legislative_documents USING gin (series_header gin_trgm_ops);

-- Index 3: Dedicated Full-Text GIN Index strictly on Title Search Vector
CREATE INDEX IF NOT EXISTS idx_legis_title_tsvector 
    ON legislative_documents USING gin (title_search_vector);

-- Index 4: Exact B-Tree Lookup on Series & Number
CREATE INDEX IF NOT EXISTS idx_legis_series_lookup 
    ON legislative_documents (series_year, series_number_only);

-- Index 5: GIN Index on Keywords Array for Tag Filtering
CREATE INDEX IF NOT EXISTS idx_legis_keywords_gin 
    ON legislative_documents USING gin (keywords);

-- Index 6: B-Tree Indexes on Legislative Dates
CREATE INDEX IF NOT EXISTS idx_legis_date_approved 
    ON legislative_documents (date_approved DESC);

-- Index 7: Body OCR Vector Index (Only queried when user enables Full-Text Search)
CREATE INDEX IF NOT EXISTS idx_legis_body_tsvector 
    ON legislative_documents USING gin (body_search_vector);

-- ==============================================================================
-- 5. AUDIT TRAIL & REVISION HISTORY TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS legislative_document_audit (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES legislative_documents(id) ON DELETE CASCADE,
    action VARCHAR(32) NOT NULL,                     -- 'UPLOAD', 'TITLE_UPDATE', 'STATUS_CHANGE'
    changed_by VARCHAR(128) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legis_audit_doc 
    ON legislative_document_audit(document_id, timestamp DESC);
`;

export const FILE_PROCESSING_WORKFLOW_STEPS = [
  {
    step: 1,
    id: 'upload_ingest',
    title: 'Batch Document Ingest & Validation',
    actor: 'Client Upload UI -> Ingestion Gateway',
    description: 'Receives multi-part file uploads (PDF, DOCX, PNG, JPG). Enforces file size limits (max 50MB), computes SHA-256 integrity hash, and executes clamAV anti-malware and MIME magic-byte verification.',
    tech: 'Express Multer / ClamAV / SHA-256 Checksum',
    output: 'Quarantined file on temporary fast SSD volume with verified metadata.',
  },
  {
    step: 2,
    id: 'ocr_preprocessing',
    title: 'Document Rasterization & Adaptive OCR',
    actor: 'OCR Worker Service (Asynchronous Queue)',
    description: 'Converts multi-page PDFs or image scans into high-contrast 300 DPI preprocessed bitmaps (deskewing, binarization, noise removal). Runs OCR (Tesseract v5 / Gemini Flash Vision) to extract full raw text with word-level bounding coordinates.',
    tech: 'Ghostscript / ImageMagick / Tesseract-v5 / Gemini 3.8 Flash Vision',
    output: 'Full digitized text (ocr_fulltext) with confidence score (e.g. 98.4%).',
  },
  {
    step: 3,
    id: 'header_nlp_extraction',
    title: 'Header Scan & Metadata Auto-Extraction',
    actor: 'Rule-Based Regex Engine + Gemini NLP Entity Extractor',
    description: 'Analyzes the first 1,500 characters of the document header. Detects legislative series patterns ("Resolution No. YYYY-XXX"), legislative body session date, enacted/approved timestamps, and author sponsor blocks.',
    tech: 'Deterministic Header Regex + Gemini 3.8 Flash Structured JSON',
    output: 'Pre-filled metadata draft: { resolution_number, doc_type, date_passed, authors, raw_title }',
  },
  {
    step: 4,
    id: 'title_normalization',
    title: 'Standard Title Formatting & Normalization',
    actor: 'LIS Normalizer Service',
    description: 'Enforces the mandatory format "[Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]". Strips redundant spaces, trailing periods, and non-alphanumerics. Produces separate series_header ("Resolution No. 2026-045") and normalized_title ("RESOLUTION NO 2026-045 A RESOLUTION AUTHORIZING...").',
    tech: 'TypeScript Title Engine / PostgreSQL Regex Parser',
    output: 'Split series index, subject title, and unpunctuated normalized title string.',
  },
  {
    step: 5,
    id: 'human_in_the_loop_review',
    title: 'Legislative Staff Verification & Review Form',
    actor: 'Sanggunian Secretariat Reviewer UI',
    description: 'Side-by-side interactive interface rendering the original document scan alongside extracted fields. Shows format validation badges. The clerk can override or confirm any field before database commitment.',
    tech: 'React 19 / PDF.js Canvas / Real-Time Schema Validator',
    output: 'Staff-approved verified document payload.',
  },
  {
    step: 6,
    id: 'database_transaction_indexing',
    title: 'Atomic DB Transaction & Search Indexing',
    actor: 'PostgreSQL Relational Storage & Object Storage',
    description: 'Commits document record into `legislative_documents` table with generated title_search_vector and trigram indices. Moves physical file from quarantine into secure immutable cold storage. Emits audit log entry.',
    tech: 'PostgreSQL 15 GIN/Trigram + S3/MinIO Encrypted Bucket',
    output: 'Persisted UUID document ready for instantaneous sub-10ms precision title search.',
  }
];

export const TITLE_SEARCH_SQL_QUERY = `-- ==============================================================================
-- TITLE-BASED PRECISION SEARCH ENGINE QUERY (POSTGRESQL 15+)
-- Prioritizes Title & Series Fields over noisy body text.
-- Calculates Priority 1, Priority 2, and Priority 3 Ranking Scores.
-- ==============================================================================

-- Parameters:
--   :search_query   = 'Health Services' (or '"Health Services"', '2026-045')
--   :doc_type       = 'Resolution' (or 'ALL')
--   :year_filter    = 2026 (or NULL)
--   :prefix_filter  = 'A RESOLUTION AUTHORIZING' (or NULL)
--   :full_text_mode = FALSE (default strictly restricts search to Title & Series)

WITH QueryParams AS (
    SELECT 
        TRIM(:search_query) AS raw_query,
        UPPER(REGEXP_REPLACE(TRIM(:search_query), '[^a-zA-Z0-9\\s]', '', 'g')) AS norm_query,
        -- Extract series pattern if user typed series numbers like 2026-045
        SUBSTRING(TRIM(:search_query) FROM '(\\d{4}-\\d+)') AS extracted_series
),

ScoredDocuments AS (
    SELECT 
        d.id,
        d.doc_type,
        d.resolution_number,
        d.series_header,
        d.series_year,
        d.series_number_only,
        d.resolution_title,
        d.subject_title,
        d.normalized_title,
        d.keywords,
        d.date_passed,
        d.date_approved,
        d.author_sponsors,
        d.file_path,
        d.file_name,
        d.classification_status,
        
        -- Trigram Similarity against normalized title (0.0 to 1.0)
        similarity(d.normalized_title, q.norm_query) AS trigram_score,
        
        -- Full-text title rank using English dictionary tsvector
        ts_rank_cd(d.title_search_vector, plainto_tsquery('english', q.raw_query)) AS title_ts_rank,

        -- ====================================================================
        -- 3-TIER RELEVANCE RANKING HIERARCHY
        -- ====================================================================
        CASE
            -- PRIORITY 1: Exact Series or Exact Title Match (100% Score)
            WHEN q.extracted_series IS NOT NULL AND (
                d.series_number_only = q.extracted_series OR 
                d.resolution_number ILIKE '%' || q.extracted_series || '%'
            ) THEN 1
            
            WHEN d.normalized_title = q.norm_query OR d.subject_title ILIKE q.raw_query THEN 1
            
            -- Priority 1.1: Exact Quoted Phrase in Title (e.g. "Health Services")
            WHEN q.raw_query LIKE '"%"' AND d.resolution_title ILIKE '%' || REPLACE(q.raw_query, '"', '') || '%' THEN 1

            -- PRIORITY 2: Title Word Order Match / Phrase Match (75 - 95% Score)
            WHEN d.normalized_title ILIKE '%' || q.norm_query || '%' THEN 2
            WHEN d.title_search_vector @@ phraseto_tsquery('english', q.raw_query) THEN 2
            WHEN d.title_search_vector @@ plainto_tsquery('english', q.raw_query) THEN 2

            -- PRIORITY 3: Fuzzy Match in Title (Trigram threshold >= 0.30)
            WHEN similarity(d.normalized_title, q.norm_query) >= 0.30 THEN 3

            -- PRIORITY 4: Full-Text Body Match (Only evaluated if :full_text_mode IS TRUE)
            WHEN :full_text_mode = TRUE AND d.body_search_vector @@ plainto_tsquery('english', q.raw_query) THEN 4
            
            ELSE 99 -- Not matched
        END AS priority_tier,

        -- Computed Normalized Score (0 - 100 scale)
        CASE
            WHEN q.extracted_series IS NOT NULL AND (
                d.series_number_only = q.extracted_series OR 
                d.resolution_number ILIKE '%' || q.extracted_series || '%'
            ) THEN 100.0
            
            WHEN d.normalized_title = q.norm_query THEN 100.0
            WHEN q.raw_query LIKE '"%"' AND d.resolution_title ILIKE '%' || REPLACE(q.raw_query, '"', '') || '%' THEN 96.0
            WHEN d.normalized_title ILIKE '%' || q.norm_query || '%' THEN 88.0
            WHEN d.title_search_vector @@ phraseto_tsquery('english', q.raw_query) THEN 82.0
            WHEN d.title_search_vector @@ plainto_tsquery('english', q.raw_query) THEN 75.0
            WHEN similarity(d.normalized_title, q.norm_query) >= 0.30 THEN 
                 ROUND((40.0 + (similarity(d.normalized_title, q.norm_query) * 35.0))::numeric, 1)
            WHEN :full_text_mode = TRUE AND d.body_search_vector @@ plainto_tsquery('english', q.raw_query) THEN 45.0
            ELSE 0.0
        END AS relevance_score

    FROM legislative_documents d
    CROSS JOIN QueryParams q
    WHERE
        -- Dynamic Filters
        (:doc_type = 'ALL' OR d.doc_type::text = :doc_type)
        AND (:year_filter IS NULL OR d.series_year = :year_filter)
        AND (:prefix_filter IS NULL OR d.subject_title ILIKE :prefix_filter || '%')
)

SELECT 
    id,
    doc_type,
    resolution_number,
    resolution_title,
    subject_title,
    keywords,
    date_passed,
    date_approved,
    author_sponsors,
    file_path,
    priority_tier,
    relevance_score,
    CASE 
        WHEN priority_tier = 1 THEN 'Priority 1: Exact Match (100%)'
        WHEN priority_tier = 2 THEN 'Priority 2: Word Order Match'
        WHEN priority_tier = 3 THEN 'Priority 3: Fuzzy Match in Title'
        WHEN priority_tier = 4 THEN 'Priority 4: Full-Text Body Match'
        ELSE 'Unranked'
    END AS priority_label
FROM ScoredDocuments
WHERE priority_tier <= (CASE WHEN :full_text_mode = TRUE THEN 4 ELSE 3 END)
ORDER BY 
    priority_tier ASC,          -- Priority 1 always ranks above Priority 2 and 3
    relevance_score DESC,       -- Higher score within tier ranks higher
    date_approved DESC          -- Recency tie-breaker
LIMIT 50;
`;
