import { jsPDF } from 'jspdf';
import { LegislativeDocument } from '../types';

/**
 * Generates an official, publication-grade Philippine Local Government Unit (LGU)
 * Legislative Resolution in standard Legal paper format (8.5 x 14 inches / 215.9 x 355.6 mm).
 */
export function generateResolutionPdf(doc: LegislativeDocument): jsPDF {
  const docPdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'legal', // 612 x 1008 pt
  });

  const pageWidth = docPdf.internal.pageSize.getWidth();
  const pageHeight = docPdf.internal.pageSize.getHeight();
  const margin = 54; // 0.75 in
  const contentWidth = pageWidth - margin * 2;

  // Helper for drawing header on any page
  const drawLetterhead = () => {
    docPdf.setFont('times', 'normal');
    docPdf.setFontSize(10);
    docPdf.setTextColor(60, 60, 60);
    docPdf.text('Republic of the Philippines', pageWidth / 2, 45, { align: 'center' });
    docPdf.text('Province of Zamboanga del Norte', pageWidth / 2, 58, { align: 'center' });
    
    docPdf.setFont('times', 'bold');
    docPdf.setFontSize(13);
    docPdf.setTextColor(20, 20, 20);
    docPdf.text('MUNICIPALITY OF MUTIA', pageWidth / 2, 73, { align: 'center' });
    
    docPdf.setFont('times', 'italic');
    docPdf.setFontSize(10.5);
    docPdf.setTextColor(30, 64, 175);
    docPdf.text('OFFICE OF THE SANGGUNIANG BAYAN', pageWidth / 2, 87, { align: 'center' });

    // Header divider line
    docPdf.setDrawColor(30, 41, 59);
    docPdf.setLineWidth(1.5);
    docPdf.line(margin, 95, pageWidth - margin, 95);
    docPdf.setLineWidth(0.5);
    docPdf.line(margin, 97.5, pageWidth - margin, 97.5);
  };

  // Helper for footer on every page
  const drawFooter = (pageNo: number, totalPages: number) => {
    docPdf.setFont('times', 'italic');
    docPdf.setFontSize(8.5);
    docPdf.setTextColor(100, 100, 100);
    
    docPdf.setDrawColor(200, 200, 200);
    docPdf.setLineWidth(0.5);
    docPdf.line(margin, pageHeight - 38, pageWidth - margin, pageHeight - 38);

    docPdf.text(
      `Municipality of Mutia | Official Legislative Record — ${doc.resolution_number}`,
      margin,
      pageHeight - 24
    );
    docPdf.text(
      `Page ${pageNo} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 24,
      { align: 'right' }
    );
  };

  // --- PAGE 1 ---
  drawLetterhead();

  let y = 115;

  // Legislative Body Excerpt Note
  docPdf.setFont('times', 'italic');
  docPdf.setFontSize(9);
  docPdf.setTextColor(70, 70, 70);
  const sessionText = `EXCERPTS FROM THE MINUTES OF THE REGULAR SESSION OF THE SANGGUNIANG BAYAN HELD AT THE SANGGUNIAN SESSION HALL, MUNICIPAL HALL, MUTIA, ZAMBOANGA DEL NORTE.`;
  const sessionLines = docPdf.splitTextToSize(sessionText, contentWidth);
  docPdf.text(sessionLines, margin, y);
  y += sessionLines.length * 11 + 6;

  // Authors & Sponsors
  if (doc.author_sponsors && doc.author_sponsors.length > 0) {
    docPdf.setFont('times', 'normal');
    docPdf.setFontSize(9.5);
    docPdf.setTextColor(50, 50, 50);
    const authorLine = `Authored & Sponsored by: ${doc.author_sponsors.join(', ')}`;
    const authorLines = docPdf.splitTextToSize(authorLine, contentWidth);
    docPdf.text(authorLines, margin, y);
    y += authorLines.length * 11 + 10;
  }

  // Resolution Number Box
  docPdf.setFillColor(241, 245, 249);
  docPdf.setDrawColor(203, 213, 225);
  docPdf.roundedRect(margin, y, contentWidth, 26, 3, 3, 'FD');

  docPdf.setFont('times', 'bold');
  docPdf.setFontSize(12);
  docPdf.setTextColor(15, 23, 42);
  docPdf.text(doc.resolution_number.toUpperCase(), pageWidth / 2, y + 17, { align: 'center' });
  y += 38;

  // Full Title
  docPdf.setFont('times', 'bold');
  docPdf.setFontSize(11);
  docPdf.setTextColor(10, 10, 10);
  const titleText = doc.subject_title || doc.resolution_title;
  const titleLines = docPdf.splitTextToSize(titleText, contentWidth);
  docPdf.text(titleLines, pageWidth / 2, y, { align: 'center', maxWidth: contentWidth });
  y += titleLines.length * 14 + 16;

  // Decorative Rule
  docPdf.setDrawColor(226, 232, 240);
  docPdf.setLineWidth(0.75);
  docPdf.line(margin + 40, y, pageWidth - margin - 40, y);
  y += 16;

  // Full Resolution Body Clauses (Derived from ocr_fulltext or structured templates)
  docPdf.setFont('times', 'normal');
  docPdf.setFontSize(10);
  docPdf.setTextColor(30, 30, 30);

  // Extract whereas clauses and resolved sections from ocr_fulltext or provide standard legislative formulation
  let bodyParagraphs: string[] = [];

  if (doc.ocr_fulltext) {
    // Clean and split lines
    const lines = doc.ocr_fulltext.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const relevantLines = lines.filter(l => 
      !l.toUpperCase().includes('EXCERPTS FROM') &&
      !l.toUpperCase().includes('RESOLUTION NO.') &&
      !l.toUpperCase().includes(doc.resolution_number.toUpperCase())
    );
    if (relevantLines.length > 0) {
      bodyParagraphs = relevantLines;
    }
  }

  if (bodyParagraphs.length === 0) {
    bodyParagraphs = [
      `WHEREAS, Section 16 of Republic Act No. 7160, otherwise known as the Local Government Code of 1991, provides that every local government unit shall exercise powers essential to the promotion of general welfare;`,
      `WHEREAS, the Sangguniang Bayan of Mutia, after judicious deliberation and thorough committee review, recognized the imperative need to enact this measure for the municipal constituents;`,
      `NOW THEREFORE, on motion of the sponsoring committee members, duly seconded:`,
      `BE IT RESOLVED, AS IT IS HEREBY RESOLVED by the Sangguniang Bayan of Mutia, Province of Zamboanga del Norte, in session assembled, to approve and enact: ${doc.subject_title}.`,
      `RESOLVED FURTHER, that certified copies of this Resolution be transmitted to the Office of the Municipal Mayor, the Provincial Government, and relevant agencies for their information and appropriate action.`
    ];
  }

  // Render paragraphs with pagination check
  let currentPage = 1;
  for (const para of bodyParagraphs) {
    const isHeaderPara = para.startsWith('WHEREAS') || para.startsWith('NOW THEREFORE') || para.startsWith('RESOLVED') || para.startsWith('BE IT RESOLVED');
    if (isHeaderPara) {
      docPdf.setFont('times', 'bold');
    } else {
      docPdf.setFont('times', 'normal');
    }

    const paraLines = docPdf.splitTextToSize(para, contentWidth);
    const paraHeight = paraLines.length * 13 + 8;

    // Check if new page needed
    if (y + paraHeight > pageHeight - 140) {
      drawFooter(currentPage, 2);
      docPdf.addPage('legal', 'portrait');
      currentPage++;
      drawLetterhead();
      y = 115;
    }

    docPdf.text(paraLines, margin, y, { align: 'justify', maxWidth: contentWidth });
    y += paraHeight;
  }

  // Signatures and Certification Section
  if (y + 120 > pageHeight - 50) {
    drawFooter(currentPage, 2);
    docPdf.addPage('legal', 'portrait');
    currentPage++;
    drawLetterhead();
    y = 115;
  }

  y += 10;
  docPdf.setFont('times', 'italic');
  docPdf.setFontSize(9.5);
  docPdf.setTextColor(60, 60, 60);
  docPdf.text(`APPROVED UNANIMOUSLY on ${doc.date_approved || 'March 2026'}.`, margin, y);
  y += 24;

  // Signature Blocks
  const colWidth = (contentWidth - 20) / 2;

  // Left Column: Attested by Secretary
  docPdf.setFont('times', 'normal');
  docPdf.setFontSize(9);
  docPdf.setTextColor(80, 80, 80);
  docPdf.text('ATTESTED AND CERTIFIED CORRECT:', margin, y);

  // Right Column: Presiding Officer
  docPdf.text('APPROVED AND CONCURRED:', margin + colWidth + 20, y);
  y += 32;

  // Left Signee
  docPdf.setFont('times', 'bold');
  docPdf.setFontSize(10);
  docPdf.setTextColor(15, 23, 42);
  docPdf.text('ATTY. ROBERTO V. MENDOZA', margin, y);
  docPdf.setFont('times', 'normal');
  docPdf.setFontSize(8.5);
  docPdf.setTextColor(70, 70, 70);
  docPdf.text('Secretary to the Sangguniang Bayan', margin, y + 11);

  // Right Signee
  docPdf.setFont('times', 'bold');
  docPdf.setFontSize(10);
  docPdf.setTextColor(15, 23, 42);
  docPdf.text('HON. MARIA ELENA SANTOS', margin + colWidth + 20, y);
  docPdf.setFont('times', 'normal');
  docPdf.setFontSize(8.5);
  docPdf.setTextColor(70, 70, 70);
  docPdf.text('Municipal Vice Mayor & Presiding Officer', margin + colWidth + 20, y + 11);

  // Draw footer for current page
  drawFooter(currentPage, currentPage);

  // If only 1 page was produced, update footer page numbers
  if (currentPage === 1) {
    drawFooter(1, 1);
  }

  return docPdf;
}

/**
 * Triggers an immediate browser download of the converted resolution PDF file.
 */
export function downloadResolutionPdf(doc: LegislativeDocument): void {
  const pdf = generateResolutionPdf(doc);
  const cleanNumber = doc.resolution_number.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${cleanNumber}_Full_Resolution.pdf`;
  pdf.save(filename);
}

/**
 * Triggers a download of the full verbatim resolution text file (.txt).
 */
export function downloadResolutionText(doc: LegislativeDocument): void {
  const content = `================================================================================
REPUBLIC OF THE PHILIPPINES
PROVINCE OF ZAMBOANGA DEL NORTE
MUNICIPALITY OF MUTIA
OFFICE OF THE SANGGUNIANG BAYAN
================================================================================

RESOLUTION NUMBER: ${doc.resolution_number}
SUBJECT: ${doc.subject_title}
VERBATIM TITLE: ${doc.resolution_title}

DATE PASSED: ${doc.date_passed}
DATE APPROVED: ${doc.date_approved}
STATUS: ${doc.classification_status}
AUTHORS / SPONSORS: ${doc.author_sponsors?.join(', ') || 'N/A'}
COMMITTEE REFERRAL: ${doc.committee_referral || 'N/A'}

--------------------------------------------------------------------------------
FULL RESOLUTION TRANSCRIPTION / OCR CONTENT:
--------------------------------------------------------------------------------
${doc.ocr_fulltext || 'No additional OCR body text provided.'}

================================================================================
Digitized & Archived via Legislative Information System (LIS)
Municipality of Mutia, Zamboanga del Norte
================================================================================
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanNumber = doc.resolution_number.replace(/[^a-zA-Z0-9-_]/g, '_');
  a.download = `${cleanNumber}_Full_Resolution.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
