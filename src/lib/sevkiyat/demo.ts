/* Demo veri üreteci — önizleme modu için gerçekçi 24 aylık ihracat sevkiyat seti.
   Deterministik RNG kullanır (her açılışta aynı veri). */
import type { Row, Targets } from './types';
import { hydrate } from './dates';
import { reassignIds } from './id';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface CustSpec {
  name: string;
  bolum: string[];
  base: number; // ayda ortalama araç
  season: number; // mevsimsellik gücü
  phase: number;
  stopAfterMonth?: number; // bu aydan sonra kesilir (kayıp müşteri)
  startMonth?: number; // bu aydan itibaren (yeni müşteri)
  parsiyel?: number; // parsiyel olasılığı
}

const SPECS: CustSpec[] = [
  { name: 'SATO SA', bolum: ['EXPORT-3'], base: 8, season: 0.35, phase: 0 },
  { name: 'SLAAPADVIES BV', bolum: ['EXPORT-2'], base: 7, season: 0.3, phase: 1.1 },
  { name: 'AEROFOX ADVANCED SLEEPING', bolum: ['EXPORT-2'], base: 5, season: 0.4, phase: 2.2 },
  { name: 'GOOSSENS', bolum: ['EXPORT-2'], base: 4.5, season: 0.3, phase: 3.0 },
  { name: 'GER EHF', bolum: ['EXPORT-2'], base: 4, season: 0.25, phase: 4.1 },
  { name: 'LUXURY BEDDING COMPANY', bolum: ['EXPORT-3', 'EXPORT-1'], base: 3.6, season: 0.35, phase: 5.0 },
  { name: 'THE BED SHOP LTD', bolum: ['EXPORT-1'], base: 3.2, season: 0.3, phase: 0.7 },
  { name: 'SEALY ISRAEL', bolum: ['EXPORT-2'], base: 2.8, season: 0.4, phase: 1.8, stopAfterMonth: 20 },
  { name: 'HAPPY DREAMS', bolum: ['EXPORT-2'], base: 2.4, season: 0.35, phase: 2.6, parsiyel: 0.3 },
  { name: 'HGC', bolum: ['EXPORT-1'], base: 2.2, season: 0.3, phase: 3.4 },
  { name: 'HARVEY NORMAN TRADING', bolum: ['EXPORT-1'], base: 1.9, season: 0.3, phase: 4.6, stopAfterMonth: 14 },
  { name: 'S AND A LTD', bolum: ['EXPORT-1'], base: 1.7, season: 0.35, phase: 5.4, parsiyel: 0.55 },
  { name: 'FRANSA DIŞ TİC', bolum: ['EXPORT-1'], base: 1.5, season: 0.4, phase: 0.4 },
  { name: 'NORDIC SLEEP AB', bolum: ['EXPORT-3'], base: 1.6, season: 0.3, phase: 1.5, startMonth: 10 },
  { name: 'CASA SUEÑO SL', bolum: ['EXPORT-2'], base: 1.4, season: 0.3, phase: 2.9, startMonth: 16 },
  { name: 'MEDITERRANEO CASA', bolum: ['EXPORT-1', 'EXPORT-3'], base: 1.2, season: 0.35, phase: 3.7, startMonth: 19 },
];

const TIPS = ['40 HC', 'KOMPLE TIR', 'PARSİYEL TIR'];
const KATEGORI = ['PLANLI', 'PLANLI', 'PLANLI', 'ACİL'];

export function buildDemoData(): Row[] {
  const rnd = mulberry32(20261031);
  const rows: Row[] = [];
  const today = new Date();
  // 24 ay geriye doğru: 23 ay önce .. bu ay
  for (let mi = 23; mi >= 0; mi--) {
    const monthDate = new Date(today.getFullYear(), today.getMonth() - mi, 1);
    const y = monthDate.getFullYear();
    const mo = monthDate.getMonth();
    const daysInMonth = new Date(y, mo + 1, 0).getDate();
    SPECS.forEach((c) => {
      if (c.startMonth != null && mi < c.startMonth) return; // henüz müşteri değil
      if (c.stopAfterMonth != null && mi < c.stopAfterMonth) return; // müşteri kayboldu
      const seasonal = 1 + c.season * Math.sin((23 - mi + c.phase) / 3.2);
      const noise = 0.6 + rnd() * 0.9;
      let count = Math.round(c.base * seasonal * noise);
      if (mi === 0) count = Math.max(0, Math.round(count * (today.getDate() / daysInMonth))); // bu ay kısmi
      for (let v = 0; v < count; v++) {
        const day = 1 + Math.floor(rnd() * daysInMonth);
        const d = new Date(y, mo, day);
        if (d.getTime() > today.getTime()) continue;
        const isParsiyel = c.parsiyel != null && rnd() < c.parsiyel;
        const tip = isParsiyel ? TIPS[2] : rnd() < 0.68 ? TIPS[0] : TIPS[1];
        const m3 = isParsiyel ? Math.round((20 + rnd() * 40) * 10) / 10 : tip === '40 HC' ? 70 : 90;
        const bolum = c.bolum[Math.floor(rnd() * c.bolum.length)];
        rows.push(
          hydrate({
            id: '',
            musteri: c.name,
            bolum,
            kategori: KATEGORI[Math.floor(rnd() * KATEGORI.length)],
            tip,
            adet: 1,
            tarih: d,
            parsiyelM3: isParsiyel ? m3 : 0,
            toplamM3: m3,
            m3,
          })
        );
      }
    });
  }
  // Tarihsiz birkaç kayıt (teşhis/uyarı gösterimi için)
  for (let i = 0; i < 3; i++) {
    rows.push(
      hydrate({
        id: '',
        musteri: SPECS[i].name,
        bolum: SPECS[i].bolum[0],
        kategori: 'PLANLI',
        tip: '40 HC',
        adet: 1,
        tarih: null,
        parsiyelM3: 0,
        toplamM3: 70,
        m3: 70,
      })
    );
  }
  return reassignIds(rows);
}

export function buildDemoTargets(): Targets {
  const t: Targets = {};
  const today = new Date();
  for (let i = 3; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const ym = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    t[ym] = { adet: 120 + i * 10, m3: 9500 + i * 600 };
  }
  return t;
}
