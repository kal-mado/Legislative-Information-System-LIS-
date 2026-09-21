import { LegislativeDocument, SearchPriority, SearchResultItem, TitleStandardValidationResult } from '../types';

/**
 * Standard Title Format:
 * [Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]
 * Example:
 * Resolution No. 2026-045: A RESOLUTION AUTHORIZING THE LOCAL CHIEF EXECUTIVE TO ENTER INTO A MEMORANDUM OF AGREEMENT FOR HEALTH SERVICES
 */

export const STANDARD_TITLE_REGEX = /^(Resolution|Ordinance)\s+No\.\s+(\d{4})-(\d+):\s+(.+)$/i;

/**
 * Clean and normalize a legislative title string:
 * 1. Strip unnecessary double spaces, tabs, newlines
 * 2. Strip trailing punctuation (. , ; : !)
 * 3. Convert to clean uppercase, unpunctuated string for deterministic index matching
 */
export function normalizeTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[^\w\s-]/g, '') // strip special non-alphanumeric except whitespace and hyphens
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates and extracts components from a title according to the Standard Format:
 * [Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]
 */
export function validateAndParseTitle(titleInput: string): TitleStandardValidationResult {
  const errors: string[] = [];
  const cleanInput = (titleInput || '').replace(/\s+/g, ' ').trim();

  if (!cleanInput) {
    return {
      isValid: false,
      errors: ['Title cannot be empty.'],
    };
  }

  const match = cleanInput.match(STANDARD_TITLE_REGEX);

  if (!match) {
    // Attempt fuzzy parsing to provide actionable guidance
    const hasDocType = /^(resolution|ordinance|res\.|ord\.)/i.test(cleanInput);
    const hasNumberColon = /no\.?\s*\d{4}-\d+/i.test(cleanInput);
    const hasColon = cleanInput.includes(':');

    if (!hasDocType) {
      errors.push('Title must begin with document type "Resolution" or "Ordinance"');
    }
    if (!hasNumberColon) {
      errors.push('Missing or invalid series format. Expected "No. YYYY-XXX" (e.g., "No. 2026-045")');
    }
    if (!hasColon) {
      errors.push('Missing colon delimiter ":" separating the series number from the subject matter');
    }

    // Try to construct suggested fix
    const approxType = cleanInput.toLowerCase().includes('ordinance') ? 'Ordinance' : 'Resolution';
    const numMatch = cleanInput.match(/(\d{4})[-_](\d+)/);
    const yr = numMatch ? numMatch[1] : '2026';
    const seq = numMatch ? numMatch[2].padStart(3, '0') : '001';
    const colonIdx = cleanInput.indexOf(':');
    const rawSubject = colonIdx > -1 ? cleanInput.slice(colonIdx + 1).trim() : cleanInput;

    const suggested = `${approxType} No. ${yr}-${seq}: ${rawSubject.toUpperCase().replace(/[.,;:]+$/, '')}`;

    return {
      isValid: false,
      suggestedFormattedTitle: suggested,
      errors: errors.length > 0 ? errors : ['Title does not conform strictly to "[Doc Type] No. [YYYY]-[Number]: [Action / Subject Matter]"'],
    };
  }

  const docType = (match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase()) as 'Resolution' | 'Ordinance';
  const year = parseInt(match[2], 10);
  const seriesNum = match[3];
  const rawSubject = match[4].trim();

  // Validate subject starts with standard prefix conventions (e.g. A RESOLUTION ..., AN ORDINANCE ...)
  const subjectUpper = rawSubject.toUpperCase().replace(/[.,;:]+$/, '');
  const seriesHeader = `${docType} No. ${year}-${seriesNum}`;

  return {
    isValid: true,
    docType,
    year,
    seriesNumber: `${year}-${seriesNum}`,
    seriesHeader,
    subjectTitle: subjectUpper,
    normalizedTitle: normalizeTitle(`${seriesHeader}: ${subjectUpper}`),
    suggestedFormattedTitle: `${seriesHeader}: ${subjectUpper}`,
    errors: [],
  };
}

/**
 * Trigram generator for fuzzy title matching (simulates PostgreSQL pg_trgm extension)
 */
function getTrigrams(text: string): Set<string> {
  const padded = `  ${text.toLowerCase()} `;
  const trigrams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) {
    trigrams.add(padded.slice(i, i + 3));
  }
  return trigrams;
}

/**
 * Computes Trigram similarity (0.0 to 1.0) identical to PostgreSQL pg_trgm similarity()
 */
export function calculateTrigramSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1.0;

  const t1 = getTrigrams(str1);
  const t2 = getTrigrams(str2);

  let intersection = 0;
  for (const tri of t1) {
    if (t2.has(tri)) intersection++;
  }

  const union = t1.size + t2.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Levenshtein distance for fuzzy character typing errors
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Parse Search Query into structure:
 * - exactSeries: series number e.g. "2026-045"
 * - quotedPhrases: ["Health Services"]
 * - andTokens: words joined by AND
 * - orTokens: words joined by OR
 * - rawTokens: general words
 */
export interface ParsedSearchQuery {
  exactSeries?: string;
  quotedPhrases: string[];
  andTokens: string[];
  orTokens: string[];
  generalTokens: string[];
  rawCleanQuery: string;
}

export function parseSearchQuery(query: string): ParsedSearchQuery {
  const clean = query.trim();
  const quotedPhrases: string[] = [];

  // 1. Extract quoted phrases e.g. "Health Services"
  const phraseRegex = /"([^"]+)"/g;
  let phraseMatch;
  let remainingText = clean;
  while ((phraseMatch = phraseRegex.exec(clean)) !== null) {
    if (phraseMatch[1].trim()) {
      quotedPhrases.push(phraseMatch[1].trim().toUpperCase());
    }
  }
  remainingText = remainingText.replace(phraseRegex, ' ').trim();

  // 2. Detect series pattern e.g. 2026-045 or Res. No. 2026-045
  let exactSeries: string | undefined;
  const seriesPattern = /(?:(?:res(?:olution)?|ord(?:inance)?)\.?\s*(?:no\.?)?\s*)?(\b\d{4}-\d+\b)/i;
  const seriesMatch = clean.match(seriesPattern);
  if (seriesMatch && seriesMatch[1]) {
    exactSeries = seriesMatch[1];
  }

  // 3. Detect Boolean AND / OR
  const andTokens: string[] = [];
  const orTokens: string[] = [];
  const generalTokens: string[] = [];

  const parts = remainingText.split(/\s+/).filter(Boolean);
  let mode: 'AND' | 'OR' | 'DEFAULT' = 'DEFAULT';

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const upper = p.toUpperCase();

    if (upper === 'AND') {
      mode = 'AND';
      continue;
    } else if (upper === 'OR') {
      mode = 'OR';
      continue;
    }

    if (mode === 'AND') {
      andTokens.push(upper);
    } else if (mode === 'OR') {
      orTokens.push(upper);
    } else {
      generalTokens.push(upper);
    }
  }

  return {
    exactSeries,
    quotedPhrases,
    andTokens,
    orTokens,
    generalTokens,
    rawCleanQuery: clean,
  };
}

/**
 * Execute precision ranking algorithm prioritizing the document Title Field:
 * Priority 1: Exact Title Match (100% score)
 * Priority 2: Title Word Order Match (70 - 95% score)
 * Priority 3: Fuzzy Match in Title (40 - 70% score)
 * Full-Text Match (if toggled on): lower priority if only found in body
 */
export function rankDocumentForQuery(
  doc: LegislativeDocument,
  query: string,
  isFullTextMode: boolean = false,
  prefixFilter: string = ''
): SearchResultItem | null {
  if (!query.trim() && !prefixFilter) {
    // Return all if query is empty
    return {
      document: doc,
      score: 100,
      priority: 1,
      priorityLabel: 'Priority 1: Catalog View',
      matchedCriteria: ['Catalog Listing'],
    };
  }

  const cleanQuery = query.trim();
  const normalizedQuery = normalizeTitle(cleanQuery);
  const parsed = parseSearchQuery(cleanQuery);

  // Prefix Filter check
  if (prefixFilter && prefixFilter.trim()) {
    const cleanPrefix = prefixFilter.toUpperCase().trim();
    if (!doc.subject_title.toUpperCase().startsWith(cleanPrefix)) {
      return null;
    }
  }

  if (!cleanQuery) {
    return {
      document: doc,
      score: 95,
      priority: 2,
      priorityLabel: 'Prefix Matched',
      matchedCriteria: [`Prefix Filter: "${prefixFilter}"`],
    };
  }

  const normDocTitle = doc.normalized_title;
  const normSubject = normalizeTitle(doc.subject_title);
  const normSeriesHeader = normalizeTitle(doc.series_header);
  const resNumberClean = doc.resolution_number.toUpperCase().replace(/\s+/g, ' ');

  const matchedCriteria: string[] = [];

  // ==========================================
  // PRIORITY 1: Exact Title or Series Match
  // ==========================================
  // Check exact series match (e.g. "2026-045" or "Res. No. 2026-045")
  if (parsed.exactSeries && (doc.series_number_only.includes(parsed.exactSeries) || resNumberClean.includes(parsed.exactSeries))) {
    matchedCriteria.push(`Exact Series Match [${parsed.exactSeries}]`);
    return {
      document: doc,
      score: 100,
      priority: 1,
      priorityLabel: 'Priority 1: Exact Series Match',
      matchedCriteria,
      titleMatchedFragment: doc.resolution_number,
    };
  }

  // Check exact full title match or exact subject title match
  if (normDocTitle === normalizedQuery || normSubject === normalizedQuery) {
    matchedCriteria.push('Exact 100% Full Title Match');
    return {
      document: doc,
      score: 100,
      priority: 1,
      priorityLabel: 'Priority 1: Exact Title Match',
      matchedCriteria,
      titleMatchedFragment: doc.resolution_title,
    };
  }

  // Exact Quoted Phrase in Title (e.g., "Health Services")
  if (parsed.quotedPhrases.length > 0) {
    let allPhrasesMatch = true;
    for (const phrase of parsed.quotedPhrases) {
      if (doc.resolution_title.toUpperCase().includes(phrase)) {
        matchedCriteria.push(`Exact Title Phrase: "${phrase}"`);
      } else {
        allPhrasesMatch = false;
        break;
      }
    }
    if (allPhrasesMatch) {
      return {
        document: doc,
        score: 96,
        priority: 1,
        priorityLabel: 'Priority 1: Title Phrase Match',
        matchedCriteria,
        titleMatchedFragment: parsed.quotedPhrases.join(', '),
      };
    }
  }

  // ==========================================
  // PRIORITY 2: Title Word Order Match
  // ==========================================
  // Consecutive word sequence present in title in the exact order requested
  const queryWords = normalizedQuery.split(' ').filter(w => w.length > 1);
  if (queryWords.length >= 2) {
    const consecutivePhrase = queryWords.join(' ');
    if (normDocTitle.includes(consecutivePhrase) || normSubject.includes(consecutivePhrase)) {
      matchedCriteria.push(`Consecutive Title Word Order Match ("${consecutivePhrase}")`);
      return {
        document: doc,
        score: 88,
        priority: 2,
        priorityLabel: 'Priority 2: Title Word Order Match',
        matchedCriteria,
        titleMatchedFragment: consecutivePhrase,
      };
    }

    // Check if tokens appear in monotonic order
    let lastIndex = -1;
    let monotonicInOrder = true;
    for (const word of queryWords) {
      const idx = normSubject.indexOf(word, lastIndex + 1);
      if (idx === -1) {
        monotonicInOrder = false;
        break;
      }
      lastIndex = idx;
    }

    if (monotonicInOrder) {
      matchedCriteria.push(`Sequential Title Word Order (${queryWords.join(' → ')})`);
      return {
        document: doc,
        score: 82,
        priority: 2,
        priorityLabel: 'Priority 2: Title Word Order Match',
        matchedCriteria,
        titleMatchedFragment: queryWords.join(' '),
      };
    }
  }

  // Boolean AND evaluation in Title
  if (parsed.andTokens.length > 0) {
    const allAndMatch = parsed.andTokens.every(tok => normDocTitle.includes(tok));
    if (allAndMatch) {
      matchedCriteria.push(`Boolean AND Match: [${parsed.andTokens.join(' AND ')}]`);
      return {
        document: doc,
        score: 80,
        priority: 2,
        priorityLabel: 'Priority 2: Boolean AND Title Match',
        matchedCriteria,
        titleMatchedFragment: parsed.andTokens.join(' & '),
      };
    }
  }

  // Boolean OR evaluation in Title
  if (parsed.orTokens.length > 0) {
    const anyOrMatch = parsed.orTokens.some(tok => normDocTitle.includes(tok));
    if (anyOrMatch) {
      matchedCriteria.push(`Boolean OR Match`);
      return {
        document: doc,
        score: 75,
        priority: 2,
        priorityLabel: 'Priority 2: Boolean OR Title Match',
        matchedCriteria,
      };
    }
  }

  // Single word or keyword matching in Title or Keywords tags
  if (queryWords.length > 0) {
    const matchedWords = queryWords.filter(w => normDocTitle.includes(w));
    const matchedKeywords = doc.keywords.filter(k => queryWords.some(qw => k.toUpperCase().includes(qw)));

    if (matchedWords.length === queryWords.length && queryWords.length > 0) {
      matchedCriteria.push(`All Title Keywords Present (${matchedWords.join(', ')})`);
      return {
        document: doc,
        score: 78,
        priority: 2,
        priorityLabel: 'Priority 2: All Query Terms in Title',
        matchedCriteria,
        titleMatchedFragment: matchedWords.join(', '),
      };
    } else if (matchedWords.length > 0) {
      const ratio = matchedWords.length / queryWords.length;
      if (ratio >= 0.5) {
        matchedCriteria.push(`Partial Title Keywords Match (${matchedWords.length}/${queryWords.length})`);
        return {
          document: doc,
          score: Math.round(60 + ratio * 15),
          priority: 2,
          priorityLabel: 'Priority 2: Partial Title Keyword Match',
          matchedCriteria,
          titleMatchedFragment: matchedWords.join(', '),
        };
      }
    }
  }

  // ==========================================
  // PRIORITY 3: Fuzzy Match in Title (pg_trgm style)
  // ==========================================
  const trigramSim = calculateTrigramSimilarity(normalizedQuery, normSubject);
  const headerTrigram = calculateTrigramSimilarity(normalizedQuery, normSeriesHeader);
  const bestTrigram = Math.max(trigramSim, headerTrigram);

  // Also check Levenshtein on shortest matching word if single token query
  let typoFound = false;
  if (queryWords.length === 1 && queryWords[0].length >= 4) {
    const subjectTokens = normSubject.split(' ');
    for (const tok of subjectTokens) {
      if (tok.length >= 4 && levenshteinDistance(queryWords[0], tok) <= 2) {
        typoFound = true;
        matchedCriteria.push(`Typo Tolerance: "${queryWords[0]}" matches "${tok}"`);
        break;
      }
    }
  }

  if (bestTrigram >= 0.35 || typoFound) {
    const fuzzyScore = typoFound ? 65 : Math.round(40 + bestTrigram * 30);
    matchedCriteria.push(`Fuzzy Trigram Title Similarity (${Math.round(bestTrigram * 100)}%)`);
    return {
      document: doc,
      score: fuzzyScore,
      priority: 3,
      priorityLabel: 'Priority 3: Fuzzy Match in Title',
      matchedCriteria,
      titleMatchedFragment: doc.subject_title,
    };
  }

  // ==========================================
  // FULL-TEXT SEARCH (Only if toggled ON)
  // ==========================================
  if (isFullTextMode && doc.ocr_fulltext) {
    const upperOcr = doc.ocr_fulltext.toUpperCase();
    const queryUpper = cleanQuery.toUpperCase();

    if (upperOcr.includes(queryUpper) || queryWords.some(w => upperOcr.includes(w))) {
      // Find a snippet in OCR text
      const idx = upperOcr.indexOf(queryWords[0] || queryUpper);
      const start = Math.max(0, idx - 60);
      const snippet = doc.ocr_fulltext.slice(start, start + 160).replace(/\s+/g, ' ');

      matchedCriteria.push('Matched within Document Body OCR (Full-Text Mode)');
      return {
        document: doc,
        score: 45,
        priority: 4,
        priorityLabel: 'Full-Text Match (Body Content)',
        matchedCriteria,
        bodyMatchSnippet: `...${snippet}...`,
      };
    }
  }

  return null;
}
