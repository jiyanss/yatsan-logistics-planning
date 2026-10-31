/* Tarih ayrıştırma + ISO hafta + türetilmiş alanlar (hydrate) */
import type { Row } from './types';
import { GUNLER, pad2, fmtDate } from './core';

const MONTHS_TR: Record<string, number> = {
  ocak: 1, subat: 2, mart: 3, nisan: 4, mayis: 5, haziran: 6,
  temmuz: 7, agustos: 8, eylul: 9, ekim: 10, kasim: 11, aralik: 12,
};

function mkDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

/** Excel seri numarası → yıl/ay/gün */
export function serialToParts(v: number): { y: number; mo: number; d: number } | null {
  try {
    // XLSX.SSF.parse_date_code yerine kendi hesabımız (bağımlılıksız)
    const whole = Math.floor(v);
    const frac = v - whole;
    let days = whole;
    // Excel dönemi: 1899-12-30
    const base = Date.UTC(1899, 11, 30);
    const ms = base + days * 86400000 + Math.round(frac * 86400000);
    const dt = new Date(ms);
    if (isNaN(dt.getTime()) || dt.getUTCFullYear() < 1900 || dt.getUTCFullYear() > 2200) return null;
    return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  } catch {
    return null;
  }
}

function normalizeDate(d: Date): Date | null {
  if (isNaN(d.getTime())) return null;
  const lMid = d.getHours() === 0 && d.getMinutes() === 0;
  const uMid = d.getUTCHours() === 0 && d.getUTCMinutes() === 0;
  if (uMid && !lMid) return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseDate(v: unknown): Date | null {
  if (v == null || v === '') return null;
  if (typeof v === 'number') {
    if (v > 20000 && v < 80000) {
      const p = serialToParts(v);
      return p ? new Date(p.y, p.mo - 1, p.d) : null;
    }
    return null;
  }
  if (v instanceof Date) return normalizeDate(v);
  const s = String(v).trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return mkDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/);
  if (m) {
    const a = +m[1], b = +m[2];
    let y = +m[3];
    if (y < 100) y += 2000;
    let d: number, mo: number;
    if (a > 12) { d = a; mo = b; }
    else if (b > 12) { mo = a; d = b; }
    else { d = a; mo = b; }
    return mkDate(y, mo, d);
  }
  const tr = s
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/Ş/g, 's').replace(/ş/g, 's').replace(/Ğ/g, 'g').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/ü/g, 'u').replace(/Ö/g, 'o').replace(/ö/g, 'o')
    .replace(/Ç/g, 'c').replace(/ç/g, 'c').toLowerCase();
  m = tr.match(/^(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{2,4})/);
  if (m && MONTHS_TR[m[2]]) {
    let yy = +m[3];
    if (yy < 100) yy += 2000;
    return mkDate(yy, MONTHS_TR[m[2]], +m[1]);
  }
  const n = parseFloat(s.replace(',', '.'));
  if (!isNaN(n) && n > 20000 && n < 80000) {
    const pp = serialToParts(n);
    if (pp) return new Date(pp.y, pp.mo - 1, pp.d);
  }
  return normalizeDate(new Date(s));
}

/** ISO-8601 hafta numarası */
export function isoWeek(d: Date): number {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const ys = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil(((dt.getTime() - ys.getTime()) / 864e5 + 1) / 7);
}

/** Satırdaki türetilmiş alanları hesaplar (tarihStr, yil, hafta, gun) */
type HydrateInput = Omit<Row, 'tarihStr' | 'yil' | 'hafta' | 'gun' | 'tarih'> & { tarih?: Date | string | null };

export function hydrate(r: HydrateInput): Row {
  const out = r as unknown as Row;
  let t: Date | string | null = (r as { tarih?: Date | string | null }).tarih ?? null;
  if (!(t instanceof Date) || isNaN(t.getTime())) {
    if (typeof t === 'string' && /^\d{4}-\d{2}-\d{2}/.test(t)) {
      const p = t.split('-').map(Number);
      t = new Date(p[0], p[1] - 1, p[2]);
    } else if (t) {
      const d = new Date(t);
      t = isNaN(d.getTime()) ? null : d;
    } else {
      t = null;
    }
  }
  out.tarih = t;
  out.tarihStr = out.tarih ? fmtDate(out.tarih) : '';
  out.yil = out.tarih ? out.tarih.getFullYear() : null;
  out.hafta = out.tarih ? isoWeek(out.tarih) : 0;
  out.gun = out.tarih ? GUNLER[out.tarih.getDay()] : '';
  return out;
}
