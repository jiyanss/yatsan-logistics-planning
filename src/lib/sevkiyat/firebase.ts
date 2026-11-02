/* Firebase (Auth + Realtime Database) katmanı — eski panelin şema mantığıyla birebir uyumlu:
   - RTDB 'sevkiyat' düğümü  : sevkiyat kayıtları (deterministik anahtar, kota dostu bant genişliği modeli)
   - meta/targets            : {data: JSON} aylık hedefler
   - meta/sync               : {ver} senkron sürümü (önbellek kıyası)
   Firestore erişimi YALNIZCA tek tıkla veri taşıma (fbMigrateFirestoreToRtdb) için korunur. */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  type Auth, type User,
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocs, getDoc,
  type Firestore,
} from 'firebase/firestore';
import {
  getDatabase, ref, get, set, update, runTransaction,
  type Database,
} from 'firebase/database';
import { firebaseConfig } from './firebaseConfig';
import type { Row, DbDoc, Targets } from './types';
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
    'auth/operation-not-allowed': 'Firebase konsolunda E-posta/Şifre yöntemi etkinleştirilmemiş.',
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
    adet: r.adet || 0,
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
    adet: +(x.adet as number) || 0,
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
