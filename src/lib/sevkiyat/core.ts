/* Metin / sayı yardımcıları — eski panelin mantığı korunarak TypeScript'e taşındı */

export const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
export const AYLAR = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const AYLAR_UZUN = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
];

/** Grafik paleti — okyanus mavisi merkezli */
export const PALETTE = [
  '#0284c7', '#059669', '#d97706', '#7c3aed', '#dc2626',
  '#0891b2', '#65a30d', '#db2777', '#475569', '#0d9488',
];

export const nf0 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });
export const nf1 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });

export function pct(v: number): string {
  return (v >= 0 ? '+' : '') + nf1.format(v) + '%';
}

export function uniq<T>(a: T[]): T[] {
  return Array.from(new Set(a));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function isoDay(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function ymOf(d: Date): string {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1);
}

export function ymLabel(ym: string): string {
  const p = ym.split('-');
  return AYLAR[+p[1] - 1] + ' ' + p[0];
}

export function ymLabelLong(ym: string): string {
  const p = ym.split('-');
  return AYLAR_UZUN[+p[1] - 1] + ' ' + p[0];
}

export function fmtDate(d: Date | null | undefined): string {
  return d ? pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear() : '';
}

/** Türkçe karakterleri sadeleştirip alfanümeriğe indirger (eşleştirme anahtarı) */
export function norm(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/Ş/g, 's').replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c')
    .toLowerCase().replace(/³/g, '3').replace(/²/g, '2').replace(/[^a-z0-9]/g, '');
}

/** Yalnızca harf normalizasyonu (metin saklamak için) */
export function asciiLower(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c').toLowerCase();
}

export function toNum(v: unknown): number {
  if (v === '' || v == null) return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function cleanText(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function canonicalKey(s: unknown): string {
  return norm(cleanText(s));
}

export function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function maxDate(rows: { tarih: Date | null }[]): Date | null {
  const ts = rows.filter((r) => r.tarih).map((r) => r.tarih!.getTime());
  return ts.length ? new Date(Math.max(...ts)) : null;
}
