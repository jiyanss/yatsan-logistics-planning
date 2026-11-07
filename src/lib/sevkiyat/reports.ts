/* Yönetim raporları veri katmanı — SALT OKUNUR agregasyonlar.
   Mevcut veri yükleme/senkron mantığına (excel, id, firebase, store) dokunmaz. */
import type { Row } from './types';
import { monthlyAgg, custAgg, weekdayData } from './analytics';
import { ymOf, ymLabel, norm, uniq, maxDate, AYLAR_UZUN } from './core';

/* ---------- KPI ---------- */

export interface RaporKPI {
  toplamM3: number;
  toplamAdet: number;
  musteriSayisi: number;
  seferSayisi: number;
  ortSeferM3: number;
}

/** KPI kartları: toplam hacim, ekipman adedi, aktif müşteri, ortalama sefer başı hacim */
export function raporKPI(rows: Row[]): RaporKPI {
  let toplamM3 = 0;
  let toplamAdet = 0;
  rows.forEach((r) => {
    toplamM3 += r.m3;
    toplamAdet += r.adet;
  });
  const ms = new Set(rows.map((r) => norm(r.musteri)));
  const sefer = rows.length;
  return {
    toplamM3,
    toplamAdet,
    musteriSayisi: ms.size,
    seferSayisi: sefer,
    ortSeferM3: sefer ? toplamM3 / sefer : 0,
  };
}

export function yilListesi(data: Row[]): number[] {
  return uniq(data.filter((r) => r.yil != null).map((r) => r.yil as number)).sort((a, b) => a - b);
}

/* ---------- Trend ---------- */

export interface TrendNokta {
  etiket: string;
  m3: number;
  adet: number;
}

export function aylikTrend(rows: Row[]): TrendNokta[] {
  return monthlyAgg(rows).map((m) => ({ etiket: ymLabel(m.ym), m3: +m.m3.toFixed(1), adet: m.adet }));
}

export function yillikTrend(rows: Row[]): TrendNokta[] {
  const m = new Map<number, { m3: number; adet: number }>();
  rows.forEach((r) => {
    if (r.yil == null) return;
    const o = m.get(r.yil) || { m3: 0, adet: 0 };
    o.m3 += r.m3;
    o.adet += r.adet;
    m.set(r.yil, o);
  });
  return Array.from(m.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([y, o]) => ({ etiket: String(y), m3: +o.m3.toFixed(1), adet: o.adet }));
}

/* ---------- Dağılımlar ---------- */

export interface Dilim {
  ad: string;
  m3: number;
  adet: number;
  pay: number;
}

/** İhracat bölüm payları (EXPORT-1/2/3) — donut */
export function bolumPaylari(rows: Row[]): Dilim[] {
  const m = new Map<string, { m3: number; adet: number }>();
  rows.forEach((r) => {
    const o = m.get(r.bolum) || { m3: 0, adet: 0 };
    o.m3 += r.m3;
    o.adet += r.adet;
    m.set(r.bolum, o);
  });
  const tot = rows.reduce((s, r) => s + r.m3, 0) || 1;
  return Array.from(m.entries())
    .map(([ad, o]) => ({ ad, m3: o.m3, adet: o.adet, pay: (o.m3 / tot) * 100 }))
    .sort((a, b) => b.m3 - a.m3);
}

/** Sevkiyat tipi hacim dağılımı — ilk topN, kalan "Diğer" */
export function tipDagilimi(rows: Row[], topN = 8): Dilim[] {
  const m = new Map<string, { m3: number; adet: number }>();
  rows.forEach((r) => {
    const o = m.get(r.tip) || { m3: 0, adet: 0 };
    o.m3 += r.m3;
    o.adet += r.adet;
    m.set(r.tip, o);
  });
  const tot = rows.reduce((s, r) => s + r.m3, 0) || 1;
  const list = Array.from(m.entries())
    .map(([ad, o]) => ({ ad, m3: o.m3, adet: o.adet, pay: (o.m3 / tot) * 100 }))
    .sort((a, b) => b.m3 - a.m3);
  if (list.length <= topN) return list;
  const ust = list.slice(0, topN);
  const kalan = list.slice(topN);
  const dM3 = kalan.reduce((s, d) => s + d.m3, 0);
  const dA = kalan.reduce((s, d) => s + d.adet, 0);
  ust.push({ ad: 'Diğer (' + kalan.length + ' tip)', m3: dM3, adet: dA, pay: (dM3 / tot) * 100 });
  return ust;
}

/* ---------- Günlük operasyon yoğunluğu ---------- */

export interface GunDag {
  gunler: string[];
  ortM3: number[];
  ortAdet: number[];
  gunSayisi: number[];
}

/** Haftanın günlerine göre ortalama günlük yük (gerçek gün sayısına bölünmüş) */
export function gunYogunlugu(rows: Row[]): GunDag {
  const w = weekdayData(rows);
  return { gunler: w.labels, ortM3: w.realM3, ortAdet: w.realA, gunSayisi: w.daysCount };
}

export interface IsiHucresi {
  ym: string;
  gun: number; // 0=Pazar..6=Cumartesi (Date.getDay)
  m3: number;
}

/** Ay × haftanın günü yoğunluk matrisi (ısı haritası) */
export function isiHaritasi(rows: Row[]): { ymler: string[]; hucreler: IsiHucresi[]; max: number } {
  const m = new Map<string, number>();
  rows.filter((r) => r.tarih).forEach((r) => {
    const ym = ymOf(r.tarih!);
    const g = r.tarih!.getDay();
    const k = ym + '|' + g;
    m.set(k, (m.get(k) || 0) + r.m3);
  });
  const ymler = uniq(rows.filter((r) => r.tarih).map((r) => ymOf(r.tarih!))).sort();
  const hucreler: IsiHucresi[] = [];
  m.forEach((v, k) => {
    const i = k.indexOf('|');
    hucreler.push({ ym: k.slice(0, i), gun: +k.slice(i + 1), m3: +v.toFixed(1) });
  });
  return { ymler, hucreler, max: hucreler.reduce((s, h) => Math.max(s, h.m3), 0) };
}

/* ---------- Müşteri performansı ---------- */

export type TipSinif = 'komple' | 'parsiyel' | 'konteyner';

export function tipSinifi(tip: string): TipSinif {
  const t = tip.toLocaleLowerCase('tr-TR');
  if (t.indexOf('parsiyel') >= 0) return 'parsiyel';
  if (t.indexOf('tır') >= 0 || t.indexOf('tir') >= 0) return 'komple';
  return 'konteyner';
}

export const TIP_SINIF_ETIKET: Record<TipSinif, string> = {
  komple: 'Komple TIR',
  parsiyel: 'Parsiyel TIR',
  konteyner: 'Konteyner',
};

export interface MusteriSatiri {
  name: string;
  m3: number;
  adet: number;
  sefer: number;
  pay: number;
  ortSefer: number;
  kompleTIR: number;
  parsiyelTIR: number;
  konteyner: number;
}

/** En yüksek hacimli n müşteri + ekipman kırılımı */
export function topMusteriler(rows: Row[], n = 10): MusteriSatiri[] {
  const agg = custAgg(rows).slice(0, n);
  const equip = new Map<string, { k: number; p: number; c: number }>();
  rows.forEach((r) => {
    let o = equip.get(r.musteri);
    if (!o) { o = { k: 0, p: 0, c: 0 }; equip.set(r.musteri, o); }
    const s = tipSinifi(r.tip);
    if (s === 'komple') o.k += r.m3;
    else if (s === 'parsiyel') o.p += r.m3;
    else o.c += r.m3;
  });
  return agg.map((c) => {
    const e = equip.get(c.name) || { k: 0, p: 0, c: 0 };
    return {
      name: c.name,
      m3: c.m3,
      adet: c.adet,
      sefer: c.loads,
      pay: c.share,
      ortSefer: c.loads ? c.m3 / c.loads : 0,
      kompleTIR: e.k,
      parsiyelTIR: e.p,
      konteyner: e.c,
    };
  });
}

/* ---------- Müşteri kartları ---------- */

export interface MusteriYil {
  yil: number;
  m3: number;
  adet: number;
  sefer: number;
}

export interface MusteriKarti {
  name: string;
  cls: 'A' | 'B' | 'C';
  m3: number;
  adet: number;
  sefer: number;
  pay: number;
  ortSefer: number;
  kompleTIR: number;
  parsiyelTIR: number;
  konteyner: number;
  yillar: MusteriYil[];
  degisim: number | null; // seçili/son yıl vs önceki yıl (%)
  degYil: number | null;
  degPrevYil: number | null;
  yeniMi: boolean; // önceki yılda verisi yok
  sonYukleme: Date | null;
  ritim: 'ok' | 'watch' | 'risk' | 'tek';
  enYogunAy: string;
}

/**
 * Müşteri kartları. seciliYil null → tüm zamanların toplamı, değişim = son yıl vs önceki yıl.
 * seciliYil verildiğinde kart değerleri o yıla ait olur; değişim bir önceki yıla göre hesaplanır.
 */
export function musteriKartlari(data: Row[], seciliYil: number | null): MusteriKarti[] {
  const years = yilListesi(data);
  const toplamKapsam = data.filter((r) => seciliYil == null || r.yil === seciliYil).reduce((s, r) => s + r.m3, 0) || 1;
  const curY = seciliYil != null ? seciliYil : years.length ? years[years.length - 1] : null;
  const prevYil = seciliYil != null ? seciliYil - 1 : years.length >= 2 ? years[years.length - 1] - 1 : null;

  /* yaşam döngüsü izleme: ilk/son yükleme, farklı gün sayısı, aylık yoğunluk */
  const track = new Map<string, { ilkT: number | null; sonT: number | null; days: Set<string>; aylar: number[] }>();
  data.forEach((r) => {
    if (!r.tarih) return;
    let t = track.get(r.musteri);
    if (!t) { t = { ilkT: null, sonT: null, days: new Set<string>(), aylar: new Array(12).fill(0) }; track.set(r.musteri, t); }
    const ts = r.tarih.getTime();
    if (t.ilkT == null || ts < t.ilkT) t.ilkT = ts;
    if (t.sonT == null || ts > t.sonT) t.sonT = ts;
    t.days.add(r.tarihStr);
    t.aylar[r.tarih.getMonth()] += r.m3;
  });
  const refT = maxDate(data)?.getTime() ?? null;

  const map = new Map<string, MusteriKarti>();
  data.forEach((r) => {
    let o = map.get(r.musteri);
    if (!o) {
      o = {
        name: r.musteri, cls: 'C', m3: 0, adet: 0, sefer: 0, pay: 0, ortSefer: 0,
        kompleTIR: 0, parsiyelTIR: 0, konteyner: 0, yillar: [],
        degisim: null, degYil: curY, degPrevYil: prevYil, yeniMi: false,
        sonYukleme: null, ritim: 'tek', enYogunAy: '—',
      };
      map.set(r.musteri, o);
    }
    if ((seciliYil == null || r.yil === seciliYil) && r.yil != null) {
      // Kart değerleri: yıl seçiliyse o yıl; "Tüm yıllar" ise tüm zamanlar
      o.m3 += r.m3;
      o.adet += r.adet;
      o.sefer += 1;
      const s = tipSinifi(r.tip);
      if (s === 'komple') o.kompleTIR += r.m3;
      else if (s === 'parsiyel') o.parsiyelTIR += r.m3;
      else o.konteyner += r.m3;
    }
    if (r.yil != null) {
      let yy = o.yillar.find((y) => y.yil === r.yil);
      if (!yy) { yy = { yil: r.yil, m3: 0, adet: 0, sefer: 0 }; o.yillar.push(yy); }
      yy.m3 += r.m3;
      yy.adet += r.adet;
      yy.sefer += 1;
    }
  });

  const clsMap = new Map(custAgg(data).map((c) => [c.name, c.cls] as const));
  const list = Array.from(map.values());
  list.forEach((o) => {
    o.cls = clsMap.get(o.name) || 'C';
    o.pay = (o.m3 / toplamKapsam) * 100;
    o.ortSefer = o.sefer ? o.m3 / o.sefer : 0;
    o.yillar.sort((a, b) => a.yil - b.yil);
    if (curY != null && prevYil != null) {
      // Değişim her zaman son yıl (veya seçili yıl) hacmi ile önceki yıl hacmi arasında olur.
      // "Tüm yıllar" modunda o.m3 tüm zamanların toplamıdır; bu yüzden karşılaştırmada
      // mutlaka curY'nin yıllık toplamı (o.yillar) kullanılmalı, aksi halde rozet
      // "tüm zamanlar vs önceki yıl" gibi anlamsız devre bir yüzde üretir.
      const c = o.yillar.find((y) => y.yil === curY);
      const p = o.yillar.find((y) => y.yil === prevYil);
      if (c && p && p.m3 > 0) o.degisim = ((c.m3 - p.m3) / p.m3) * 100;
      // "Yeni" rozeti yalnızca ilk sevkiyatı son yılda (curY) olan müşterilere verilmeli;
      // 2025'te sevkiyatı olmayan ama daha önce (örn. 2024 ve öncesi) yüklemiş müşteri "Yeni" değildir.
      else o.yeniMi = o.yillar.length > 0 && o.yillar[0].yil === curY;
    }
    /* ritim + son yükleme + en yoğun ay */
    const t = track.get(o.name);
    if (t && t.sonT != null) {
      o.sonYukleme = new Date(t.sonT);
      const days = t.days.size;
      const avgInt = days >= 2 && t.ilkT != null ? (t.sonT - t.ilkT) / 864e5 / (days - 1) : null;
      const gap = refT != null ? Math.max(0, Math.round((refT - t.sonT) / 864e5)) : null;
      const eff = avgInt != null ? Math.max(avgInt, 5) : null;
      o.ritim = days < 2 || eff == null || gap == null ? 'tek'
        : gap <= Math.round(eff * 1.3) ? 'ok'
          : gap <= Math.round(eff * 1.8) ? 'watch' : 'risk';
      let mi = 0;
      t.aylar.forEach((v, i) => { if (v > t.aylar[mi]) mi = i; });
      o.enYogunAy = t.aylar[mi] > 0 ? AYLAR_UZUN[mi] : '—';
    }
  });
  return list;
}
