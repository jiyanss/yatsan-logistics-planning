/* Firebase (Auth + Realtime Database) katmanı — eski panelin şema mantığıyla birebir uyumlu:
   - RTDB 'sevkiyat' düğümü  : sevkiyat kayıtları (deterministik anahtar, kota dostu bant genişliği modeli)
   - meta/targets            : {data: JSON} aylık hedefler
   - meta/sync               : {ver} senkron sürümü (önbellek kıyası)
   Firestore erişimi YALNIZCA tek tıkla veri taşıma (fbMigrateFirestoreToRtdb) için korunur. */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInAnonymously, signOut, onAuthStateChanged, updateProfile,
  type Auth, type User,
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocs, getDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  getDatabase, ref, get, set, update, runTransaction, onValue,
  type Database,
} from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';
import type { Row, DbDoc, Targets, KullaniciKaydi } from './types';
import { isoDay } from './core';
import { hydrate } from './dates';
import { safeDocId } from './id';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let rdb: Database | null = null;

/** Yalnızca tarayıcıda tembel başlatma (SSR / statik export dostu) */
export function fb(): { auth: Auth; db: Firestore } {
  if (typeof window === 'undefined') throw new Error('Firebase yalnızca tarayıcıda kullanılabilir');
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    rdb = getDatabase(app);
  }
  return { auth: auth!, db: db! };
}

function getRtdb(): Database {
  fb();
  return rdb!;
}

/* ---------- Auth ---------- */

export function watchAuth(cb: (u: User | null) => void): () => void {
  const { auth } = fb();
  return onAuthStateChanged(auth, cb);
}

export async function fbSignIn(email: string, password: string): Promise<User> {
  const { auth } = fb();
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function fbSignUp(email: string, password: string, name?: string): Promise<User> {
  const { auth } = fb();
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name) await updateProfile(cred.user, { displayName: name });
  return cred.user;
}

/** Misafir girişi — anonim oturum; RTDB kurallarında yazma hakkı yoktur (salt okunur) */
export async function fbGuestSignIn(): Promise<User> {
  const { auth } = fb();
  const cred = await signInAnonymously(auth);
  return cred.user;
}

export async function fbSignOut(): Promise<void> {
  const { auth } = fb();
  await signOut(auth);
}

/** Auth hata kodlarını Türkçe'ye çevirir */
export function authErrorTr(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email': 'Geçersiz e-posta adresi.',
    'auth/user-disabled': 'Hesap devre dışı bırakılmış.',
    'auth/user-not-found': 'Böyle bir kullanıcı yok. Önce kayıt olun.',
    'auth/wrong-password': 'Hatalı şifre.',
    'auth/invalid-credential': 'E-posta veya şifre hatalı.',
    'auth/email-already-in-use': 'Bu e-posta zaten kayıtlı. Giriş yapmayı deneyin.',
    'auth/weak-password': 'Şifre çok zayıf (en az 6 karakter).',
    'auth/too-many-requests': 'Çok fazla deneme. Bir süre sonra tekrar deneyin.',
    'auth/operation-not-allowed': 'Bu oturum yöntemi Firebase konsolunda etkin değil (E-posta/Şifre veya Anonim).',
    'auth/admin-restricted-operation': 'Firebase konsolunda "Anonim" oturum yöntemi etkinleştirilmemiş. Konsol → Authentication → Sign-in method → Anonim\u2019i etkinleştirin.',
    'auth/network-request-failed': 'Ağ hatası: Firebase\u2019e ulaşılamıyor.',
    'auth/configuration-not-found': 'Firebase projesinde kimlik doğrulama yapılandırılmamış.',
  };
  return map[code] || 'Giriş başarısız: ' + code;
}

/* ---------- Realtime Database: sevkiyat düğümü ---------- */

/** RTDB anahtar kuralları: . $ # [ ] / yasak — URL-encode ile çakışmasız & geri dönüşümlü yap */
export function rtdbKey(id: string): string {
  return encodeURIComponent(safeDocId(id)).replace(/\./g, '%2E');
}

export function toDbDoc(r: Row): DbDoc {
  return {
    musteri: r.musteri,
    bolum: r.bolum,
    kategori: r.kategori || '',
    tip: r.tip,
    // ADET boşsa 1: her satır 1 araç/yükleme (pivot satır sayısı)
    adet: r.adet || 1,
    tarih: r.tarih ? isoDay(r.tarih) : null,
    tarih_str: r.tarihStr || '',
    parsiyel_m3: r.parsiyelM3 || 0,
    toplam_m3: r.toplamM3 || 0,
    m3: r.m3 || 0,
    yil: r.yil || null,
    hafta: r.hafta || null,
    gun: r.gun || '',
  };
}

export function fromDbDoc(x: Record<string, unknown>, id: string): Row {
  return hydrate({
    id,
    musteri: String(x.musteri || ''),
    bolum: String(x.bolum || ''),
    kategori: String(x.kategori || ''),
    tip: String(x.tip || 'Bilinmiyor'),
    // Eski kayıtlarda ADET=0 kalmışsa 1 olarak oku (her satır = 1 yükleme)
    adet: +(x.adet as number) || 1,
    tarih: (x.tarih as string | null) || null,
    parsiyelM3: +(x.parsiyel_m3 as number) || 0,
    toplamM3: +(x.toplam_m3 as number) || 0,
    m3: +(x.m3 as number) || 0,
  });
}

export async function fbLoadRows(): Promise<Row[]> {
  const snap = await get(ref(getRtdb(), 'sevkiyat'));
  if (!snap.exists()) return [];
  const val = snap.val() as Record<string, Record<string, unknown>>;
  return Object.keys(val).map((k) => {
    const v = val[k] || {};
    return fromDbDoc(v, String(v.id || decodeURIComponent(k)));
  });
}

export async function fbUpsert(rows: Row[]): Promise<void> {
  const rdb = getRtdb();
  for (let i = 0; i < rows.length; i += 1500) {
    const payload: Record<string, DbDoc & { id: string }> = {};
    rows.slice(i, i + 1500).forEach((r) => {
      payload[rtdbKey(r.id)] = { ...toDbDoc(r), id: r.id };
    });
    await update(ref(rdb, 'sevkiyat'), payload);
  }
}

export async function fbDeleteIds(ids: string[]): Promise<void> {
  const rdb = getRtdb();
  for (let i = 0; i < ids.length; i += 1500) {
    const payload: Record<string, null> = {};
    ids.slice(i, i + 1500).forEach((id) => {
      payload[rtdbKey(id)] = null;
    });
    await update(ref(rdb, 'sevkiyat'), payload);
  }
}

export async function fbDeleteAll(): Promise<void> {
  await set(ref(getRtdb(), 'sevkiyat'), null);
}

/* ---------- Hedefler ---------- */

export async function fbSaveTargets(targets: Targets): Promise<void> {
  await set(ref(getRtdb(), 'meta/targets'), { data: JSON.stringify(targets) });
}

export async function fbLoadTargets(): Promise<Targets> {
  const snap = await get(ref(getRtdb(), 'meta/targets'));
  if (snap.exists()) {
    try {
      return (JSON.parse(snap.val().data) as Targets) || {};
    } catch {
      /* bozuk veri — boş dön */
    }
  }
  return {};
}

/* ---------- Senkron sürümü ---------- */

export async function fbGetSyncVer(): Promise<number> {
  const snap = await get(ref(getRtdb(), 'meta/sync/ver'));
  return snap.exists() ? +snap.val() || 0 : 0;
}

export async function fbBumpVer(): Promise<void> {
  await runTransaction(ref(getRtdb(), 'meta/sync'), (cur) => ({
    ver: ((cur as { ver?: number } | null)?.ver || 0) + 1,
  }));
}

/* ---------- Tek tıkla taşıma: Firestore → Realtime Database ---------- */

export interface MigrationResult {
  rows: number;
  targets: boolean;
  ver: number;
}

/** Kaynak Firestore'a DOKUNMAZ; tüm kayıtlar + hedefler RTDB'ye kopyalanır ve sürüm yükseltilir. */
export async function fbMigrateFirestoreToRtdb(): Promise<MigrationResult> {
  const { db } = fb();

  const fsSnap = await getDocs(collection(db, 'sevkiyat'));
  const rows = fsSnap.docs.map((d) => fromDbDoc(d.data(), d.id));
  await fbUpsert(rows);

  let targets = false;
  const tSnap = await getDoc(doc(db, 'meta', 'targets'));
  if (tSnap.exists()) {
    await set(ref(getRtdb(), 'meta/targets'), tSnap.data());
    targets = true;
  }

  const sSnap = await getDoc(doc(db, 'meta', 'sync'));
  const oldVer = sSnap.exists() ? +(sSnap.data().ver as number) || 0 : 0;
  const ver = oldVer + 1;
  await set(ref(getRtdb(), 'meta/sync'), { ver });

  const check = await get(ref(getRtdb(), 'sevkiyat'));
  const count = check.exists() ? Object.keys(check.val()).length : 0;
  return { rows: count, targets, ver };
}

/* ---------- Kullanıcı onay sistemi ----------
   - kurulum/admin : ilk hak sahibi (güncelleme öncesi kayıtlı) hesap uid'sini alır; sonradan değiştirilemez
   - kullanicilar/{uid} : { email, rol, durum, istekTarihi, onayTarihi }
   - Yazma yetkisi: rol admin VEYA durum onaylı. Bekleyen/reddedilen hesaplar salt okunurdur. */

/** Bu tarihten ÖNCE kayıtlı hesaplar ilk girişlerinde yönetici hakkını alır (bir kez, kalıcı) */
export const ADMIN_HAK_KESIN_TARIH = '2026-11-02T00:00:00Z';

/** Yönetici hakkını al — kurulum/admin boşsa uid yazılır (ilk gelen kazanır) */
export async function fbClaimAdmin(uid: string): Promise<boolean> {
  const res = await runTransaction(ref(getRtdb(), 'kurulum/admin'), (cur) =>
    cur == null ? uid : undefined
  );
  return res.committed;
}

/** Oturum açan kullanıcı için kayıt/yönetici kurulumu. Sonucu (kayıt) döner. */
export async function fbEnsureKullanici(u: User): Promise<KullaniciKaydi> {
  const rdb = getRtdb();

  // 1) Güncelleme öncesi kayıtlı hesap + hak henüz alınmamış → yönetici hakkını al
  const created = u.metadata?.creationTime ? Date.parse(u.metadata.creationTime) : 0;
  const hakSahibi = created > 0 && created < Date.parse(ADMIN_HAK_KESIN_TARIH);
  if (hakSahibi) {
    try { await fbClaimAdmin(u.uid); } catch { /* alınamadı — normal üye olur */ }
  }
  const claimSnap = await get(ref(rdb, 'kurulum/admin')).catch(() => null);
  const adminMi = !!claimSnap && claimSnap.exists() && String(claimSnap.val()) === u.uid;

  // 2) Kayıt yoksa oluştur (admin: onaylı · normal üye: onay bekliyor)
  const refU = ref(rdb, 'kullanicilar/' + u.uid);
  const snap = await get(refU).catch(() => null);
  if (snap && snap.exists()) {
    const k = snap.val() as KullaniciKaydi;
    // kurulum/admin bu kullanıcıysa ama kayıt henüz admin değilse yükselt
    if (adminMi && (k.rol !== 'admin' || k.durum !== 'onayli')) {
      await set(refU, { ...k, rol: 'admin', durum: 'onayli', onayTarihi: k.onayTarihi || Date.now() });
      return { ...k, rol: 'admin', durum: 'onayli', onayTarihi: k.onayTarihi || Date.now() };
    }
    return k;
  }
  const yeni: KullaniciKaydi = {
    email: u.email || '',
    rol: adminMi ? 'admin' : 'kullanici',
    durum: adminMi ? 'onayli' : 'bekliyor',
    istekTarihi: Date.now(),
    onayTarihi: adminMi ? Date.now() : null,
  };
  await set(refU, yeni);
  return yeni;
}

/** Kullanıcının kendi kaydını canlı dinle (onay gelince anında yetki güncellenir) */
export function fbWatchKullanici(uid: string, cb: (k: KullaniciKaydi | null) => void): () => void {
  const r = ref(getRtdb(), 'kullanicilar/' + uid);
  return onValue(r, (snap) => cb(snap.exists() ? (snap.val() as KullaniciKaydi) : null), () => cb(null));
}

export interface KullaniciSatiri { uid: string; k: KullaniciKaydi }

/** Tüm kullanıcıları canlı dinle (yalnızca yönetici kurallarda okuma yapabilir) */
export function fbWatchKullanicilar(cb: (list: KullaniciSatiri[]) => void): () => void {
  const r = ref(getRtdb(), 'kullanicilar');
  return onValue(
    r,
    (snap) => {
      const val = snap.val() as Record<string, KullaniciKaydi> | null;
      const list: KullaniciSatiri[] = val
        ? Object.keys(val).map((uid) => ({ uid, k: val[uid] || ({ email: '', rol: 'kullanici', durum: 'bekliyor', istekTarihi: 0 } as KullaniciKaydi) }))
        : [];
      cb(list);
    },
    () => cb([])
  );
}

/** Yönetici onayı: durum güncelle (onayli | bekliyor | reddedildi) */
export async function fbSetDurum(uid: string, durum: KullaniciKaydi['durum']): Promise<void> {
  const patch: Partial<KullaniciKaydi> = { durum, onayTarihi: durum === 'onayli' ? Date.now() : null };
  await update(ref(getRtdb(), 'kullanicilar/' + uid), patch);
}

/* ---------- Retry ---------- */

export function withRetry<T>(fn: () => Promise<T>, tries = 2): Promise<T> {
  function attempt(i: number): Promise<T> {
    return fn().catch((e) => {
      if (i < tries) {
        return new Promise<void>((r) => setTimeout(r, 800 * (i + 1))).then(() => attempt(i + 1));
      }
      throw e;
    });
  }
  return attempt(0);
}
