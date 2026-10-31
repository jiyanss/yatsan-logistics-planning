/* Akıllı uyarı motoru — hedef temposu, düşüş, ritim riski, sessiz A-müşteriler */
import type { Row, AlertItem, Targets } from './types';
import { nf0, nf1, ymOf, ymLabel, maxDate } from './core';
import { custLifeRows } from './analytics';

export function collectAlerts(data: Row[], targets: Targets): AlertItem[] {
  if (!data.length) return [];
  const items: AlertItem[] = [];
  const refD = maxDate(data);

  if (refD) {
    // 1) Hedef temposu
    const ym = ymOf(refD);
    const t = targets[ym];
    if (t && (t.adet || t.m3)) {
      const mon = data.filter((r) => r.tarih && ymOf(r.tarih!) === ym);
      const aA = mon.reduce((s, r) => s + r.adet, 0);
      const aM = mon.reduce((s, r) => s + r.m3, 0);
      const dim = new Date(refD.getFullYear(), refD.getMonth() + 1, 0).getDate();
      const pace = refD.getDate() / dim;
      const pcts: number[] = [];
      if (t.adet) pcts.push((aA / t.adet) * 100);
      if (t.m3) pcts.push((aM / t.m3) * 100);
      const worst = Math.min(...pcts);
      const expected = pace * 100;
      let lvl: AlertItem['lvl'] = 'ok';
      let txt = '🎯 ' + ymLabel(ym) + ' hedefi: %' + nf1.format(worst) + " (ayın %" + nf0.format(expected) + "'i)";
      if (worst < expected - 20) { lvl = 'err'; txt += ' — belirgin geride!'; }
      else if (worst < expected - 10) lvl = 'warn';
      items.push({ lvl, txt, view: 'hedef' });
    }

    // 2) Son 7 gün vs önceki 3 hafta ortalaması
    const l7 = data
      .filter((r) => r.tarih && refD.getTime() - r.tarih.getTime() <= 6 * 864e5)
      .reduce((s, r) => s + r.m3, 0);
    const p21 =
      data
        .filter((r) => {
          if (!r.tarih) return false;
          const d = refD.getTime() - r.tarih.getTime();
          return d > 6 * 864e5 && d <= 27 * 864e5;
        })
        .reduce((s, r) => s + r.m3, 0) / 3;
    if (p21 > 0) {
      const ratio = (l7 / p21) * 100;
      if (ratio < 50) items.push({ lvl: 'err', txt: '📉 Son 7 gün, ortalamanın %' + nf0.format(ratio) + "'ı — belirgin düşüş", view: 'aylik' });
      else if (ratio < 70) items.push({ lvl: 'warn', txt: '📉 Son 7 gün, ortalamanın %' + nf0.format(ratio) + "'ı — izleyin", view: 'aylik' });
    }
  }

  // 3) Ritimden çıkan müşteriler
  const life = custLifeRows(data);
  const risk = life.list.filter((o) => o.status === 'risk');
  const riskAB = risk.filter((o) => o.cls === 'A' || o.cls === 'B');
  if (risk.length) {
    items.push({
      lvl: riskAB.length ? 'err' : 'warn',
      txt:
        '⏱ ' + risk.length + ' müşteri ritminden çıktı' +
        (riskAB.length ? ' (' + riskAB.length + ' A/B)' : '') + ': ' +
        risk.slice(0, 3).map((o) => o.name).join(', ') + (risk.length > 3 ? '…' : ''),
      view: 'yasam',
    });
  }

  // 4) 60+ gündür sessiz A-sınıfı müşteriler
  const lostA = life.list.filter((o) => o.cls === 'A' && o.gap != null && o.gap > 60);
  if (lostA.length) {
    items.push({
      lvl: 'err',
      txt:
        '🔴 ' + lostA.length + ' A-sınıfı müşteri 60+ gün sessiz: ' +
        lostA.slice(0, 3).map((o) => o.name).join(', ') + (lostA.length > 3 ? '…' : ''),
      view: 'yasam',
    });
  }

  return items;
}
