-- ============================================================================
-- MIGRATION: 20260922_001_create_legislative_print_logs.sql
-- SYSTEM: Legislative Information System (LIS)
-- JURISDICTION: Municipality of Mutia, Zamboanga del Norte
-- DESCRIPTION: Schema definition and audit logging table for physical and
--              network document printing of legislative resolutions & ordinances.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. TABLE: print_logs
-- Stores an immutable audit trail of every legislative print job dispatched
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS print_logs (
    print_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Document Reference
    document_id UUID NOT NULL,
    resolution_number VARCHAR(120) NOT NULL,
    subject_title TEXT NOT NULL,
    
    -- User & Authorization Attribution
    printed_by_id VARCHAR(80) NOT NULL,
    printed_by_name VARCHAR(150) NOT NULL,
    printed_by_role VARCHAR(80) NOT NULL,
    
    -- Device & Network Topology
    printer_name VARCHAR(150) NOT NULL,
    printer_type VARCHAR(50) NOT NULL DEFAULT 'Network (LAN/IP)',
    printer_ip VARCHAR(45) NULL,
    
    -- Job Configuration
    copies_printed INTEGER NOT NULL DEFAULT 1 CHECK (copies_printed > 0 AND copies_printed <= 100),
    collated BOOLEAN NOT NULL DEFAULT TRUE,
    paper_size VARCHAR(30) NOT NULL DEFAULT 'Legal' CHECK (paper_size IN ('Legal', 'Letter', 'A4', 'Executive')),
    orientation VARCHAR(20) NOT NULL DEFAULT 'Portrait' CHECK (orientation IN ('Portrait', 'Landscape')),
    color_mode VARCHAR(40) NOT NULL DEFAULT 'Grayscale / Monochrome',
    two_sided VARCHAR(20) NOT NULL DEFAULT 'none',
    
    -- Security & Legislative Watermarking
    watermark_applied VARCHAR(80) NOT NULL DEFAULT 'NONE',
    line_numbers_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    qr_seal_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Cryptographic Integrity Verification
    security_hash VARCHAR(128) NOT NULL,
    
    -- Status & Timestamps
    status VARCHAR(30) NOT NULL DEFAULT 'Completed' CHECK (status IN ('Completed', 'Queued', 'Printing', 'Failed', 'Cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------------------------------------------------------
-- 2. INDEXES: Fast retrieval for audit reporting & document inspection
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_print_logs_doc_id ON print_logs (document_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_res_number ON print_logs (resolution_number);
CREATE INDEX IF NOT EXISTS idx_print_logs_printed_by ON print_logs (printed_by_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_created_at ON print_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_print_logs_printer ON print_logs (printer_name);
CREATE INDEX IF NOT EXISTS idx_print_logs_security_hash ON print_logs (security_hash);

-- Composite index for quick verification lookup
CREATE INDEX IF NOT EXISTS idx_print_logs_doc_timestamp ON print_logs (document_id, created_at DESC);

-- ----------------------------------------------------------------------------
-- 3. AUDIT IMMUTABILITY ENFORCEMENT
-- Legislative audit records cannot be altered or overwritten once committed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_print_logs_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Security Policy Violation: Legislative print audit records are append-only and cannot be modified.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Security Policy Violation: Legislative print audit records cannot be deleted.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_print_logs ON print_logs;
CREATE TRIGGER trg_protect_print_logs
    BEFORE UPDATE OR DELETE ON print_logs
    FOR EACH ROW
    EXECUTE FUNCTION prevent_print_logs_modification();

-- ----------------------------------------------------------------------------
-- 4. INITIAL SEED AUDIT LOG ENTRIES (Demonstration & Initial Tracking)
-- ----------------------------------------------------------------------------
INSERT INTO print_logs (
    print_id,
    document_id,
    resolution_number,
    subject_title,
    printed_by_id,
    printed_by_name,
    printed_by_role,
    printer_name,
    printer_type,
    copies_printed,
    paper_size,
    orientation,
    color_mode,
    watermark_applied,
    line_numbers_enabled,
    qr_seal_enabled,
    security_hash,
    status,
    created_at
) VALUES 
(
    'e1111111-2222-3333-4444-555555555551',
    'a1b2c3d4-e5f6-7a8b-9c0d-111111111111',
    'Resolution No. 2026-045',
    'A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES',
    'USR-SEC-01',
    'Hon. Maria Elena Santos',
    'Secretariat Administrator',
    'HP LaserJet Enterprise M608dn',
    'Network (LAN/IP)',
    3,
    'Legal',
    'Portrait',
    'Grayscale / Monochrome',
    'CERTIFIED TRUE COPY',
    FALSE,
    TRUE,
    'MUTIA-SB-2026-045-89AF7B3C',
    'Completed',
    '2026-03-19 09:15:22+08'
),
(
    'e2222222-3333-4444-5555-666666666662',
    'a1b2c3d4-e5f6-7a8b-9c0d-222222222222',
    'Resolution No. 2026-104',
    'A RESOLUTION APPROVING THE ANNUAL DISASTER RISK REDUCTION AND CLIMATE ADAPTATION INVESTMENT PLAN FOR FISCAL YEAR 2026',
    'USR-STF-04',
    'Atty. Arthur Pendelton',
    'SB Legislative Staff',
    'Canon imageRUNNER ADVANCE DX C357i',
    'Network (LAN/IP)',
    2,
    'Legal',
    'Portrait',
    'Official Full Color',
    'OFFICIAL COPY',
    TRUE,
    TRUE,
    'MUTIA-SB-2026-104-44C1D90A',
    'Completed',
    '2026-05-06 14:30:10+08'
)
ON CONFLICT (print_id) DO NOTHING;
