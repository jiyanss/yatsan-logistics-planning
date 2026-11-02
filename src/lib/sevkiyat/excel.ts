/* Excel okuma/yazma katmanı — SheetJS ile (eski panelin ayrıştırıcı mantığının tam portu) */
import * as XLSX from 'xlsx';
import type { Row, Targets, WeeklyAgg, DailyAgg, CustAgg, GrowthRow } from './types';
import { GUNLER, nf1, fmtDate, cleanText, toNum, colLetter, uniq, pad2 } from './core';
import { parseDate, hydrate, isoWeek } from './dates';
import { weeklyAgg, monthlyAgg, dailyList, custAgg, custLifeRows } from './analytics';

export interface FieldDef {
  key: string;
  label: string;
  req?: boolean;
  exact: string[];
}

export const FIELD_DEFS: FieldDef[] = [
  { key: 'musteri', label: 'Müşteri', req: true, exact: ['musteri', 'musteriadi', 'musteriismi', 'customer', 'firma', 'cari', 'cariadi', 'iskolu'] },
  { key: 'bolum', label: 'Bölüm', exact: ['bolum', 'bolumu', 'departman', 'department', 'dep'] },
  { key: 'kategori', label: 'Kategori', exact: ['kategori', 'category', 'kat'] },
  { key: 'sevkiyatTipi', label: 'Sevkiyat Tipi', exact: ['sevkiyattipi', 'sevkiyatturu', 'sevkiyatcinsi', 'tip', 'tipi', 'aractipi', 'konteynirtipi'] },
  { key: 'adet', label: 'Adet (araç sayısı)', exact: ['adet', 'aracadet', 'miktar', 'quantity', 'qty', 'sayi'] },
  { key: 'tarih', label: 'Tarih', exact: ['tarih', 'yuklemetarihi', 'sevkiyattarihi', 'date'] },
  { key: 'parsiyelM3', label: 'Parsiyel m³', exact: ['parsiyelm3', 'parsiyel', 'parsiyelhacim'] },
  { key: 'toplamM3', label: 'Toplam Yüklenen m³', exact: ['toplamyuklenenm3', 'yuklenenm3', 'toplamm3', 'm3', 'hacim', 'toplamhacim', 'yuklenenhacim', 'cbm'] },
];

type Aoa = unknown[][];

function localNorm(s: unknown): string {
  return String(s == null ? '' : s)
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/Ş/g, 's').replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c')
    .toLowerCase().replace(/³/g, '3').replace(/²/g, '2').replace(/[^a-z0-9]/g, '');
}

export function sheetAoa(wb: XLSX.WorkBook, name: string): Aoa {
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true });
}

export interface HeaderDetect {
  idx: number;
  score: number;
  cols: Record<string, string>; // kolon index -> alan anahtarı
}

export function detectHeader(aoa: Aoa): HeaderDetect {
  let best: HeaderDetect = { idx: -1, score: 0, cols: {} };
  const limit = Math.min(aoa.length, 100);
  for (let i = 0; i < limit; i++) {
    const r = aoa[i] || [];
    let empty = true;
    for (let q = 0; q < r.length; q++) {
      if (r[q] !== '' && r[q] != null) { empty = false; break; }
    }
    if (empty) continue;
    const cols: Record<string, string> = {};
    let score = 0;
    r.forEach((h, c) => {
      const n = localNorm(h);
      if (!n) return;
      for (const f of FIELD_DEFS) {
        if (f.exact.indexOf(n) >= 0) { cols[c] = f.key; score += 3; break; }
      }
    });
    r.forEach((h, c) => {
      const n = localNorm(h);
      if (!n || cols[c] != null) return;
      for (const f of FIELD_DEFS) {
        let ok = false;
        f.exact.forEach((a) => { if (a.length >= 4 && n.indexOf(a) >= 0) ok = true; });
        if (ok) { cols[c] = f.key; score += 1; break; }
      }
    });
    const vals = Object.keys(cols).map((k) => cols[k]);
    if (vals.indexOf('tarih') >= 0) score += 4;
    if (vals.indexOf('adet') >= 0) score += 2;
    if (vals.indexOf('toplamM3') >= 0) score += 2;
    if (Object.keys(cols).length && score > best.score) best = { idx: i, score, cols };
  }
  return best;
}

export function rowsFromSheet(aoa: Aoa, hi: number, cols: Record<string, string>): Row[] {
  const out: Row[] = [];
  for (let i = hi + 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || !r.length) continue;
    let hasVal = false;
    for (let q = 0; q < r.length; q++) {
      if (r[q] !== '' && r[q] != null) { hasVal = true; break; }
    }
    if (!hasVal) continue;
    const get = (f: string): unknown => {
      for (const k in cols) {
        if (cols[k] === f) return r[+k];
      }
      return '';
    };
    const musteri = cleanText(get('musteri'));
    const tarih = parseDate(get('tarih'));
    if (!musteri && !tarih) continue;
    const par = toNum(get('parsiyelM3'));
    const top = toNum(get('toplamM3'));
    out.push(
      hydrate({
        id: '',
        musteri,
        bolum: cleanText(get('bolum')) || 'Diğer',
        kategori: cleanText(get('kategori')),
        tip: cleanText(get('sevkiyatTipi')) || 'Bilinmiyor',
        // ADET kolonu boş/hiç yoksa her satır 1 araç/yükleme sayılır:
        // aynı tarih+müşteri+tip'teki 4 satır → yükleme adedi 4 (pivot satır sayısı)
        adet: toNum(get('adet')) || 1,
        tarih,
        parsiyelM3: par,
        toplamM3: top,
        m3: top || par || 0,
      })
    );
  }
  return out;
}

export interface AutoParseResult {
  used: string[];
  rows: Row[];
  dups: number;
}

/** Tüm sayfaları gezip otomatik ayrıştırır; sayfalar arası birebir tekrarları atar */
export function autoParse(wb: XLSX.WorkBook): AutoParseResult {
  const perSheet = new Map<string, Set<string>>();
  const combined: Row[] = [];
  const used: string[] = [];
  let dups = 0;
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) return;
    if (localNorm(name).indexOf('hedef') >= 0) return;
    const aoa = sheetAoa(wb, name);
    const det = detectHeader(aoa);
    if (det.idx < 0) return;
    const rows = rowsFromSheet(aoa, det.idx, det.cols);
    if (!rows.length) return;
    used.push(name);
    const sigs = rows.map((r) => {
      const base = r.musteri + '|' + r.bolum + '|' + r.tip + '|' + r.tarihStr + '|' + r.adet + '|' + r.kategori + '|' + r.m3;
      return base;
    });
    rows.forEach((r, ri) => {
      let isDup = false;
      perSheet.forEach((set, otherName) => {
        if (otherName !== name && set.has(sigs[ri])) isDup = true;
      });
      if (isDup) { dups++; return; }
      combined.push(r);
    });
    perSheet.set(name, new Set(sigs));
  });
  return { used, rows: combined, dups };
}

/** 'HEDEF' adlı sayfadan aylık hedefleri içe aktarır */
export function importTargetsFromWb(wb: XLSX.WorkBook, targets: Targets): { targets: Targets; count: number } {
  let imported = 0;
  const out: Targets = { ...targets };
  wb.SheetNames.forEach((name) => {
    if (localNorm(name).indexOf('hedef') < 0) return;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, defval: '', raw: true });
    if (!aoa.length) return;
    let hi = -1, cm = -1, ca = -1, cv = -1;
    for (let i = 0; i < Math.min(aoa.length, 20); i++) {
      const r = aoa[i] || [];
      r.forEach((h, c) => {
        const n = localNorm(h);
        if (!n) return;
        if (cm < 0 && ['ay', 'donem', 'month', 'period'].indexOf(n) >= 0) cm = c;
        if (ca < 0 && ['arachedef', 'arac', 'achedef'].indexOf(n) >= 0) ca = c;
        if (cv < 0 && ['m3hedef', 'hedefm3', 'm3', 'hacim'].indexOf(n) >= 0) cv = c;
      });
      if (cm >= 0) { hi = i; break; }
    }
    if (hi < 0) return;
    for (let i2 = hi + 1; i2 < aoa.length; i2++) {
      const rr = aoa[i2];
      if (!rr) continue;
      let any = false;
      rr.forEach((x) => { if (x !== '' && x != null) any = true; });
      if (!any) continue;
      let y: number | null = null, mo: number | null = null;
      const raw = String(rr[cm] == null ? '' : rr[cm]).trim();
      let m = raw.match(/^(\d{4})[-/.](\d{1,2})$/);
      if (m) { y = +m[1]; mo = +m[2]; }
      else {
        m = raw.match(/^(\d{1,2})[-/.](\d{4})$/);
        if (m) { mo = +m[1]; y = +m[2]; }
      }
      if (!y || !mo || mo < 1 || mo > 12) continue;
      const adet = toNum(rr[ca]);
      const m3 = toNum(rr[cv]);
      if (!adet && !m3) continue;
      out[y + '-' + pad2(mo)] = { adet, m3 };
      imported++;
    }
  });
  return { targets: out, count: imported };
}

export interface FileStat {
  noDate: number;
  range: string;
}

export function fileStat(rows: Row[]): FileStat {
  const withDate = rows.filter((r) => r.tarih);
  const noDate = rows.length - withDate.length;
  let range = '—';
  if (withDate.length) {
    const ts = withDate.map((r) => r.tarih!.getTime());
    range = fmtDate(new Date(Math.min(...ts))) + ' – ' + fmtDate(new Date(Math.max(...ts)));
  }
  return { noDate, range };
}

/* ---- Şablon indir ---- */
export function downloadTemplate(): void {
  const head = ['MÜŞTERİ', 'BÖLÜM', 'KATEGORİ', 'SEVKİYAT TİPİ', 'ADET', 'TARİH', 'PARSİYEL m3', 'TOPLAM YÜKLENEN m³', 'YIL', 'HAFTANIN GÜNÜ'];
  const ws = XLSX.utils.aoa_to_sheet([
    head,
    ['ÖRNEK MÜŞTERİ A.Ş.', 'EXPORT-1', 'PLANLI', '40 HC', 2, '15.01.2025', '', 140, '', ''],
    ['ÖRNEK MÜŞTERİ B LTD', 'EXPORT-2', 'PLANLI', 'PARSİYEL TIR', 1, '16.01.2025', '50', '50', '', ''],
  ]);
  ws['!cols'] = [{ wch: 30 }, { wch: 11 }, { wch: 10 }, { wch: 14 }, { wch: 7 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 7 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sevkiyat');
  const hw = XLSX.utils.aoa_to_sheet([['AY', 'ARAÇ HEDEF', 'M3 HEDEF'], ['2025-02', 250, 18000], ['2025-03', 280, 20000]]);
  XLSX.utils.book_append_sheet(wb, hw, 'HEDEF');
  XLSX.writeFile(wb, 'Sevkiyat_Sablon.xlsx');
}

/* ---- 9 sayfalık rapor dışa aktarımı ---- */
export function exportReports(
  rows: Row[],
  allData: Row[],
  targets: Targets,
  caps: Record<string, number>,
  growthYear: number | null
): string {
  const wb = XLSX.utils.book_new();
  const deps = uniq(rows.map((r) => r.bolum)).sort();
  const tips = uniq(rows.map((r) => r.tip)).sort();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(
      ([['MÜŞTERİ', 'BÖLÜM', 'KATEGORİ', 'SEVKİYAT TİPİ', 'ADET', 'TARİH', 'PARSİYEL m3', 'TOPLAM YÜKLENEN m³', 'YIL', 'HAFTANIN GÜNÜ']] as unknown[][]).concat(
        rows.map((r) => [r.musteri, r.bolum, r.kategori, r.tip, r.adet, r.tarihStr, r.parsiyelM3 || '', r.toplamM3 || '', r.yil, r.gun])
      )
    ),
    'Veriler'
  );
  const weekly = weeklyAgg(rows.filter((r) => r.tarih)).sort((a, b) => a.yil - b.yil || a.hafta - b.hafta);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(
      ([['YIL', 'HAFTA', 'İLK GÜN', 'SON GÜN', 'ARAÇ', 'm³'].concat(deps.map((d) => d + ' m³'))] as unknown[][]).concat(
        weekly.map((w) => {
          const base: unknown[] = [w.yil, w.hafta, w.min != null ? fmtDate(new Date(w.min)) : '', w.max != null ? fmtDate(new Date(w.max)) : '', w.adet, +w.m3.toFixed(1)];
          return base.concat(deps.map((d) => +(w.deps[d] || 0).toFixed(1)));
        })
      )
    ),
    'Haftalik'
  );
  const daily: DailyAgg[] = dailyList(rows);
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(
      ([['TARİH', 'GÜN', 'ARAÇ', 'm³']] as unknown[][]).concat(daily.map((x) => [fmtDate(x.d), x.gun, x.adet, +x.m3.toFixed(1)]))
    ),
    'Gunluk'
  );
  const cell: Record<string, { adet: number; m3: number }> = {};
  rows.forEach((r) => {
    const k = r.bolum + '|' + r.tip;
    if (!cell[k]) cell[k] = { adet: 0, m3: 0 };
    cell[k].adet += r.adet;
    cell[k].m3 += r.m3;
  });
  const mkMat = (val: 'adet' | 'm3'): unknown[][] => {
    const head: unknown[] = ['BÖLÜM'].concat(tips).concat(['TOPLAM']);
    const body: unknown[][] = deps.map((d) => {
      let tot = 0;
      const row: unknown[] = [d];
      tips.forEach((t) => {
        const c = cell[d + '|' + t] || { adet: 0, m3: 0 };
        tot += val === 'm3' ? c.m3 : c.adet;
        row.push(val === 'm3' ? +c.m3.toFixed(1) : c.adet);
      });
      row.push(val === 'm3' ? +tot.toFixed(1) : tot);
      return row;
    });
    return [head].concat(body);
  };
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mkMat('adet')), 'Matris-Arac');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mkMat('m3')), 'Matris-m3');
  const custs: CustAgg[] = custAgg(rows);
  const abcRows: unknown[][] = [['SIRA', 'MÜŞTERİ', 'SINIF', 'ARAÇ', 'M³', 'PAY %', 'KÜM %', 'YÜKLEME', 'SON']];
  custs.forEach((c, i) => {
    abcRows.push([i + 1, c.name, c.cls, c.adet, +c.m3.toFixed(1), +c.share.toFixed(1), +c.cum.toFixed(1), c.loads, c.last ? fmtDate(c.last) : '']);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abcRows), 'MusteriABC');
  const mon = monthlyAgg(rows);
  const monRows: unknown[][] = [['AY', 'ARAÇ', 'M³']];
  const head2: unknown[] = monRows[0];
  deps.forEach((d) => head2.push(d + ' m³'));
  mon.forEach((m) => {
    const base: unknown[] = [m.ym, m.adet, +m.m3.toFixed(1)];
    deps.forEach((d) => base.push(+(m.deps[d] || 0).toFixed(1)));
    monRows.push(base);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(monRows), 'Aylik');
  const life = custLifeRows(allData, caps);
  const risk = life.list.filter((o) => o.status === 'risk');
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(
      ([['MÜŞTERİ', 'SINIF', 'YÜKLEME', 'ORT ARALIK', 'SON', 'GEÇEN GÜN', 'DURUM']] as unknown[][]).concat(
        risk.map((o) => [o.name, o.cls, o.loads, o.avgInt == null ? '' : o.avgInt, o.last ? fmtDate(o.last) : '', o.gap == null ? '' : o.gap, 'Riskli'])
      )
    ),
    'RiskliMusteri'
  );
  const gy = growthYear || Math.max(0, ...allData.map((r) => +(r.yil || 0)));
  if (gy) {
    const prev = gy - 1;
    const segLabel: Record<string, string> = { kayip: 'Kayıp', kuculen: 'Küçülen', yeni: 'Yeni', buyuyen: 'Büyüyen', stabil: 'Stabil' };
    const gRows: GrowthRow[] = buildGrowth(allData, gy);
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(
        ([['MÜŞTERİ', 'SEGMENT', prev + ' M³', gy + ' M³', 'Δ M³']] as unknown[][]).concat(
          gRows.map((o) => [o.name, segLabel[o.seg], +o.pr.toFixed(1), +o.cur.toFixed(1), +(o.cur - o.pr).toFixed(1)])
        )
      ),
      'BuyumeMatrisi'
    );
  }
  const hedefRows: unknown[][] = [['AY', 'ARAÇ HEDEF', 'ARAÇ GERÇEK', 'M³ HEDEF', 'M³ GERÇEK']];
  const byYm = new Map(mon.map((m) => [m.ym, m] as const));
  uniq(Object.keys(targets).concat(mon.map((m) => m.ym))).sort().forEach((ym) => {
    const t = targets[ym] || { adet: 0, m3: 0 };
    const a = byYm.get(ym) || { adet: 0, m3: 0 };
    hedefRows.push([ym, t.adet || '', a.adet, t.m3 || '', +a.m3.toFixed(1)]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(hedefRows), 'Hedefler');
  const fname = 'Sevkiyat_Rapor_' + new Date().toISOString().slice(0, 10) + '.xlsx';
  XLSX.writeFile(wb, fname);
  return fname;
}

/** Büyüme matrisi satırları (YoY segment analizi) — analytics'ten bağımsız derin kopya üretir */
function buildGrowth(data: Row[], year: number): GrowthRow[] {
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
  const names = uniq(Array.from(A.keys()).concat(Array.from(B.keys())));
  return names.map((n) => {
    const a = A.get(n) || { m3: 0, adet: 0 };
    const b = B.get(n) || { m3: 0, adet: 0 };
    let seg: GrowthRow['seg'];
    let delta: number | null = null;
    if (a.m3 > 0 && b.m3 > 0) {
      delta = ((a.m3 - b.m3) / b.m3) * 100;
      seg = delta >= 10 ? 'buyuyen' : delta <= -10 ? 'kuculen' : 'stabil';
    } else if (a.m3 > 0) seg = 'yeni';
    else seg = 'kayip';
    return { name: n, cls: 'C' as const, cur: a.m3, curA: a.adet, pr: b.m3, prA: b.adet, delta, seg };
  });
}

export { GUNLER, nf1, colLetter, isoWeek };
