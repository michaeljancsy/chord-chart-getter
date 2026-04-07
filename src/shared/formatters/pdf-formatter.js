import { jsPDF } from 'jspdf';

/**
 * Generate a PDF from formatted text content (chord chart or tab)
 */
export function generatePDF(text, title = 'Chord Chart') {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const lineHeight = 4.5;
  const maxWidth = pageWidth - margin * 2;

  doc.setFont('Courier', 'normal');
  doc.setFontSize(9);

  const lines = text.split('\n');
  let y = margin;

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }

    // Wrap long lines
    if (line.length > 0) {
      const wrapped = doc.splitTextToSize(line, maxWidth);
      for (const wrapLine of wrapped) {
        if (y + lineHeight > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(wrapLine, margin, y);
        y += lineHeight;
      }
    } else {
      y += lineHeight;
    }
  }

  return doc.output('arraybuffer');
}
