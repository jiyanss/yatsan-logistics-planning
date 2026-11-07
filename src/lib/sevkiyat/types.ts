/* YATSAN İhracat Yükleme Paneli — ortak tipler */

export interface Row {
  id: string;
  musteri: string;
  bolum: string;
  kategori: string;
  tip: string;
  adet: number;
  tarih: Date | null;
  tarihStr: string; // dd.mm.yyyy
  yil: number | null;
  hafta: number;
  gun: string;
  parsiyelM3: number;
  toplamM3: number;
  m3: number;
}

/** Firestore dokümanı — eski panel ile birebir uyumlu şema */
export interface DbDoc {
  musteri?: string;
  bolum?: string;
  kategori?: string;
  tip?: string;
  adet?: number;
  tarih?: string | null; // YYYY-MM-DD
  tarih_str?: string;
  parsiyel_m3?: number;
  toplam_m3?: number;
  m3?: number;
  yil?: number | null;
  hafta?: number | null;
  gun?: string;
}

export interface MonthTarget {
  adet: number;
  m3: number;
}

export type Targets = Record<string, MonthTarget>; // anahtar: YYYY-MM

export interface FilterState {
  year: string; // 'all' | yıl
  week: string; // 'all' | 'yil|hafta'
  from: string; // YYYY-MM-DD | ''
  to: string; // YYYY-MM-DD | ''
  search: string;
  deps: string[]; // boş = tümü
  tips: string[]; // boş = tümü
}

export interface Preset {
  name: string;
  vals: { year: string; week: string; from: string; to: string };
  deps: string[];
  tips: string[];
}

export type ViewId =
  | 'overview'
  | 'genel'
  | 'aylik'
  | 'karsilastirma'
  | 'mus'
  | 'yasam'
  | 'hedef'
  | 'rapor'
  | 'yrapor'
  | 'mkart'
  | 'kullanicilar'
  | 'veri';

/** Kullanıcı yetki seviyeleri — onay sistemi */
export type Yetki =
  | 'yukleniyor'   // auth çözümleniyor
  | 'admin'        // yönetici — her şey + kullanıcı onayları
  | 'onayli'       // admin tarafından onaylanmış üye — yazma yetkisi var
  | 'bekliyor'     // kayıt tamam, admin onayı bekleniyor — hiçbir veri gösterilmez
  | 'reddedildi';  // admin tarafından reddedildi — hiçbir veri gösterilmez

export function yetkiYazar(y: Yetki): boolean {
  return y === 'admin' || y === 'onayli';
}

/** RTDB kullanicilar/{uid} kaydı */
export interface KullaniciKaydi {
  email: string;
  rol: 'admin' | 'kullanici';
  durum: 'onayli' | 'bekliyor' | 'reddedildi';
  istekTarihi: number;
  onayTarihi?: number | null;
}

export type SyncState = 'boot' | 'synced' | 'saving' | 'offline' | 'demo';

/* ---- Agregasyon çıktı tipleri ---- */

export interface GroupSum {
  adet: number;
  m3: number;
  ref?: Row;
}

export interface WeeklyAgg {
  yil: number;
  hafta: number;
  adet: number;
  m3: number;
  min: number | null;
  max: number | null;
  deps: Record<string, number>;
}

export interface MonthlyAgg {
  ym: string; // YYYY-MM
  adet: number;
  m3: number;
  deps: Record<string, number>;
}

export interface DailyAgg {
  k: string;
  adet: number;
  m3: number;
  t: number;
  d: Date | null;
  gun: string;
}

export interface CustAgg {
  name: string;
  adet: number;
  m3: number;
  loads: number;
  last: Date | null;
  deps: Record<string, number>;
  share: number;
  cum: number;
  cls: 'A' | 'B' | 'C';
}

export type LifeStatus = 'ok' | 'watch' | 'risk' | 'tek';

export interface LifeRow {
  name: string;
  adet: number;
  m3: number;
  loads: number; // yükleme (satır) sayısı — aynı gün N satır = N yükleme
  days: number; // farklı yükleme GÜNÜ sayısı — ritim analizi için
  first: Date | null;
  last: Date | null;
  deps: Record<string, number>;
  cls: 'A' | 'B' | 'C';
  avgInt: number | null;
  gap: number | null;
  status: LifeStatus;
  eff: number | null;
}

export type Segment = 'buyuyen' | 'kuculen' | 'yeni' | 'kayip' | 'stabil';

export interface GrowthRow {
  name: string;
  cls: 'A' | 'B' | 'C';
  cur: number;
  curA: number;
  pr: number;
  prA: number;
  delta: number | null;
  seg: Segment;
}

export interface FlowMonth {
  ym: string;
  yeni: number;
  kayip: number;
  aktif: number;
}

export interface AlertItem {
  lvl: 'err' | 'warn' | 'ok';
  txt: string;
  view: ViewId;
}


