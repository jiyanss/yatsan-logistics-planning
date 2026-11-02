/* Eksik yükleme raporu: eski (çöktürme) mantıkta kaybolan satırlar + beklenen aylık toplamlar
   Çıktı: download/yukleme-eksik-raporu.xlsx */
import * as XLSX from 'xlsx';
import { autoParse } from '../src/lib/sevkiyat/excel';
import { bkBase } from '../src/lib/sevkiyat/id';
import type { Row } from '../src/lib/sevkiyat/types';

const wb = XLSX.readFile('/home/z/my-project/upload/dashboard.xlsx');
const rows: Row[] = autoParse(wb).rows;

/* Kombinasyon bazında grupla (dosya sırası korunur) */
const groups = new Map<string, Row[]>();
rows.forEach((r) => {
  const k = bkBase(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k)!.push(r);
});

const lost: Row[] = [];
const comboRows: unknown[][] = [];
let comboCount = 0;
groups.forEach((rs, k) => {
  if (rs.length < 2) return;
  comboCount++;
  const p = k.split('|');
  const tarih = p[3];
  rs.forEach((r, i) => {
    // eski mantık: aynı anahtara yazım → son satır kalır, öncekiler kaybolur
    const durum = i === rs.length - 1 ? 'kalan (son satır)' : 'KAYIP';
    if (i !== rs.length - 1) lost.push(r);
    if (i === 0) {
      comboRows.push([r.musteri, r.bolum, r.tip, tarih, r.adet, rs.length, rs.length - 1, r.m3]);
    }
  });
});

/* Beklenen aylık toplamlar */
const byMonth = new Map<string, { satir: number; adet: number; m3: number }>();
rows.filter((r) => r.tarih).forEach((r) => {
  const d = r.tarih!;
  const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const o = byMonth.get(ym) || { satir: 0, adet: 0, m3: 0 };
  o.satir += 1; o.adet += r.adet || 0; o.m3 += r.m3 || 0;
  byMonth.set(ym, o);
});

/* --- Dosya oluştur --- */
const out = XLSX.utils.book_new();

const ozet: unknown[][] = [
  ['YÜKLEME SAYIMI KARŞILAŞTIRMA RAPORU', ''],
  ['Rapor tarihi', new Date().toLocaleDateString('tr-TR')],
  ['', ''],
  ['Excel dosyası', 'dashboard.xlsx (sayfa: NEW KPI)'],
  ['Exceldeki GERÇEK satır (yükleme) sayısı', rows.length],
  ['ESKİ mantıkla oluşan kayıt (sitendeki muhtemel sayı)', rows.length - lost.length],
  ['KAYBOLAN satır sayısı', lost.length],
  ['Etkilenen (2+ tekrarlı) kombinasyon sayısı', comboCount],
  ['', ''],
  ['TOPLAM YÜKLEME (satır)', rows.length],
  ['TOPLAM ARAÇ (ADET kolonu toplamı)', rows.reduce((a, r) => a + (r.adet || 0), 0)],
  ['TOPLAM m³', Math.round(rows.reduce((a, r) => a + (r.m3 || 0), 0))],
  ['', ''],
  ['AÇIKLAMA', 'Eski kod aynı tarih+müşteri+bölüm+tip+adet kombinasyonunu TEK kayıta çöktürüyordu;'],
  ['', 'son satır kalıyor, öncekiler siliniyordu. Aşağıdaki sayfalarda eksik satırlar listelidir.'],
  ['ÇÖZÜM', 'Panelde Exceli DEĞİŞTİR moduyla tekrar yükle → tüm satırlar ayrı kayıt olur,'],
  ['', 'kayıt sayısı ' + rows.length + ' olmalı. Panelde "Toplam Kayıt" kutusundan kontrol et.'],
];
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet(ozet), 'Ozet');

const lostHead = ['MÜŞTERİ', 'BÖLÜM', 'KATEGORI', 'SEVKİYAT TİPİ', 'ADET', 'TARİH', 'PARSİYEL m3', 'TOPLAM YÜKLENEN m³', 'DURUM'];
const lostBody = lost.map((r) => [r.musteri, r.bolum, r.kategori, r.tip, r.adet, r.tarihStr, r.parsiyelM3 || '', r.toplamM3 || '', 'KAYIP']);
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([lostHead].concat(lostBody)), 'KayipSatirlar');

const comboHead = ['MÜŞTERİ', 'BÖLÜM', 'SEVKİYAT TİPİ', 'TARİH', 'ADET', 'SATIR SAYISI', 'KAYIP SAYISI', 'ÖRNEK m³'];
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([comboHead].concat(comboRows)), 'Kombinasyonlar');

const ayHead = ['AY', 'BEKLENEN YÜKLEME (satır)', 'ARAÇ (adet)', 'm³'];
const ayBody = Array.from(byMonth.keys()).sort().map((ym) => {
  const o = byMonth.get(ym)!;
  return [ym, o.satir, o.adet, Math.round(o.m3)];
});
XLSX.utils.book_append_sheet(out, XLSX.utils.aoa_to_sheet([ayHead].concat(ayBody)), 'AylikBeklenen');

XLSX.writeFile(out, '/home/z/my-project/download/yukleme-eksik-raporu.xlsx');
console.log('Rapor yazıldı: download/yukleme-eksik-raporu.xlsx');
console.log('Kayıp satır:', lost.length, '| Kombinasyon:', comboCount);

/* Aylık kayıp dağılımı (konsol özeti) */
const lostByMonth = new Map<string, number>();
lost.forEach((r) => {
  if (!r.tarih) return;
  const ym = r.tarih.getFullYear() + '-' + String(r.tarih.getMonth() + 1).padStart(2, '0');
  lostByMonth.set(ym, (lostByMonth.get(ym) || 0) + 1);
});
console.log('Aylık kayıp:', Array.from(lostByMonth.entries()).sort().map(([a, b]) => a + ':-' + b).join(' '));
