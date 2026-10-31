/* Firebase (Auth + Firestore) katmanı — eski panelin koleksiyon şemasıyla birebir uyumlu:
   - koleksiyon 'sevkiyat'  : sevkiyat kayıtları (deterministik doküman ID)
   - meta/targets           : {data: JSON} aylık hedefler
   - meta/sync              : {ver: increment} senkron sürümü (önbellek kıyası) */
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  type Auth, type User,
} from 'firebase/auth';
import {
  getFirestore, collection, doc, getDocs, getDoc, writeBatch, setDoc, deleteDoc, increment,
  type Firestore,
} from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';
import type { Row, DbDoc, Targets } from './types';
import { isoDay } from './core';
import { hydrate } from './dates';
import { safeDocId } from './id';

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;

/** Yalnızca tarayıcıda tembel başlatma (SSR / statik export dostu) */
export function fb(): { auth: Auth; db: Firestore } {
  if (typeof window === 'undefined') throw new Error('Firebase yalnızca tarayıcıda kullanılabilir');
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { auth: auth!, db: db! };
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

/* ---------- Firestore: sevkiyat koleksiyonu ---------- */

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
  const { db } = fb();
  const snap = await getDocs(collection(db, 'sevkiyat'));
  return snap.docs.map((d) => fromDbDoc(d.data(), d.id));
}

export async function fbUpsert(rows: Row[]): Promise<void> {
  const { db } = fb();
  let i = 0;
  async function next(): Promise<void> {
    if (i >= rows.length) return;
    const batch = writeBatch(db);
    rows.slice(i, i + 450).forEach((r) => {
      batch.set(doc(db, 'sevkiyat', safeDocId(r.id)), toDbDoc(r));
    });
    i += 450;
    await batch.commit();
    await next();
  }
  await next();
}

export async function fbDeleteIds(ids: string[]): Promise<void> {
  const { db } = fb();
  let i = 0;
  async function next(): Promise<void> {
    if (i >= ids.length) return;
    const batch = writeBatch(db);
    ids.slice(i, i + 450).forEach((id) => {
      batch.delete(doc(db, 'sevkiyat', safeDocId(id)));
    });
    i += 450;
    await batch.commit();
    await next();
  }
  await next();
}

export async function fbDeleteAll(): Promise<void> {
  const { db } = fb();
  const snap = await getDocs(collection(db, 'sevkiyat'));
  await fbDeleteIds(snap.docs.map((d) => d.id));
}

/* ---------- Hedefler ---------- */

export async function fbSaveTargets(targets: Targets): Promise<void> {
  const { db } = fb();
  await setDoc(doc(db, 'meta', 'targets'), { data: JSON.stringify(targets) });
}

export async function fbLoadTargets(): Promise<Targets> {
  const { db } = fb();
  const d = await getDoc(doc(db, 'meta', 'targets'));
  if (d.exists()) {
    try {
      return (JSON.parse(d.data().data) as Targets) || {};
    } catch {
      /* bozuk veri — boş dön */
    }
  }
  return {};
}

/* ---------- Senkron sürümü ---------- */

export async function fbGetSyncVer(): Promise<number> {
  const { db } = fb();
  const d = await getDoc(doc(db, 'meta', 'sync'));
  return d.exists() ? +(d.data().ver as number) || 0 : 0;
}

export async function fbBumpVer(): Promise<void> {
  const { db } = fb();
  await setDoc(doc(db, 'meta', 'sync'), { ver: increment(1) }, { merge: true });
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
