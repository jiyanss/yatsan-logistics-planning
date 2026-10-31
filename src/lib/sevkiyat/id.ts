/* Deterministik kimlik + metin kanonikleştirme (eski panel ile aynı anahtarlar) */
import type { Row } from './types';
import { norm, cleanText, canonicalKey } from './core';

/** Birleştirme tabanı anahtarı: müşteri|bölüm|tip|tarih|adet */
export function bkBase(r: Row): string {
  return [norm(r.musteri), norm(r.bolum), norm(r.tip), r.tarihStr || '', r.adet || 0].join('|');
}

/** İçerik imzası — m3 alanları dahil (değişiklik tespiti) */
export function contentSig(r: Row): string {
  return [bkBase(r), r.kategori || '', r.parsiyelM3 || 0, r.toplamM3 || 0, r.m3 || 0].join('¦');
}

/** Aynı taban anahtarına sahip satırlara sıralı #idx ekleri atar */
export function reassignIds(rows: Row[]): Row[] {
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = bkBase(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  });
  groups.forEach((idxs, k) => {
    if (idxs.length > 1) {
      idxs.sort((a, b) => {
        const A = rows[a], B = rows[b];
        return (A.m3 || 0) - (B.m3 || 0) || (A.parsiyelM3 || 0) - (B.parsiyelM3 || 0) || (A.toplamM3 || 0) - (B.toplamM3 || 0);
      });
    }
    idxs.forEach((ri, j) => { rows[ri].id = k + '#' + j; });
  });
  return rows;
}

export function safeDocId(id: string): string {
  return String(id).replace(/\//g, '__');
}

interface CanonicalTarget {
  musteri: string;
  bolum: string;
  kategori: string;
  tip: string;
}

/** Yazım varyantlarını en sık kullanılan biçime indirger (müşteri/bölüm/kategori/tip) */
export function canonicalizeRows(rows: CanonicalTarget[]): void {
  const fields: (keyof CanonicalTarget)[] = ['musteri', 'bolum', 'kategori', 'tip'];
  fields.forEach((f) => {
    const groups = new Map<string, Map<string, number>>();
    rows.forEach((r) => {
      const raw = String(r[f] == null ? '' : r[f]).trim();
      if (!raw) return;
      const k = canonicalKey(raw);
      if (!groups.has(k)) groups.set(k, new Map());
      const m = groups.get(k)!;
      m.set(raw, (m.get(raw) || 0) + 1);
    });
    groups.forEach((variants, k) => {
      if (variants.size <= 1) return;
      let best: string | null = null;
      let bestScore = -1;
      variants.forEach((n, v) => {
        const isUpper = v === v.toLocaleUpperCase('tr-TR');
        const score = n + (isUpper ? 0.5 : 0);
        if (score > bestScore) { bestScore = score; best = v; }
      });
      rows.forEach((r) => {
        if (canonicalKey(String(r[f] == null ? '' : r[f])) === k && best) r[f] = best;
      });
    });
  });
}

/** Tüm verideki kanonik isimleri uygula (import öncesi çağrılır) */
export function canonicalizeAll(data: Row[], incoming: Row[]): void {
  canonicalizeRows(data);
  canonicalizeRows(incoming);
}

export { cleanText };
