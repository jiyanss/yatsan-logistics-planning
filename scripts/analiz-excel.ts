/* dashboard.xlsx analizi — panelin GERÇEK parser'ı ile (autoParse + reassignIds)
   Çıktılar: satır sayısı, ID simülasyonu, eski-mantık çökme simülasyonu, aylık/yıllık toplamlar */
import * as XLSX from 'xlsx';
import { autoParse, rowsFromSheet, detectHeader, sheetAoa } from '../src/lib/sevkiyat/excel';
import { reassignIds, bkBase } from '../src/lib/sevkiyat/id';
import type { Row } from '../src/lib/sevkiyat/types';

const wb = XLSX.readFile('/home/z/my-project/upload/dashboard.xlsx');
console.log('Sayfalar:', wb.SheetNames.join(', '));

const res = autoParse(wb);
const rows = res.rows;
console.log('\n== AYRIŞTIRMA ==');
console.log('Kullanılan sayfalar:', res.used.join(', '));
console.log('Okunan satır:', rows.length, '(sayfalar arası atlanan birebir tekrar:', res.dups + ')');
const noDate = rows.filter((r) => !r.tarih);
console.log('Tarihsiz satır:', noDate.length);
if (noDate.length) {
  console.log('  Tarihsiz örnek:', noDate.slice(0, 5).map((r) => r.musteri + '|' + r.tip + '|adet=' + r.adet).join(' ; '));
}
const withDate = rows.filter((r) => r.tarih);
const ts = withDate.map((r) => r.tarih!.getTime());
const min = new Date(Math.min(...ts)), max = new Date(Math.max(...ts));
console.log('Tarih aralığı:', min.toISOString().slice(0, 10), '–', max.toISOString().slice(0, 10));

// Yeni mantık: her satır ayrı kayıt
const newIds = reassignIds(rows.map((r) => ({ ...r })));
const uniqNew = new Set(newIds.map((r) => r.id));
console.log('\n== ID SİMÜLASYONU ==');
console.log('YENİ mantık kayıt sayısı (siteye yazılacak):', uniqNew.size, '(satır sayısıyla aynı olmalı)');

// Eski mantık simülasyonu: (müşteri|bölüm|tip|tarih|adet) bazında tek kayıt
const oldKeys = new Set(rows.map((r) => bkBase(r)));
console.log('ESKİ mantık (çökmüş) kayıt sayısı:', oldKeys.size, '→ kaybedilen satır:', rows.length - oldKeys.size);

// Çöken gruplar (2+ satırı olan kombinasyonlar)
const grp = new Map<string, number>();
rows.forEach((r) => { const k = bkBase(r); grp.set(k, (grp.get(k) || 0) + 1); });
const multi = Array.from(grp.entries()).filter(([, n]) => n > 1);
console.log('2+ satırlı kombinasyon sayısı:', multi.length, '| bu kombinasyonlardaki toplam satır:', multi.reduce((a, [, n]) => a + n, 0));
const topMulti = multi.sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log('En çok tekrarlanan 8:', topMulti.map(([k, n]) => k + ' ×' + n).join(' | '));

// Toplamlar
const adetTop = rows.reduce((a, r) => a + (r.adet || 0), 0);
const m3Top = rows.reduce((a, r) => a + (r.m3 || 0), 0);
console.log('\n== TOPLAMLAR (tüm veri) ==');
console.log('YÜKLEME ADEDİ (satır):', rows.length, '| ARAÇ (adet toplamı):', adetTop, '| m³:', Math.round(m3Top));

// Yıllık
const byYear = new Map<number, { adet: number; m3: number; satir: number }>();
withDate.forEach((r) => {
  const y = r.yil!;
  const o = byYear.get(y) || { adet: 0, m3: 0, satir: 0 };
  o.adet += r.adet || 0; o.m3 += r.m3 || 0; o.satir += 1;
  byYear.set(y, o);
});
console.log('\n== YILLIK ==');
Array.from(byYear.keys()).sort().forEach((y) => {
  const o = byYear.get(y)!;
  console.log(y + ': satır=' + o.satir + ' araç=' + o.adet + ' m3=' + Math.round(o.m3));
});

// Aylık (tüm yıllar)
const byMonth = new Map<string, { adet: number; satir: number; m3: number }>();
withDate.forEach((r) => {
  const d = r.tarih!;
  const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const o = byMonth.get(ym) || { adet: 0, satir: 0, m3: 0 };
  o.adet += r.adet || 0; o.satir += 1; o.m3 += r.m3 || 0;
  byMonth.set(ym, o);
});
console.log('\n== AYLIK (satır / araç / m3) ==');
Array.from(byMonth.keys()).sort().forEach((ym) => {
  const o = byMonth.get(ym)!;
  console.log(ym + ': ' + o.satir + ' / ' + o.adet + ' / ' + Math.round(o.m3));
});

// Eski-mantık aylık farkı: her ay kaç satır çökecek?
const lostByMonth = new Map<string, number>();
multi.forEach(([k]) => {
  const parts = k.split('|');
  const tarih = parts[3];
  if (!tarih) return;
  const d = new Date(tarih);
  if (isNaN(d.getTime())) return;
  const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const n = grp.get(k)!;
  lostByMonth.set(ym, (lostByMonth.get(ym) || 0) + (n - 1));
});
console.log('\n== ESKİ MANTIKTA AY BAŞINA KAYBOLAN SATIR ==');
Array.from(lostByMonth.keys()).sort().forEach((ym) => console.log(ym + ': -' + lostByMonth.get(ym)));

// Excel ham satır sayısı (sayfa bazında)
console.log('\n== SAYFA BAZLI HAM TARAMA ==');
wb.SheetNames.forEach((name) => {
  const ws = wb.Sheets[name];
  if (!ws || !ws['!ref']) return;
  const aoa = sheetAoa(wb, name);
  const det = detectHeader(aoa);
  if (det.idx < 0) { console.log(name + ': başlık yok'); return; }
  const rs = rowsFromSheet(aoa, det.idx, det.cols);
  console.log(name + ': başlık satırı=' + (det.idx + 1) + ' okunan=' + rs.length);
});
