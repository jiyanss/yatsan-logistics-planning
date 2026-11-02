/* Analitik motor — agregasyonlar, ABC, yaşam döngüsü, ısı haritası */
import type {
  Row, GroupSum, WeeklyAgg, MonthlyAgg, DailyAgg, CustAgg, LifeRow,
  GrowthRow, FlowMonth, Segment,
} from './types';
import { GUNLER, nf1, uniq, pad2, isoDay, ymOf, maxDate } from './core';
import { isoWeek } from './dates';

export function groupSum(rows: Row[], keyFn: (r: Row) => string): Map<string, GroupSum> {
  const m = new Map<string, GroupSum>();
  rows.forEach((r) => {
    const k = keyFn(r);
    const o = m.get(k) || { adet: 0, m3: 0, ref: r };
    o.adet += r.adet;
    o.m3 += r.m3;
    m.set(k, o);
  });
  return m;
}

export function weeklyAgg(rows: Row[]): WeeklyAgg[] {
  const map = new Map<string, WeeklyAgg>();
  rows.forEach((r) => {
    const k = r.yil + '|' + r.hafta;
    if (!map.has(k)) {
      map.set(k, { yil: r.yil || 0, hafta: r.hafta || 0, adet: 0, m3: 0, min: null, max: null, deps: {} });
    }
    const o = map.get(k)!;
    o.adet += r.adet;
    o.m3 += r.m3;
    if (r.tarih) {
      const t = r.tarih.getTime();
      if (o.min == null || t < o.min) o.min = t;
      if (o.max == null || t > o.max) o.max = t;
    }
    o.deps[r.bolum] = (o.deps[r.bolum] || 0) + r.m3;
  });
  return Array.from(map.values());
}

export function monthlyAgg(rows: Row[]): MonthlyAgg[] {
  const map = new Map<string, MonthlyAgg>();
  rows.forEach((r) => {
    if (!r.tarih) return;
    const k = ymOf(r.tarih);
    if (!map.has(k)) map.set(k, { ym: k, adet: 0, m3: 0, deps: {} });
    const o = map.get(k)!;
    o.adet += r.adet;
    o.m3 += r.m3;
    o.deps[r.bolum] = (o.deps[r.bolum] || 0) + r.m3;
  });
  return Array.from(map.values()).sort((a, b) => (a.ym < b.ym ? -1 : 1));
}

export function dailyList(rows: Row[]): DailyAgg[] {
  const m = new Map<string, { adet: number; m3: number; ref?: Row }>();
  rows.filter((r) => r.tarih).forEach((r) => {
    const k = r.tarihStr;
    const o = m.get(k) || { adet: 0, m3: 0, ref: r };
    o.adet += r.adet;
    o.m3 += r.m3;
    m.set(k, o);
  });
  const out: DailyAgg[] = [];
  m.forEach((o, k) => {
    const rr = o.ref || ({} as Row);
    out.push({
      k,
      adet: o.adet,
      m3: o.m3,
      t: rr.tarih ? rr.tarih.getTime() : 0,
      d: rr.tarih || null,
      gun: rr.tarih ? GUNLER[rr.tarih.getDay()] : '—',
    });
  });
  return out.sort((a, b) => a.t - b.t);
}

/** Basit doğrusal regresyon — tahmin için */
export function linreg(ys: number[]): (x: number) => number {
  const n = ys.length;
  if (n < 2) return () => ys[n - 1] || 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  ys.forEach((y, x) => { sx += x; sy += y; sxy += x * y; sxx += x * x; });
  const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx || 1);
  const icpt = (sy - slope * sx) / n;
  return (x: number) => icpt + slope * x;
}

/** Müşteri agregasyonu + ABC sınıflaması (m³ payına göre A≤%80, B≤%95) */
export function custAgg(rows: Row[]): CustAgg[] {
  const map = new Map<string, CustAgg>();
  rows.forEach((r) => {
    if (!map.has(r.musteri)) map.set(r.musteri, { name: r.musteri, adet: 0, m3: 0, loads: 0, last: null, deps: {}, share: 0, cum: 0, cls: 'C' });
    const o = map.get(r.musteri)!;
    o.adet += r.adet;
    o.m3 += r.m3;
    o.loads++;
    o.deps[r.bolum] = (o.deps[r.bolum] || 0) + r.m3;
    if (r.tarih && (!o.last || r.tarih > o.last)) o.last = r.tarih;
  });
  const list = Array.from(map.values()).sort((a, b) => b.m3 - a.m3);
  const total = list.reduce((s, c) => s + c.m3, 0) || 1;
  let cum = 0;
  list.forEach((c) => {
    c.share = (c.m3 / total) * 100;
    cum += c.share;
    c.cum = cum;
    c.cls = cum <= 80 ? 'A' : cum <= 95 ? 'B' : 'C';
  });
  return list;
}

/** Müşteri yaşam döngüsü: ritim analizi (referans = en son yükleme tarihi)
 *  loads  = yükleme (satır) sayısı: aynı tarih+müşteri+tip'teki N satır = N yükleme
 *  days   = farklı yükleme GÜNÜ sayısı: ritim/aralık analizi gün bazında yürür */
export function custLifeRows(data: Row[], _caps?: Record<string, number>): { list: LifeRow[]; ref: Date | null } {
  const refD = maxDate(data);
  const ref = refD ? refD.getTime() : null;
  const map = new Map<string, LifeRow>();
  data.forEach((r) => {
    if (!map.has(r.musteri)) {
      map.set(r.musteri, {
        name: r.musteri, adet: 0, m3: 0, loads: 0, days: 0, first: null, last: null,
        deps: {}, cls: 'C', avgInt: null, gap: null, status: 'tek', eff: null,
      });
    }
    const o = map.get(r.musteri)!;
    o.adet += r.adet;
    o.m3 += r.m3;
    o.loads++; // her satır = 1 yükleme
    o.deps[r.bolum] = (o.deps[r.bolum] || 0) + r.m3;
    if (r.tarih) {
      if (!o.last || r.tarih > o.last) o.last = r.tarih;
      if (!o.first || r.tarih < o.first) o.first = r.tarih;
    }
  });
  const clsMap = new Map(custAgg(data).map((c) => [c.name, c.cls] as const));
  const list = Array.from(map.values());
  list.forEach((o) => {
    o.days = uniqDays(data, o.name);
    o.cls = clsMap.get(o.name) || 'C';
    o.avgInt = o.days >= 2 && o.first && o.last ? Math.max(1, Math.round((o.last.getTime() - o.first.getTime()) / 864e5 / (o.days - 1))) : null;
    o.gap = ref != null && o.last ? Math.max(0, Math.round((ref - o.last.getTime()) / 864e5)) : null;
    const eff = o.avgInt != null ? Math.max(o.avgInt, 5) : null;
    if (o.days < 2 || eff == null || o.gap == null) o.status = 'tek';
    else if (o.gap <= Math.round(eff * 1.3)) o.status = 'ok';
    else if (o.gap <= Math.round(eff * 1.8)) o.status = 'watch';
    else o.status = 'risk';
    o.eff = eff;
  });
  return { list, ref: refD };
}

/** Müşterinin farklı yükleme günü sayısı */
function uniqDays(data: Row[], musteri: string): number {
  const s = new Set<string>();
  data.forEach((r) => {
    if (r.musteri === musteri && r.tarih) s.add(isoDay(r.tarih));
  });
  return s.size;
}

export const LIFE_LABEL: Record<LifeRow['status'], [string, string]> = {
  ok: ['Ritimde', 'text-emerald-600 dark:text-emerald-400'],
  watch: ['İzle', 'text-amber-600 dark:text-amber-400'],
  risk: ['Riskli', 'text-red-600 dark:text-red-400'],
  tek: ['Yeni/Tek', 'text-muted-foreground'],
};

/** Bölüm × Tip matrisi hücreleri */
export function matrixData(rows: Row[]): {
  deps: string[];
  tips: string[];
  cell: Record<string, { adet: number; m3: number }>;
} {
  const deps = uniq(rows.map((r) => r.bolum)).sort();
  const tips = uniq(rows.map((r) => r.tip)).sort();
  const cell: Record<string, { adet: number; m3: number }> = {};
  rows.forEach((r) => {
    const k = r.bolum + '|' + r.tip;
    if (!cell[k]) cell[k] = { adet: 0, m3: 0 };
    cell[k].adet += r.adet;
    cell[k].m3 += r.m3;
  });
  return { deps, tips, cell };
}

/** Takvim ısı haritası: gün → {m3, adet} */
export function heatmapData(rows: Row[]): Map<string, { m3: number; adet: number }> {
  const dayMap = new Map<string, { m3: number; adet: number }>();
  rows.filter((r) => r.tarih).forEach((r) => {
    const k = isoDay(r.tarih!);
    const o = dayMap.get(k) || { m3: 0, adet: 0 };
    o.m3 += r.m3;
    o.adet += r.adet;
    dayMap.set(k, o);
  });
  return dayMap;
}

/** Haftanın günü analizi */
export function weekdayData(rows: Row[]): {
  labels: string[];
  realM3: number[];
  realA: number[];
  daysCount: number[];
  totM3: number;
  agg: Record<number, { m3: number; adet: number; days: number }>;
} {
  const dated = rows.filter((r) => r.tarih);
  const order = [1, 2, 3, 4, 5, 6, 0];
  const agg: Record<number, { m3: number; adet: number; days: Set<string> }> = {};
  dated.forEach((r) => {
    const d = r.tarih!.getDay();
    if (!agg[d]) agg[d] = { m3: 0, adet: 0, days: new Set() };
    agg[d].m3 += r.m3;
    agg[d].adet += r.adet;
    agg[d].days.add(r.tarihStr);
  });
  const agg2: Record<number, { m3: number; adet: number; days: number }> = {};
  Object.keys(agg).forEach((k) => {
    agg2[+k] = { m3: agg[+k].m3, adet: agg[+k].adet, days: agg[+k].days.size };
  });
  const realM3 = order.map((d) => (agg[d] && agg[d].days.size ? +(agg[d].m3 / agg[d].days.size).toFixed(1) : 0));
  const realA = order.map((d) => (agg[d] && agg[d].days.size ? +(agg[d].adet / agg[d].days.size).toFixed(1) : 0));
  const daysCount = order.map((d) => (agg[d] ? agg[d].days.size : 0));
  const totM3 = order.reduce((s, d) => s + (agg[d] ? agg[d].m3 : 0), 0) || 1;
  return { labels: order.map((d) => GUNLER[d]), realM3, realA, daysCount, totM3, agg: agg2 };
}

/** Büyüme matrisi (YoY segment) */
export function growthRows(data: Row[], year: number): GrowthRow[] {
  const prev = year - 1;
  const A = new Map<string, { m3: number; adet: number }>();
  const B = new Map<string, { m3: number; adet: number }>();
  data.forEach((r) => {
    if (r.yil === year) {
      const o = A.get(r.musteri) || { m3: 0, adet: 0 };
      o.m3 += r.m3; o.adet += r.adet;
      A.set(r.musteri, o);
    } else if (r.yil === prev) {
      const o = B.get(r.musteri) || { m3: 0, adet: 0 };
      o.m3 += r.m3; o.adet += r.adet;
      B.set(r.musteri, o);
    }
  });
  const clsMap = new Map(custAgg(data).map((c) => [c.name, c.cls] as const));
  const names = uniq(Array.from(A.keys()).concat(Array.from(B.keys())));
  const SEG_ORDER: Record<Segment, number> = { kayip: 0, kuculen: 1, yeni: 2, buyuyen: 3, stabil: 4 };
  const list: GrowthRow[] = names.map((n) => {
    const a = A.get(n) || { m3: 0, adet: 0 };
    const b = B.get(n) || { m3: 0, adet: 0 };
    let seg: Segment;
    let delta: number | null = null;
    if (a.m3 > 0 && b.m3 > 0) {
      delta = ((a.m3 - b.m3) / b.m3) * 100;
      seg = delta >= 10 ? 'buyuyen' : delta <= -10 ? 'kuculen' : 'stabil';
    } else if (a.m3 > 0) seg = 'yeni';
    else seg = 'kayip';
    return { name: n, cls: clsMap.get(n) || 'C', cur: a.m3, curA: a.adet, pr: b.m3, prA: b.adet, delta, seg };
  });
  list.sort((a, b) => {
    if (SEG_ORDER[a.seg] !== SEG_ORDER[b.seg]) return SEG_ORDER[a.seg] - SEG_ORDER[b.seg];
    if (a.seg === 'kayip' || a.seg === 'kuculen') return b.pr - b.cur - (a.pr - a.cur);
    return b.cur - a.cur;
  });
  return list;
}

export const SEG_LABEL: Record<Segment, string> = {
  buyuyen: 'Büyüyen',
  kuculen: 'Küçülen',
  yeni: 'Yeni',
  kayip: 'Kayıp',
  stabil: 'Stabil',
};

/** Yeni / kayıp müşteri akışı (ay bazında) */
export function flowMonths(data: Row[], refD: Date | null): FlowMonth[] {
  const firstM = new Map<string, string>();
  const lastT = new Map<string, number>();
  data.forEach((r) => {
    if (!r.tarih) return;
    const n = r.musteri;
    const ym = ymOf(r.tarih);
    if (!firstM.has(n) || ym < firstM.get(n)!) firstM.set(n, ym);
    const t = r.tarih.getTime();
    if (!lastT.has(n) || t > lastT.get(n)!) lastT.set(n, t);
  });
  const refT = refD ? refD.getTime() : null;
  const months = uniq(data.filter((r) => r.tarih).map((r) => ymOf(r.tarih!))).sort();
  return months
    .map((ym) => {
      const aktif = new Set(
        data.filter((r) => r.tarih && ymOf(r.tarih!) === ym).map((r) => r.musteri)
      );
      let yeni = 0, kayip = 0;
      firstM.forEach((v) => { if (v === ym) yeni++; });
      lastT.forEach((mx, n) => {
        if (firstM.get(n) !== ym) return;
        if (refT != null && (refT - mx) / 864e5 > 45) kayip++;
      });
      return { ym, yeni, kayip, aktif: aktif.size };
    })
    .reverse();
}

export { nf1, pad2, isoWeek };
