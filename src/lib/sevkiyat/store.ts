/* Zustand store — veri, senkron, filtre, preset ve görünüm durumu */
import { create } from 'zustand';
import type { User } from 'firebase/auth';
import type { Row, Targets, FilterState, Preset, ViewId, SyncState, Yetki, KullaniciKaydi } from './types';
import { yetkiYazar } from './types';
import { idbGet, idbSet, cacheSave } from './cache';
import {
  watchAuth, fbSignIn, fbSignUp, fbSignOut, fbLoadRows, fbUpsert, fbDeleteIds, fbDeleteAll,
  fbSaveTargets, fbLoadTargets, fbGetSyncVer, fbBumpVer, withRetry,
  fbEnsureKullanici, fbWatchKullanici,
} from './firebase';
import { canonicalizeAll, reassignIds } from './id';
import { buildDemoData, buildDemoTargets } from './demo';
import type { Row as RowT } from './types';

const LS_PRESETS = 'sevkiyat_presets_v2';
const LS_CAPS = 'sevkiyat_caps';

export const DEFAULT_CAPS: Record<string, number> = { '40 HC': 68, 'KOMPLE TIR': 90 };

export const DEFAULT_FILTERS: FilterState = {
  year: 'all', week: 'all', from: '', to: '', search: '', deps: [], tips: [],
};

interface SevkiyatState {
  authReady: boolean;
  user: string | null;
  demoMode: boolean;
  yetki: Yetki;
  data: Row[];
  targets: Targets;
  syncVer: number | null;
  syncState: SyncState;
  syncError: string;
  bootDone: boolean;
  filters: FilterState;
  presets: Preset[];
  caps: Record<string, number>;
  view: ViewId;

  initAuth: () => void;
  enterDemo: () => void;
  exitDemo: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;

  bootData: () => Promise<void>;
  fullReload: () => Promise<void>;
  applyRows: (incoming: Row[], sheetLabel: string, fileName: string, merge: boolean) => Promise<boolean>;
  clearAll: () => Promise<void>;
  saveTargets: (t: Targets) => Promise<boolean>;
  importTargetsLocal: (t: Targets) => void;

  setFilters: (patch: Partial<FilterState>) => void;
  resetFilters: () => void;
  setView: (v: ViewId) => void;
  savePreset: (name: string) => boolean;
  applyPreset: (i: number) => void;
  deletePreset: (i: number) => void;
  _loadLocal: () => void;
  _kurKullanici: (u: User) => Promise<void>;
  _yetkiUnsub: (() => void) | null;
}

function loadPresets(): Preset[] {
  try {
    return JSON.parse(localStorage.getItem(LS_PRESETS) || '[]') as Preset[];
  } catch {
    return [];
  }
}

function loadCaps(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_CAPS) || 'null') || { ...DEFAULT_CAPS };
  } catch {
    return { ...DEFAULT_CAPS };
  }
}

export const useSevkiyat = create<SevkiyatState>((set, get) => ({
  authReady: false,
  user: null,
  demoMode: false,
  yetki: 'yukleniyor',
  data: [],
  targets: {},
  syncVer: null,
  syncState: 'boot',
  syncError: '',
  bootDone: false,
  filters: { ...DEFAULT_FILTERS },
  presets: [],
  caps: { ...DEFAULT_CAPS },
  view: 'overview',
  _yetkiUnsub: null,

  _loadLocal: () => set({ presets: loadPresets(), caps: loadCaps() }),

  _kurKullanici: async (u) => {
    // Kayıt/yönetici kurulumu — ağ hatasına karşı 2 tekrar
    let k: KullaniciKaydi | null = null;
    try {
      k = await withRetry(() => fbEnsureKullanici(u), 2);
    } catch { /* ağ hatası — dinleyici düzeltinceye kadar kapalı ekran */ }
    if (k) {
      const y: Yetki = k.rol === 'admin' ? 'admin' : k.durum;
      set({ yetki: y });
      // Onaylıysa veri yüklemesini ŞİMDİ başlat; bekleyen/reddedilen asla yüklemez
      if (yetkiYazar(y) && !get().bootDone) void get().bootData();
    } else {
      set({ yetki: 'bekliyor' });
    }
    // Onay gelince anında yetki + veri yükleme başlasın (ekran kendiliğinden panele döner)
    try {
      const stop = fbWatchKullanici(u.uid, (rec: KullaniciKaydi | null) => {
        if (!rec) return;
        const y: Yetki = rec.rol === 'admin' ? 'admin' : rec.durum;
        set({ yetki: y });
        if (yetkiYazar(y) && !get().bootDone) void get().bootData();
      });
      set({ _yetkiUnsub: stop });
    } catch { /* dinleyici kurulamadı — tek seferlik yetki geçerli */ }
  },

  initAuth: () => {
    get()._loadLocal();
    try {
      const un = watchAuth((u) => {
        // önceki yetki dinleyicisini kapat
        const prevUnsub = get()._yetkiUnsub;
        if (prevUnsub) { prevUnsub(); set({ _yetkiUnsub: null }); }
        if (!u) {
          // demo modundaysa yetkiyi ezme (demo 'admin' görünür kalır)
          if (!get().demoMode) set({ yetki: 'yukleniyor' });
          set({ authReady: true, user: null });
          return;
        }
        // Anonim (eski misafir) oturumlar artık desteklenmiyor — oturumu kapat
        if (u.isAnonymous) {
          void fbSignOut();
          set({ authReady: true, user: null });
          return;
        }
        set({ authReady: true, user: u.email || 'kullanıcı', yetki: 'yukleniyor' });
        void get()._kurKullanici(u);
        // NOT: veri yükleme burada başlamaz — yalnızca yetki 'admin'/'onayli' olduktan
        // sonra _kurKullanici / canlı dinleyici bootData() çağırır.
      });
      // 6 sn içinde yanıt gelmezse ekranı serbest bırak (config hatalı olabilir)
      setTimeout(() => {
        if (!get().authReady) set({ authReady: true });
      }, 6000);
      void un;
    } catch {
      set({ authReady: true });
    }
  },

  enterDemo: () => {
    const rows = buildDemoData();
    set({
      demoMode: true,
      yetki: 'admin',
      data: rows,
      targets: buildDemoTargets(),
      syncState: 'demo',
      syncError: '',
      bootDone: true,
    });
  },

  exitDemo: () => {
    set({ demoMode: false, yetki: 'yukleniyor', data: [], targets: {}, syncState: 'boot', bootDone: false });
  },

  signIn: async (email, password) => {
    const u = await fbSignIn(email, password);
    set({ user: u.email || 'kullanıcı' });
  },

  signUp: async (email, password) => {
    const u = await fbSignUp(email, password);
    set({ user: u.email || 'kullanıcı' });
  },

  signOutUser: async () => {
    try {
      await fbSignOut();
    } finally {
      const un = get()._yetkiUnsub;
      if (un) un();
      set({ user: null, demoMode: false, yetki: 'yukleniyor', data: [], targets: {}, syncState: 'boot', bootDone: false, view: 'overview', _yetkiUnsub: null });
    }
  },

  /** Kota dostu açılış: önce IndexedDB, sonra sürüm kıyasıyla Firestore */
  bootData: async () => {
    const cached = await idbGet<RowT[]>('rows').catch(() => undefined);
    if (cached && cached.length) {
      set({ data: reassignIds(cached.map((r) => hydrateCached(r))), syncState: 'saving' });
    }
    const [cacheVer, tCache] = await Promise.all([
      idbGet<number>('syncver').catch(() => undefined),
      idbGet<Targets>('targets').catch(() => undefined),
    ]);
    if (tCache && typeof tCache === 'object') set({ targets: tCache });
    try {
      set({ syncState: 'saving' });
      const targets = await fbLoadTargets();
      set({ targets });
      const remoteVer = await fbGetSyncVer();
      set({ syncVer: remoteVer });
      if (cacheVer === remoteVer && get().data.length) {
        set({ syncState: 'synced', syncError: '', bootDone: true });
        void cacheSave(get().data, get().targets);
        return;
      }
      const rows = await fbLoadRows();
      set({ data: reassignIds(rows), syncVer: remoteVer, syncState: 'synced', syncError: '', bootDone: true });
      void cacheSave(get().data, get().targets);
      void idbSet('syncver', remoteVer);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ syncState: 'offline', syncError: msg, bootDone: true });
    }
  },

  fullReload: async () => {
    set({ syncState: 'saving' });
    try {
      const targets = await fbLoadTargets();
      const rows = await fbLoadRows();
      const ver = await fbGetSyncVer();
      set({
        targets, data: reassignIds(rows), syncVer: ver,
        syncState: 'synced', syncError: '', bootDone: true,
      });
      void cacheSave(get().data, get().targets);
      void idbSet('syncver', ver);
    } catch (e) {
      set({ syncState: 'offline', syncError: e instanceof Error ? e.message : String(e) });
    }
  },

  /** Excel satırlarını birleştir/değiştir + Firebase'e delta yaz */
  applyRows: async (incoming, sheetLabel, fileName, merge) => {
    if (!yetkiYazar(get().yetki)) {
      console.warn('[Sevkiyat] Yetkisiz yazım engellendi (onay bekliyor/reddedildi)');
      return false;
    }
    console.log('[Sevkiyat] ' + fileName + ' · ' + sheetLabel + ' · ' + incoming.length + ' satır · mod: ' + (merge ? 'birleştir' : 'değiştir'));
    const cur = get().data.map((r) => ({ ...r }));
    canonicalizeAll(cur, incoming);
    const changed: Row[] = [];
    const removedIds: string[] = [];
    let newData: Row[];
    if (merge) {
      const sigIndex = new Map<string, number[]>();
      cur.forEach((r, i) => {
        const s = sig(r);
        if (!sigIndex.has(s)) sigIndex.set(s, []);
        sigIndex.get(s)!.push(i);
      });
      const counts = new Map<string, number>();
      cur.forEach((r) => {
        const k = base(r);
        counts.set(k, (counts.get(k) || 0) + 1);
      });
      let updated = 0, added = 0;
      newData = cur;
      incoming.forEach((r) => {
        const s = sig(r);
        const arr = sigIndex.get(s);
        if (arr && arr.length) {
          const i = arr.shift()!;
          newData[i] = { ...r, id: newData[i].id };
          changed.push(newData[i]);
          updated++;
        } else {
          const k = base(r);
          const idx = counts.get(k) || 0;
          counts.set(k, idx + 1);
          const rec = { ...r, id: k + '#' + idx };
          sigIndex.set(s, [newData.length]);
          newData.push(rec);
          changed.push(rec);
          added++;
        }
      });
      console.log('[Sevkiyat] Birleştirme: ' + updated + ' güncellendi, ' + added + ' eklendi');
    } else {
      newData = reassignIds(incoming.map((r) => ({ ...r })));
      changed.push(...newData);
      const newIds = newData.map((r) => r.id.replace(/\//g, '__'));
      cur.forEach((r) => {
        const oid = r.id.replace(/\//g, '__');
        if (newIds.indexOf(oid) < 0) removedIds.push(r.id);
      });
    }
    set({ data: newData, syncState: 'saving' });
    void cacheSave(newData, get().targets);
    if (get().demoMode) {
      set({ syncState: 'demo' });
      return true;
    }
    try {
      await withRetry(() => fbUpsert(changed));
      if (removedIds.length) {
        await withRetry(() => fbDeleteIds(removedIds.map((id) => id.replace(/\//g, '__'))));
      }
      await withRetry(() => fbBumpVer());
      const ver = await fbGetSyncVer();
      set({ syncVer: ver, syncState: 'synced', syncError: '' });
      void idbSet('syncver', ver);
      return true;
    } catch (e) {
      set({ syncState: 'offline', syncError: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  clearAll: async () => {
    if (!yetkiYazar(get().yetki)) return;
    set({ data: [], syncState: 'saving' });
    void cacheSave([], get().targets);
    if (get().demoMode) {
      set({ syncState: 'demo' });
      return;
    }
    try {
      await withRetry(() => fbDeleteAll());
      await withRetry(() => fbBumpVer());
      const ver = await fbGetSyncVer();
      set({ syncVer: ver, syncState: 'synced', syncError: '' });
      await idbSet('syncver', ver);
      await idbSet('rows', []);
    } catch (e) {
      set({ syncState: 'offline', syncError: e instanceof Error ? e.message : String(e) });
    }
  },

  saveTargets: async (t) => {
    if (!yetkiYazar(get().yetki)) return false;
    set({ targets: t });
    void cacheSave(get().data, t);
    if (get().demoMode) return true;
    try {
      await withRetry(() => fbSaveTargets(t));
      return true;
    } catch (e) {
      set({ syncState: 'offline', syncError: e instanceof Error ? e.message : String(e) });
      return false;
    }
  },

  importTargetsLocal: (t) => {
    if (!yetkiYazar(get().yetki)) return;
    set({ targets: t });
    void cacheSave(get().data, t);
  },

  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setView: (v) => set({ view: v }),

  savePreset: (name) => {
    if (!name.trim()) return false;
    const f = get().filters;
    const p: Preset = {
      name: name.trim(),
      vals: { year: f.year, week: f.week, from: f.from, to: f.to },
      deps: [...f.deps],
      tips: [...f.tips],
    };
    const presets = [...get().presets, p];
    set({ presets });
    try {
      localStorage.setItem(LS_PRESETS, JSON.stringify(presets));
    } catch { /* yoksay */ }
    return true;
  },

  applyPreset: (i) => {
    const p = get().presets[i];
    if (!p) return;
    set({
      filters: {
        year: p.vals.year || 'all',
        week: p.vals.week || 'all',
        from: p.vals.from || '',
        to: p.vals.to || '',
        search: '',
        deps: [...(p.deps || [])],
        tips: [...(p.tips || [])],
      },
    });
  },

  deletePreset: (i) => {
    const presets = get().presets.slice();
    presets.splice(i, 1);
    set({ presets });
    try {
      localStorage.setItem(LS_PRESETS, JSON.stringify(presets));
    } catch { /* yoksay */ }
  },
}));

/* --- yardımcılar --- */
function sig(r: RowT): string {
  return [base(r), r.kategori || '', r.parsiyelM3 || 0, r.toplamM3 || 0, r.m3 || 0].join('¦');
}
function base(r: RowT): string {
  return [normTxt(r.musteri), normTxt(r.bolum), normTxt(r.tip), r.tarihStr || '', r.adet || 0].join('|');
}
function normTxt(s: string): string {
  return String(s == null ? '' : s)
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/Ş/g, 's').replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u').replace(/Ö/g, 'o').replace(/Ç/g, 'c')
    .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ö/g, 'o').replace(/ç/g, 'c')
    .toLowerCase().replace(/³/g, '3').replace(/²/g, '2').replace(/[^a-z0-9]/g, '');
}
function hydrateCached(r: RowT): RowT {
  // IndexedDB'den gelen Date'ler string'e dönüşmüş olabilir;
  // eski kayıtlarda ADET=0 kalmışsa 1 olarak normalize et (her satır = 1 yükleme)
  const out = { ...r, adet: r.adet || 1 };
  if (out.tarih && typeof out.tarih === 'string') {
    out.tarih = new Date(out.tarih) as RowT['tarih'];
  }
  return out;
}

/* Filtre uygulama (saf fonksiyon) */
export function applyFilters(data: Row[], f: FilterState): Row[] {
  const q = f.search.trim().toLocaleLowerCase('tr-TR');
  const fromD = f.from ? new Date(f.from + 'T00:00:00') : null;
  const toD = f.to ? new Date(f.to + 'T23:59:59') : null;
  return data.filter((r) => {
    if (f.year !== 'all' && String(r.yil) !== f.year) return false;
    if (f.week !== 'all' && r.yil + '|' + r.hafta !== f.week) return false;
    if (f.deps.length && !f.deps.includes(r.bolum)) return false;
    if (f.tips.length && !f.tips.includes(r.tip)) return false;
    if (fromD && (!r.tarih || r.tarih < fromD)) return false;
    if (toD && (!r.tarih || r.tarih > toD)) return false;
    if (q && String(r.musteri).toLocaleLowerCase('tr-TR').indexOf(q) < 0) return false;
    return true;
  });
}
