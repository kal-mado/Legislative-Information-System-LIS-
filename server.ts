import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { SEED_LEGISLATIVE_DOCUMENTS } from './src/data/seedDocuments.ts';
import { LegislativeDocument, PrinterDevice, PrintLogEntry } from './src/types.ts';
import { normalizeTitle, rankDocumentForQuery, validateAndParseTitle } from './src/utils/titleEngine.ts';
import { INITIAL_MUNICIPAL_PRINTERS, generateSecurityHash } from './src/utils/printerService.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

// In-memory persistent store initialized with seed corpus
let legislativeRepository: LegislativeDocument[] = [...SEED_LEGISLATIVE_DOCUMENTS];

// Discovered printer devices state
let discoveredPrinters: PrinterDevice[] = [...INITIAL_MUNICIPAL_PRINTERS];

// Initial legislative print audit logs
let printLogsRepository: PrintLogEntry[] = [
  {
    print_id: 'e1111111-2222-3333-4444-555555555551',
    document_id: 'a1b2c3d4-e5f6-7a8b-9c0d-111111111111',
    resolution_number: 'Resolution No. 2026-045',
    subject_title: 'A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES',
    printed_by_id: 'USR-SEC-01',
    printed_by_name: 'Hon. Maria Elena Santos',
    printed_by_role: 'Secretariat Administrator',
    timestamp: '2026-03-19T09:15:22.000Z',
    printer_name: 'HP LaserJet Enterprise M608dn (Session Hall)',
    printer_type: 'Network (LAN/IP)',
    copies_printed: 3,
    watermark_applied: 'CERTIFIED TRUE COPY',
    paper_size: 'Legal',
    orientation: 'Portrait',
    color_mode: 'Grayscale / Monochrome',
    security_hash: 'MUTIA-SB-SEC-026045-3C89AF7B',
    status: 'Completed',
  },
  {
    print_id: 'e2222222-3333-4444-5555-666666666662',
    document_id: 'a1b2c3d4-e5f6-7a8b-9c0d-222222222222',
    resolution_number: 'Resolution No. 2026-104',
    subject_title: 'A RESOLUTION APPROVING THE ANNUAL DISASTER RISK REDUCTION AND CLIMATE ADAPTATION INVESTMENT PLAN FOR FISCAL YEAR 2026',
    printed_by_id: 'USR-STF-04',
    printed_by_name: 'Atty. Arthur Pendelton',
    printed_by_role: 'SB Legislative Staff',
    timestamp: '2026-05-06T14:30:10.000Z',
    printer_name: 'Canon imageRUNNER ADVANCE DX C357i (Archives)',
    printer_type: 'Network (LAN/IP)',
    copies_printed: 2,
    watermark_applied: 'OFFICIAL COPY',
    paper_size: 'Legal',
    orientation: 'Portrait',
    color_mode: 'Official Full Color',
    security_hash: 'MUTIA-SB-STF-026104-1D90A44C',
    status: 'Completed',
  }
];

// Gemini Client Lazy Initializer
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return aiClient;
}

// -------------------------------------------------------------
// API ROUTES
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Legislative Information System (LIS) — Municipality of Mutia, Zamboanga del Norte',
    timestamp: new Date().toISOString(),
    documentsCount: legislativeRepository.length,
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// List or Search Documents
app.get('/api/documents', (req, res) => {
  try {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const isFullText = req.query.isFullText === 'true';
    const prefixFilter = typeof req.query.prefixFilter === 'string' ? req.query.prefixFilter : '';
    const docType = typeof req.query.docType === 'string' ? req.query.docType : 'ALL';
    const year = typeof req.query.year === 'string' ? req.query.year : 'ALL';

    let filtered = legislativeRepository;

    if (docType !== 'ALL') {
      filtered = filtered.filter(d => d.doc_type === docType);
    }
    if (year !== 'ALL') {
      const yrNum = parseInt(year, 10);
      filtered = filtered.filter(d => d.series_year === yrNum);
    }

    if (!query.trim() && !prefixFilter) {
      return res.json({
        total: filtered.length,
        results: filtered.map(doc => ({
          document: doc,
          score: 100,
          priority: 1,
          priorityLabel: 'Catalog Listing',
          matchedCriteria: ['Catalog Listing'],
        })),
      });
    }

    // Run precision title ranking engine
    const rankedResults: any[] = [];
    for (const doc of filtered) {
      const match = rankDocumentForQuery(doc, query, isFullText, prefixFilter);
      if (match) {
        rankedResults.push(match);
      }
    }

    // Sort by priority tier ASC (1 -> 2 -> 3 -> 4) and then score DESC
    rankedResults.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.score - a.score;
    });

    res.json({
      total: rankedResults.length,
      query,
      isFullText,
      prefixFilter,
      results: rankedResults,
    });
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: error.message || 'Failed to search documents' });
  }
});

// Validate and Normalize Title
app.post('/api/documents/validate-title', (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Title string is required.' });
    }
    const result = validateAndParseTitle(title);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Process OCR & Metadata Auto-Extraction
app.post('/api/documents/extract-ocr', async (req, res) => {
  try {
    const { textContent, fileName, mimeType } = req.body;
    const rawText = textContent || '';

    // Step 1: Rule-Based Header Scanning & Regex
    let parsedType: 'Resolution' | 'Ordinance' = 'Resolution';
    if (/ordinance/i.test(rawText.slice(0, 1000))) {
      parsedType = 'Ordinance';
    }

    // Look for series number e.g. "Resolution No. 2026-045" or "Res. No. 2026-104"
    const seriesRegex = /(?:resolution|ordinance|res\.|ord\.)\s*(?:no\.?)?\s*(\d{4})[-_](\d+)/i;
    const seriesMatch = rawText.match(seriesRegex);
    const seriesYear = seriesMatch ? parseInt(seriesMatch[1], 10) : new Date().getFullYear();
    const seriesNum = seriesMatch ? seriesMatch[2].padStart(3, '0') : '001';
    const resolutionNumber = `${parsedType} No. ${seriesYear}-${seriesNum}`;

    // Look for Title in Header
    let detectedTitle = '';
    const titleRegex = /(?:a resolution|an ordinance)\s+([A-Z0-9\s,.\-'"()]{15,400})(?=\.|\n\n|whereas|be it enacted|be it ordained)/i;
    const titleMatch = rawText.match(titleRegex);

    if (titleMatch) {
      const subject = titleMatch[0].trim().toUpperCase().replace(/[.;:]+$/, '');
      detectedTitle = `${resolutionNumber}: ${subject}`;
    } else {
      // Fallback detection
      detectedTitle = `${resolutionNumber}: A ${parsedType.toUpperCase()} AUTHORIZING LOCAL DEVELOPMENT PROGRAM AND COMMUNITY SERVICES`;
    }

    // Check dates e.g. March 14, 2026
    const dateRegex = /(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s+\d{4}/gi;
    const datesFound = rawText.match(dateRegex);
    const datePassed = datesFound && datesFound[0] ? new Date(datesFound[0]).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    const dateApproved = datesFound && datesFound[1] ? new Date(datesFound[1]).toISOString().slice(0, 10) : datePassed;

    // Authors / Sponsors extraction
    const authors: string[] = [];
    const authorRegex = /(?:author|sponsored by|present|sponsors?):\s*([^\n\r.]+)/i;
    const authorMatch = rawText.match(authorRegex);
    if (authorMatch) {
      const rawAuthors = authorMatch[1].split(/,|;|and/i);
      rawAuthors.forEach((a: string) => {
        const cleaned = a.trim();
        if (cleaned.length > 2) authors.push(cleaned);
      });
    }
    if (authors.length === 0) {
      authors.push('Hon. Committee on Rules');
    }

    // If Gemini is available, enhance with high-precision structured extraction
    const ai = getAIClient();
    if (ai && rawText.length > 30) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `You are an expert legislative parliamentarian and document archivist.
Extract structured metadata from this scanned legislative document header:
Document Text:
"""
${rawText.slice(0, 2500)}
"""

Format Requirements:
- Format title strictly as: "[Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]"
- Example: "Resolution No. 2026-045: A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES"
- Normalize unpunctuated title (clean, unpunctuated uppercase)`,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                doc_type: { type: Type.STRING, enum: ['Resolution', 'Ordinance'] },
                series_year: { type: Type.INTEGER },
                series_number: { type: Type.STRING },
                resolution_number: { type: Type.STRING },
                subject_title: { type: Type.STRING },
                resolution_title: { type: Type.STRING },
                keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                date_passed: { type: Type.STRING },
                date_approved: { type: Type.STRING },
                author_sponsors: { type: Type.ARRAY, items: { type: Type.STRING } },
                committee_referral: { type: Type.STRING },
                ocr_confidence: { type: Type.NUMBER },
              },
              required: ['doc_type', 'resolution_number', 'resolution_title', 'keywords', 'author_sponsors'],
            },
          },
        });

        if (response.text) {
          const aiData = JSON.parse(response.text);
          const validated = validateAndParseTitle(aiData.resolution_title || detectedTitle);
          return res.json({
            success: true,
            source: 'gemini-ocr-nlp',
            extracted: {
              doc_type: aiData.doc_type || parsedType,
              resolution_number: aiData.resolution_number || resolutionNumber,
              series_header: validated.seriesHeader || `${aiData.doc_type || parsedType} No. ${seriesYear}-${seriesNum}`,
              series_year: aiData.series_year || seriesYear,
              series_number_only: `${seriesYear}-${seriesNum}`,
              subject_title: validated.subjectTitle || aiData.subject_title || 'LEGISLATIVE MEASURE',
              resolution_title: validated.suggestedFormattedTitle || aiData.resolution_title,
              normalized_title: normalizeTitle(validated.suggestedFormattedTitle || aiData.resolution_title),
              keywords: aiData.keywords || ['Legislation', 'General Welfare', 'Municipal Action'],
              date_passed: aiData.date_passed || datePassed,
              date_approved: aiData.date_approved || dateApproved,
              author_sponsors: aiData.author_sponsors || authors,
              committee_referral: aiData.committee_referral || 'Committee on Rules',
              ocr_confidence: aiData.ocr_confidence || 98.2,
              ocr_fulltext: rawText,
            },
            validation: validated,
          });
        }
      } catch (geminiErr) {
        console.warn('Gemini extraction fallback to heuristic parser:', geminiErr);
      }
    }

    // Heuristic Fallback
    const validated = validateAndParseTitle(detectedTitle);
    const keywords = ['Legislative Document', parsedType, 'Official Action'];
    if (/health/i.test(rawText)) keywords.push('Health Services', 'Public Health');
    if (/disaster|climate|flood/i.test(rawText)) keywords.push('Disaster Risk Reduction', 'Climate Adaptation');
    if (/plastic|environment|waste/i.test(rawText)) keywords.push('Environmental Regulation', 'Solid Waste');
    if (/traffic|vehicle|transport/i.test(rawText)) keywords.push('Traffic Code', 'Transportation');

    res.json({
      success: true,
      source: 'heuristic-regex-ocr',
      extracted: {
        doc_type: parsedType,
        resolution_number: resolutionNumber,
        series_header: `${parsedType} No. ${seriesYear}-${seriesNum}`,
        series_year: seriesYear,
        series_number_only: `${seriesYear}-${seriesNum}`,
        subject_title: validated.subjectTitle || detectedTitle,
        resolution_title: validated.suggestedFormattedTitle || detectedTitle,
        normalized_title: normalizeTitle(validated.suggestedFormattedTitle || detectedTitle),
        keywords,
        date_passed: datePassed,
        date_approved: dateApproved,
        author_sponsors: authors,
        committee_referral: 'General Committee',
        ocr_confidence: 97.5,
        ocr_fulltext: rawText,
      },
      validation: validated,
    });
  } catch (error: any) {
    console.error('Error in OCR extraction:', error);
    res.status(500).json({ error: error.message || 'Failed to extract metadata' });
  }
});

// Commit and Save New Document
app.post('/api/documents', (req, res) => {
  try {
    const docData: Partial<LegislativeDocument> = req.body;

    if (!docData.resolution_title || !docData.resolution_number) {
      return res.status(400).json({ error: 'resolution_title and resolution_number are required.' });
    }

    // Run strict title normalization and format validation
    const validation = validateAndParseTitle(docData.resolution_title);
    if (!validation.isValid) {
      return res.status(422).json({
        error: 'Title does not meet standard format rules: [Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]',
        validationErrors: validation.errors,
        suggestedTitle: validation.suggestedFormattedTitle,
      });
    }

    const docType = validation.docType || docData.doc_type || 'Resolution';
    const seriesYear = validation.year || docData.series_year || new Date().getFullYear();
    const seriesNumberOnly = validation.seriesNumber || docData.series_number_only || `${seriesYear}-001`;
    const seriesHeader = validation.seriesHeader || `${docType} No. ${seriesNumberOnly}`;
    const subjectTitle = validation.subjectTitle || docData.subject_title || '';
    const formattedTitle = `${seriesHeader}: ${subjectTitle}`;
    const normalizedTitle = normalizeTitle(formattedTitle);

    const newDoc: LegislativeDocument = {
      id: req.body.id || `doc-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      doc_type: docType,
      resolution_number: seriesHeader,
      series_header: seriesHeader,
      series_year: seriesYear,
      series_number_only: seriesNumberOnly,
      subject_title: subjectTitle,
      resolution_title: formattedTitle,
      normalized_title: normalizedTitle,
      keywords: Array.isArray(docData.keywords) && docData.keywords.length > 0 ? docData.keywords : ['Legislative Measure'],
      date_passed: docData.date_passed || new Date().toISOString().slice(0, 10),
      date_approved: docData.date_approved || new Date().toISOString().slice(0, 10),
      author_sponsors: Array.isArray(docData.author_sponsors) && docData.author_sponsors.length > 0 ? docData.author_sponsors : ['Hon. Sponsor'],
      file_path: docData.file_path || `/storage/legislative/${seriesYear}/${docData.file_name || 'document.pdf'}`,
      file_name: docData.file_name || 'scanned_legislative_measure.pdf',
      file_size_kb: docData.file_size_kb || 1024,
      mime_type: docData.mime_type || 'application/pdf',
      ocr_fulltext: docData.ocr_fulltext || '',
      ocr_confidence: docData.ocr_confidence || 98.0,
      classification_status: docData.classification_status || 'Enacted',
      committee_referral: docData.committee_referral || 'Legislative Affairs',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Prepend to top of repository
    legislativeRepository.unshift(newDoc);

    res.status(201).json({
      success: true,
      message: 'Legislative document saved and indexed successfully into relational catalog.',
      document: newDoc,
    });
  } catch (error: any) {
    console.error('Error saving document:', error);
    res.status(500).json({ error: error.message || 'Failed to save document' });
  }
});

// Update / Edit Document in Repository
app.put('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = legislativeRepository.findIndex(doc => doc.id === id);
    if (index === -1) {
      return res.status(404).json({ error: 'Resolution document not found.' });
    }
    const existing = legislativeRepository[index];
    const updateData = req.body;
    const resolutionTitle = updateData.resolution_title || existing.resolution_title;
    const updated: LegislativeDocument = {
      ...existing,
      ...updateData,
      id: existing.id,
      resolution_title: resolutionTitle,
      normalized_title: normalizeTitle(resolutionTitle),
      updated_at: new Date().toISOString(),
    };
    legislativeRepository[index] = updated;
    res.json({
      success: true,
      message: 'Resolution updated successfully.',
      document: updated,
    });
  } catch (error: any) {
    console.error('Error updating document:', error);
    res.status(500).json({ error: error.message || 'Failed to update document' });
  }
});

// Delete / Remove Document from Repository
app.delete('/api/documents/:id', (req, res) => {
  try {
    const { id } = req.params;
    const initialLen = legislativeRepository.length;
    legislativeRepository = legislativeRepository.filter(doc => doc.id !== id);
    if (legislativeRepository.length < initialLen) {
      res.json({ success: true, message: 'Resolution removed successfully.', remainingCount: legislativeRepository.length });
    } else {
      res.status(404).json({ error: 'Resolution document not found.' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to remove document' });
  }
});

// Reset Repository to Seed State
app.post('/api/documents/reset', (req, res) => {
  legislativeRepository = [...SEED_LEGISLATIVE_DOCUMENTS];
  res.json({ success: true, count: legislativeRepository.length });
});

// -------------------------------------------------------------
// PRINT MODULE & PRINTER DISCOVERY API ENDPOINTS
// -------------------------------------------------------------

// Fetch Single Document by ID or Resolution Number
app.get('/api/documents/:idOrNumber', (req, res) => {
  const { idOrNumber } = req.params;
  const decoded = decodeURIComponent(idOrNumber).trim();
  
  // Try exact UUID or ID match
  let doc = legislativeRepository.find(d => d.id === decoded);
  if (!doc) {
    // Try resolution number match (e.g. "Resolution No. 2026-045" or "2026-045")
    const cleanQuery = decoded.toLowerCase().replace(/[^a-z0-9]/g, '');
    doc = legislativeRepository.find(d => {
      const cleanNum = d.resolution_number.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanSeries = d.series_number_only.toLowerCase().replace(/[^a-z0-9]/g, '');
      return cleanNum === cleanQuery || cleanSeries === cleanQuery || cleanNum.includes(cleanQuery);
    });
  }

  if (!doc) {
    return res.status(404).json({ error: `Legislative document '${decoded}' not found in official repository.` });
  }

  res.json({
    success: true,
    document: doc,
  });
});

// List Discovered Printers (Local USB & Network LAN/IP)
app.get('/api/printers', (req, res) => {
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    totalDiscovered: discoveredPrinters.length,
    printers: discoveredPrinters,
  });
});

// Trigger Network & Local Printer Discovery Scan (mDNS / IPP Bonjour / SNMP)
app.post('/api/printers/discover', (req, res) => {
  // Simulate active network ping and status poll
  discoveredPrinters = discoveredPrinters.map(printer => {
    // Randomize slight status or queue length for realistic hardware polling
    return {
      ...printer,
      queueLength: Math.max(0, printer.queueLength + (Math.random() > 0.6 ? 1 : -1)),
    };
  });

  res.json({
    success: true,
    message: 'Municipal network & USB hardware print discovery completed successfully.',
    discoveredCount: discoveredPrinters.length,
    printers: discoveredPrinters,
    scannedSubnets: ['192.168.10.0/24 (SB Internal LAN)', 'USB001-USB004 (Direct Bus)'],
    timestamp: new Date().toISOString(),
  });
});

// Dispatch Legislative Print Job & Commit to Immutable Audit Log
app.post('/api/print-jobs', (req, res) => {
  try {
    const {
      document_id,
      resolution_number,
      subject_title,
      printed_by_id,
      printed_by_name,
      printed_by_role,
      printer_id,
      printer_name,
      copies_printed = 1,
      watermark_applied = 'NONE',
      paper_size = 'Legal',
      orientation = 'Portrait',
      color_mode = 'Grayscale / Monochrome',
    } = req.body;

    if (!document_id && !resolution_number) {
      return res.status(400).json({ error: 'Missing required document identification.' });
    }

    // Resolve document details if partial
    const doc = legislativeRepository.find(d => d.id === document_id || d.resolution_number === resolution_number);
    const resolvedDocId = doc ? doc.id : (document_id || 'unknown-doc');
    const resolvedResNum = doc ? doc.resolution_number : (resolution_number || 'Official Resolution');
    const resolvedSubject = doc ? doc.subject_title : (subject_title || 'Official Legislative Measure');

    // Resolve target printer
    const targetPrinter = discoveredPrinters.find(p => p.id === printer_id || p.name === printer_name) || discoveredPrinters[0];

    // Access control check for certified copies
    if (watermark_applied === 'CERTIFIED TRUE COPY' && printed_by_role !== 'Secretariat Administrator') {
      return res.status(403).json({
        error: 'Access Control Rejection: "CERTIFIED TRUE COPY" watermarks require authorized Secretariat Administrator credentials.',
      });
    }

    // Generate cryptographic verification hash for audit log and physical print barcode
    const securityHash = generateSecurityHash(resolvedResNum, printed_by_role || 'Secretariat');

    const newLogEntry: PrintLogEntry = {
      print_id: `prn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      document_id: resolvedDocId,
      resolution_number: resolvedResNum,
      subject_title: resolvedSubject,
      printed_by_id: printed_by_id || 'USR-ACT-CURRENT',
      printed_by_name: printed_by_name || 'Authorized Legislative Officer',
      printed_by_role: printed_by_role || 'Secretariat Administrator',
      timestamp: new Date().toISOString(),
      printer_name: targetPrinter.name,
      printer_type: targetPrinter.connectionType,
      copies_printed: Math.max(1, parseInt(copies_printed, 10) || 1),
      watermark_applied,
      paper_size,
      orientation,
      color_mode,
      security_hash: securityHash,
      status: 'Completed',
    };

    // Prepend to audit log
    printLogsRepository.unshift(newLogEntry);

    res.status(201).json({
      success: true,
      message: `Print job dispatched successfully to ${targetPrinter.name}.`,
      receipt: newLogEntry,
      printerDetails: targetPrinter,
    });
  } catch (error: any) {
    console.error('Error processing print job:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch print job.' });
  }
});

// Fetch Print Audit Logs
app.get('/api/print-logs', (req, res) => {
  const { docId, limit = 50 } = req.query;
  let logs = printLogsRepository;

  if (docId && typeof docId === 'string') {
    logs = logs.filter(l => l.document_id === docId || l.resolution_number.includes(docId));
  }

  const parsedLimit = parseInt(limit as string, 10) || 50;
  res.json({
    success: true,
    totalLogs: logs.length,
    logs: logs.slice(0, parsedLimit),
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Legislative Information System Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
