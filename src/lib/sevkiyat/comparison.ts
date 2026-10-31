/* YENİ — Karşılaştırma modülü: Yıl-yıl (YoY), Pareto, dönem KPI kıyası */
import type { Row, MonthlyAgg } from './types';
import { nf1 } from './core';
import { monthlyAgg, custAgg } from './analytics';

export interface YoYSeries {
  months: string[]; // 01..12
  adetA: number[];
  adetB: number[];
  m3A: number[];
  m3B: number[];
}

export interface DeptDelta {
  dep: string;
  m3A: number;
  m3B: number;
  delta: number;
  pct: number | null;
  adetA: number;
  adetB: number;
}

export interface KpiDelta {
  key: string;
  label: string;
  a: number;
  b: number;
  delta: number;
  pct: number | null;
  fmt: 'n0' | 'n1';
}

const MONTH_KEYS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

function yearMonthly(rows: Row[], year: number): MonthlyAgg[] {
  const mon = monthlyAgg(rows);
  return mon.filter((m) => m.ym.startsWith(year + '-'));
}

/** İki yılın aylık serileri (ay hizalı) */
export function yoySeries(rows: Row[], yearA: number, yearB: number): YoYSeries {
  const A = new Map(yearMonthly(rows, yearA).map((m) => [m.ym.slice(5), m] as const));
  const B = new Map(yearMonthly(rows, yearB).map((m) => [m.ym.slice(5), m] as const));
  return {
    months: MONTH_KEYS,
    adetA: MONTH_KEYS.map((k) => A.get(k)?.adet ?? 0),
    adetB: MONTH_KEYS.map((k) => B.get(k)?.adet ?? 0),
    m3A: MONTH_KEYS.map((k) => +(A.get(k)?.m3 ?? 0).toFixed(1)),
    m3B: MONTH_KEYS.map((k) => +(B.get(k)?.m3 ?? 0).toFixed(1)),
  };
}

/** Bölüm bazlı yıl kıyası */
export function deptDelta(rows: Row[], yearA: number, yearB: number): DeptDelta[] {
  const A = new Map<string, { m3: number; adet: number }>();
  const B = new Map<string, { m3: number; adet: number }>();
  rows.forEach((r) => {
    if (r.yil === yearA) {
      const o = A.get(r.bolum) || { m3: 0, adet: 0 };
      o.m3 += r.m3; o.adet += r.adet;
      A.set(r.bolum, o);
    } else if (r.yil === yearB) {
      const o = B.get(r.bolum) || { m3: 0, adet: 0 };
      o.m3 += r.m3; o.adet += r.adet;
      B.set(r.bolum, o);
    }
  });
  const deps = Array.from(new Set([...A.keys(), ...B.keys()])).sort();
  return deps
    .map((dep) => {
      const a = A.get(dep) || { m3: 0, adet: 0 };
      const b = B.get(dep) || { m3: 0, adet: 0 };
      const delta = a.m3 - b.m3;
      return {
        dep,
        m3A: +a.m3.toFixed(1),
        m3B: +b.m3.toFixed(1),
        delta: +delta.toFixed(1),
        pct: b.m3 ? +(((a.m3 - b.m3) / b.m3) * 100).toFixed(1) : null,
        adetA: a.adet,
        adetB: b.adet,
      };
    })
    .sort((x, y) => y.m3A - x.m3A);
}

/** Dönem KPI kıyası */
export function kpiDelta(rows: Row[], yearA: number, yearB: number): KpiDelta[] {
  const inA = rows.filter((r) => r.yil === yearA);
  const inB = rows.filter((r) => r.yil === yearB);
  const sum = (arr: Row[], f: (r: Row) => number) => +arr.reduce((s, r) => s + f(r), 0).toFixed(1);
  const adetA = sum(inA, (r) => r.adet);
  const adetB = sum(inB, (r) => r.adet);
  const m3A = sum(inA, (r) => r.m3);
  const m3B = sum(inB, (r) => r.m3);
  const custA = new Set(inA.map((r) => r.musteri)).size;
  const custB = new Set(inB.map((r) => r.musteri)).size;
  const daysA = new Set(inA.filter((r) => r.tarih).map((r) => r.tarihStr)).size;
  const daysB = new Set(inB.filter((r) => r.tarih).map((r) => r.tarihStr)).size;
  const avgA = adetA ? +(m3A / adetA).toFixed(1) : 0;
  const avgB = adetB ? +(m3B / adetB).toFixed(1) : 0;
  const mk = (key: string, label: string, a: number, b: number, fmt: 'n0' | 'n1'): KpiDelta => ({
    key, label, a, b, delta: +(a - b).toFixed(1), pct: b ? +(((a - b) / b) * 100).toFixed(1) : null, fmt,
  });
  return [
    mk('adet', 'Araç', adetA, adetB, 'n0'),
    mk('m3', 'Toplam m³', m3A, m3B, 'n1'),
    mk('avg', 'm³ / Araç', avgA, avgB, 'n1'),
    mk('cust', 'Müşteri', custA, custB, 'n0'),
    mk('days', 'Yükleme Günü', daysA, daysB, 'n0'),
  ];
}

/** Pareto: en büyük müşteriler + kümülatif pay (m³) */
export function pareto(rows: Row[], topN = 20): {
  names: string[];
  m3: number[];
  cumPct: number[];
  cls: string[];
  adet: number[];
} {
  const list = custAgg(rows).slice(0, topN);
  return {
    names: list.map((c) => c.name),
    m3: list.map((c) => +c.m3.toFixed(1)),
    cumPct: list.map((c) => +c.cum.toFixed(1)),
    cls: list.map((c) => c.cls),
    adet: list.map((c) => c.adet),
  };
}

export { nf1 };
