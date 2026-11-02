/* Yükleme sayımı düzeltmesi — mantık testi (bun scripts/test-yukleme-sayimi.ts) */
import * as XLSX from 'xlsx';
import { autoParse } from '../src/lib/sevkiyat/excel';
import { custAgg, custLifeRows } from '../src/lib/sevkiyat/analytics';
import { fromDbDoc } from '../src/lib/sevkiyat/firebase';

function wbFromAoa(aoa: unknown[][]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'Sevkiyat');
  return wb;
}

let fail = 0;
function check(name: string, got: unknown, want: unknown) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log((ok ? '✓' : '✗') + ' ' + name + ' → ' + JSON.stringify(got) + (ok ? '' : '  (beklenen: ' + JSON.stringify(want) + ')'));
}

/* S1 — kullanıcının durumu: ADET kolonu YOK, aynı gün+müşteri+tip 4 satır + başka bir gün 1 satır */
const aoa1 = [
  ['MÜŞTERİ', 'SEVKİYAT TİPİ', 'TARİH', 'TOPLAM YÜKLENEN m³'],
  ['ABC TEKSTİL A.Ş.', '40 HC', '05.01.2026', 30],
  ['ABC TEKSTİL A.Ş.', '40 HC', '05.01.2026', 25],
  ['ABC TEKSTİL A.Ş.', '40 HC', '05.01.2026', 20],
  ['ABC TEKSTİL A.Ş.', '40 HC', '05.01.2026', 15],
  ['ABC TEKSTİL A.Ş.', '40 HC', '20.01.2026', 28],
];
const p1 = autoParse(wbFromAoa(aoa1));
check('S1 okunan satır', p1.rows.length, 5);
check('S1 ADET yok → her satır 1', p1.rows.map((r) => r.adet), [1, 1, 1, 1, 1]);
const c1 = custAgg(p1.rows);
check('S1 Araç toplamı (pivot satır sayısı)', c1[0]?.adet, 5);
check('S1 Yükleme (satır)', c1[0]?.loads, 5);
const l1 = custLifeRows(p1.rows);
check('S1 yaşam: yükleme', l1.list[0]?.loads, 5);
check('S1 yaşam: farklı gün', l1.list[0]?.days, 2);
check('S1 yaşam: ort. aralık (gün bazlı ~15)', l1.list[0]?.avgInt, 15);
check('S1 yaşam: durum ritimde', l1.list[0]?.status, 'ok');

/* S2 — ADET kolonu DOLU: değerler aynen korunur (3+1=4 araç, 2 yükleme) */
const aoa2 = [
  ['MÜŞTERİ', 'SEVKİYAT TİPİ', 'ADET', 'TARİH'],
  ['XYZ GIDA', 'KOMPLE TIR', 3, '05.01.2026'],
  ['XYZ GIDA', 'PARSİYEL TIR', 1, '05.01.2026'],
];
const p2 = autoParse(wbFromAoa(aoa2));
check('S2 ADET değerleri aynen', p2.rows.map((r) => r.adet), [3, 1]);
check('S2 Araç toplamı', custAgg(p2.rows)[0]?.adet, 4);
check('S2 Yükleme (satır)', custAgg(p2.rows)[0]?.loads, 2);

/* S3 — ADET kolonu var ama hücreler boş → 1 fallback */
const aoa3 = [
  ['MÜŞTERİ', 'SEVKİYAT TİPİ', 'ADET', 'TARİH'],
  ['XYZ GIDA', '40 HC', '', '05.01.2026'],
  ['XYZ GIDA', '40 HC', '', '05.01.2026'],
];
const p3 = autoParse(wbFromAoa(aoa3));
check('S3 boş ADET → 1', p3.rows.map((r) => r.adet), [1, 1]);

/* S4 — RTDB'de eski adet=0 kalmış kayıt → 1 olarak okunur */
const docRow = fromDbDoc({ musteri: 'ABC TEKSTİL A.Ş.', tip: '40 HC', adet: 0, tarih: '2026-01-05', m3: 30 }, 'x');
check('S4 eski kayıt adet 0 → 1', docRow.adet, 1);

/* S5 — yalnızca aynı gün 4 satır: yükleme=4, gün=1 → ritim dışı ('tek') */
const aoa5 = [
  ['MÜŞTERİ', 'SEVKİYAT TİPİ', 'TARİH'],
  ['TEK GÜN LTD', '40 HC', '05.01.2026'],
  ['TEK GÜN LTD', '40 HC', '05.01.2026'],
  ['TEK GÜN LTD', '40 HC', '05.01.2026'],
  ['TEK GÜN LTD', '40 HC', '05.01.2026'],
];
const p5 = autoParse(wbFromAoa(aoa5));
const l5 = custLifeRows(p5.rows);
check('S5 yükleme=4', l5.list[0]?.loads, 4);
check('S5 gün=1', l5.list[0]?.days, 1);
check('S5 durum tek (ritim yok)', l5.list[0]?.status, 'tek');

console.log(fail ? '\n' + fail + ' TEST BAŞARISIZ' : '\nTüm testler geçti ✔');
process.exit(fail ? 1 : 0);
