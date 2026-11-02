/* PDF çıktı yardımcısı — bir DOM bölümünü A4 PDF'e çevirir (jsPDF + html2canvas-pro).
   html2canvas-pro, Tailwind v4'ün oklch renklerini destekler. Türkçe karakterler
   rasterize edildiği için sorunsuz görünür. */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export async function elemanPdf(el: HTMLElement | null, dosyaAdi: string): Promise<boolean> {
  if (!el) return false;
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    ignoreElements: (e: HTMLElement) => !!e.classList && e.classList.contains('no-pdf'),
  });
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const m = 8; // kenar boşluğu (mm)
  const iw = pw - m * 2;
  const ih = (canvas.height * iw) / canvas.width;
  const pageH = ph - m * 2;
  const img = canvas.toDataURL('image/jpeg', 0.92);

  pdf.addImage(img, 'JPEG', m, m, iw, ih);
  let kalan = ih - pageH;
  let pos = 0;
  while (kalan > 1) {
    pos -= pageH;
    pdf.addPage();
    pdf.addImage(img, 'JPEG', m, m + pos, iw, ih);
    kalan -= pageH;
  }
  pdf.save(dosyaAdi);
  return true;
}

export function pdfDosyaAdi(parca: string): string {
  const d = new Date();
  const g = String(d.getDate()).padStart(2, '0') + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + d.getFullYear();
  return 'YATSAN-' + parca + '-' + g + '.pdf';
}
