// One-click PDF download of the printed clinical report (no print dialog).
//
// The official print document (<ReportPrintDocument>, same layout as
// printing) is cloned off-screen at the A4 content width, rendered to a
// canvas with html2canvas-pro (supports Tailwind 4's oklch colours) and
// placed on A4 pages with jsPDF. Page breaks are chosen between table rows,
// paragraphs and blocks marked "avoid", never through a line of text.
// Thai renders exactly as on screen because the page is rasterised; the
// trade-off is that the PDF text is not selectable.

const MM_TO_PX = 96 / 25.4;
const A4 = { w: 210, h: 297 };
// Same margins as the print stylesheet (@page in globals.css): top right bottom left
const MARGIN = { top: 25, right: 20, bottom: 20, left: 30 };
const SCALE = 2; // canvas pixels per CSS pixel (sharp text)
const PAGE_NUMBER_GAP_MM = 8; // page number sits this far below the content area

/** Elements that must not be split across pages */
const UNSPLITTABLE = 'header, h1, p, li, tr, .rp-avoid, .rp-signature, footer';

interface Range {
  top: number;
  bottom: number;
}

/**
 * Page break positions (CSS px from the top of the document). A break that
 * would cut through an unsplittable element moves up to that element's top;
 * headings are kept with the content below them. Elements taller than a page
 * are allowed to split (at their own rows/paragraphs).
 */
export function pageBreaks(total: number, pageHeight: number, ranges: Range[]): number[] {
  const breaks: number[] = [];
  let start = 0;
  while (total - start > pageHeight) {
    let cut = start + pageHeight;
    for (let moved = true; moved; ) {
      moved = false;
      for (const r of ranges) {
        if (r.bottom - r.top > pageHeight) continue;
        if (r.top > start && r.top < cut && r.bottom > cut) {
          cut = r.top;
          moved = true;
        }
      }
    }
    if (cut <= start + pageHeight * 0.25) cut = start + pageHeight; // pathological: avoid near-empty pages
    breaks.push(cut);
    start = cut;
  }
  return breaks;
}

function measureRanges(root: HTMLElement): Range[] {
  const origin = root.getBoundingClientRect().top;
  const ranges: Range[] = [];
  root.querySelectorAll<HTMLElement>(UNSPLITTABLE).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.height > 0) ranges.push({ top: r.top - origin, bottom: r.bottom - origin });
  });
  // Keep each heading with at least ~3 lines of what follows
  root.querySelectorAll<HTMLElement>('h2, h3').forEach((el) => {
    const r = el.getBoundingClientRect();
    ranges.push({ top: r.top - origin, bottom: r.bottom - origin + 60 });
  });
  return ranges;
}

/** "หน้า n / N" drawn with the document's Thai font (jsPDF's built-in fonts have no Thai) */
function pageLabel(text: string, fontFamily: string): { dataUrl: string; wMm: number; hMm: number } {
  const fontPx = 9 * (96 / 72) * SCALE; // 9pt
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = `${fontPx}px ${fontFamily}`;
  c.width = Math.ceil(ctx.measureText(text).width) + 4;
  c.height = Math.ceil(fontPx * 1.5);
  ctx.font = `${fontPx}px ${fontFamily}`;
  ctx.fillStyle = '#444';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 2, c.height / 2);
  return { dataUrl: c.toDataURL('image/png'), wMm: c.width / SCALE / MM_TO_PX, hMm: c.height / SCALE / MM_TO_PX };
}

/**
 * Render `source` (the .report-print article) to an A4 PDF and download it
 * as `${fileName}.pdf`.
 */
export async function downloadReportPdf(source: HTMLElement, fileName: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);

  const contentW = A4.w - MARGIN.left - MARGIN.right;
  const contentH = A4.h - MARGIN.top - MARGIN.bottom;
  const widthPx = Math.round(contentW * MM_TO_PX);
  const pageHeightPx = contentH * MM_TO_PX;

  // Off-screen copy, visible to layout (the original is display:none on screen)
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${widthPx}px;background:#fff;color:#000;pointer-events:none;`;
  const doc = source.cloneNode(true) as HTMLElement;
  doc.removeAttribute('data-print-only');
  doc.style.display = 'block';
  doc.style.background = '#fff';
  host.appendChild(doc);
  document.body.appendChild(host);

  try {
    await document.fonts.ready;
    const totalPx = doc.scrollHeight;
    const breaks = pageBreaks(totalPx, pageHeightPx, measureRanges(doc));
    const canvas = await html2canvas(doc, {
      scale: SCALE,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      width: widthPx,
      windowWidth: widthPx,
    });

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    const fontFamily = getComputedStyle(doc).fontFamily || 'sans-serif';
    const bounds = [0, ...breaks, totalPx];
    const pages = bounds.length - 1;

    for (let i = 0; i < pages; i++) {
      const fromPx = bounds[i];
      const toPx = bounds[i + 1];
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = Math.max(1, Math.round((toPx - fromPx) * SCALE));
      const ctx = slice.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, Math.round(fromPx * SCALE), slice.width, slice.height, 0, 0, slice.width, slice.height);

      if (i > 0) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', MARGIN.left, MARGIN.top, contentW, (toPx - fromPx) / MM_TO_PX, undefined, 'FAST');

      const label = pageLabel(`หน้า ${i + 1} / ${pages}`, fontFamily);
      pdf.addImage(label.dataUrl, 'PNG', A4.w - MARGIN.right - label.wMm, A4.h - MARGIN.bottom + PAGE_NUMBER_GAP_MM, label.wMm, label.hMm);
    }

    pdf.setProperties({ title: fileName, subject: 'Telerehabilitation Physical Therapy Session Record', creator: 'AI Physio' });
    pdf.save(`${fileName}.pdf`);
  } finally {
    host.remove();
  }
}
