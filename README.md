# YATSAN · İhracat Yükleme Paneli

Firebase destekli, çift temalı (açık/koyu) ihracat sevkiyat yükleme analitiği panosu.
Eski tek dosyalık `index.html` panelinin tamamen yeniden tasarlanmış, modüler sürümüdür.

**Teknoloji:** Next.js 16 · TypeScript · Tailwind CSS · shadcn/ui · ECharts · SheetJS · Zustand · Firebase (Auth + Firestore)

## Özellikler

- **Genel Bakış** — KPI şeridi, akıllı uyarı motoru, 10 özet tile'ı (mini grafikler)
- **Genel Grafikler** — bölüm/tip dağılımı, günlük trend, haftalık + 4 haftalık regresyon tahmini, bölüm × tip matrisi
- **Aylık & Trend** — son 12 ay, MoM/YoY tablosu, ECharts takvim ısı haritası, haftanın günü analizi
- **Karşılaştırma** — yıl-yıl kıyas, aylık araç/m³ serileri, Pareto, bölüm delta tablosu, KPI delta kartları
- **Müşteriler (ABC)** — m³ payına göre A/B/C sınıflama, Pareto, müşteri kartı diyaloğu
- **Yaşam Döngüsü** — ritim analizi (Ritimde/İzle/Riskli), büyüme matrisi, yeni-kayıp akışı
- **Parsiyel** — konsolidasyon fırsatları (aynı hafta 2+ parsiyel)
- **Kapasite Doluluk** — düzenlenebilir tip kapasiteleri, gerçek vs teorik m³
- **Hedefler** — aylık araç/m³ hedefleri (Realtime Database'de saklanır), gerçekleşen yüzdesi
- **Raporlar** — haftalık/günlük/tüm kayıtlar + 10 sayfalık Excel dışa aktarım
- **Excel Yükleme** — sürükle-bırak, otomatik başlık tespiti, kolon eşleştirme, teşhis aracı, HEDEF sayfası içe aktarımı, birleştir/değiştir modları
- **Demo modu** — gerçek Firebase'e dokunmadan 24 aylık örnek veriyle gezinme

## Veri Akışı

1. Excel (`xlsx/xls/csv`) yüklenir → SheetJS ile ayrıştırılır (yalnızca değişen satırlar yazılır)
2. Realtime Database `sevkiyat` düğümüne delta yazılır (1500'lük `update` partileri + retry)
3. `meta/targets` (aylık hedefler) ve `meta/sync` (sürüm sayacı) güncellenir
4. Açılışta IndexedDB önbelleği + sürüm kıyası → gereksiz indirim yapılmaz (bant genişliği dostu)

### Yükleme / Araç Sayım Kuralları

- **Her Excel satırı = 1 yükleme (1 araç).** Aynı tarih + aynı müşteri + aynı tip'e ait
  4 satır, pivot mantığıyla **4 yükleme** sayılır; tekilleştirme yapılmaz.
- Excel'de **ADET kolonu doluysa** değer aynen kullanılır (ör. 1 satırda ADET=3 → 3 araç);
  **boşsa/kolon yoksa** o satır 1 araç sayılır.
- Müşteri tablolarındaki **“Yükleme”** sütunu satır sayısıdır; ritim analizi ise
  **farklı yükleme günü** üzerinden yürür (Yaşam Döngüsü → Yükleme Ritmi tablosundaki “Gün” sütunu).
- Eski kayıtlarda ADET=0 kalmışsa panel bunları otomatik 1 olarak okur; veriyi
  yeniden yüklemenize gerek yoktur.

## Hızlı Başlangıç

```bash
bun install
bun run dev        # http://localhost:3000
bun run build      # statik export → out/
```

İlk açılışta **Kayıt ol** sekmesinden ilk kullanıcıyı oluşturun
(Firebase konsolunda Authentication → E-posta/Şifre etkin olmalıdır).
Alternatif olarak **Demo veriyle önizle** ile gerçek Firebase'e dokunmadan gezebilirsiniz.

### Firebase Yapılandırması

Varsayılan olarak `sevkiyat-yukleme-dashboard` projesi gömülüdür
(`src/lib/sevkiyat/firebaseConfig.ts`). Farklı bir projeye geçmek için `.env.example`
dosyasını `.env.local` olarak kopyalayıp `NEXT_PUBLIC_FIREBASE_*` değişkenlerini doldurun.

> Not: Firebase Web API anahtarı tasarım gereği istemcide görünürdür; güvenlik
> Firestore kuralları + Authentication ile sağlanır. GCP konsolundan API anahtarına
> HTTP yönlendirici kısıtlaması (Vercel alan adı) eklenebilir.

### Firestore Güvenlik Kuralları (önerilen)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

Kurallar depoda `firestore.rules` olarak da durur; CLI ile uygulamak için:

```bash
firebase deploy --only firestore:rules
```

### Veri Deposu: Realtime Database (kota dostu)

Panel varsayılan olarak **Firebase Realtime Database** üzerinden çalışır
(bant genişliği modeli — Firestore'un günlük okuma/yazma kotaları yerine
aylık 10 GB ücretsiz indirim). Veri yapısı:

- `sevkiyat/` — kayıtlar (deterministik anahtar)
- `meta/targets` — aylık hedefler
- `meta/sync` — önbellek sürüm sayacı

**Kurallar** (Firebase Console → Realtime Database → Rules sekmesi) —
kayıt olan herkes **onay bekliyor** durumunda başlar, yazma hakkı yalnızca
yönetici ya da onaylı hesaplara açıktır:

```json
{
  "rules": {
    "sevkiyat": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('kurulum').child('admin').val() == auth.uid || root.child('kullanicilar').child(auth.uid).child('durum').val() == 'onayli')"
    },
    "meta": {
      ".read": "auth != null",
      ".write": "auth != null && (root.child('kurulum').child('admin').val() == auth.uid || root.child('kullanicilar').child(auth.uid).child('durum').val() == 'onayli')"
    },
    "kurulum": {
      ".read": "auth != null",
      "admin": {
        ".write": "auth != null && !data.exists() && newData.val() == auth.uid"
      }
    },
    "kullanicilar": {
      ".read": "auth != null && root.child('kurulum').child('admin').val() == auth.uid",
      "$uid": {
        ".read": "auth != null && (auth.uid == $uid || root.child('kurulum').child('admin').val() == auth.uid)",
        ".write": "auth != null && (root.child('kurulum').child('admin').val() == auth.uid || (auth.uid == $uid && !data.exists()))",
        ".validate": "newData.hasChildren(['email', 'durum', 'rol', 'istekTarihi'])",
        "email": { ".validate": "newData.isString() && newData.val().length <= 120" },
        "durum": { ".validate": "newData.isString() && (root.child('kurulum').child('admin').val() == auth.uid || newData.val() == 'bekliyor')" },
        "rol": { ".validate": "newData.isString() && (root.child('kurulum').child('admin').val() == auth.uid || newData.val() == 'kullanici')" },
        "istekTarihi": { ".validate": "newData.isNumber()" },
        "onayTarihi": { ".validate": "newData.isNumber()" },
        "$other": { ".validate": false }
      }
    }
  }
}
```

**Onay sistemi ilk kurulum:** Güncelleme öncesinde kayıtlı hesaplardan panele
**ilk giriş yapan** otomatik olarak **yönetici** olur (`kurulum/admin` tek sefer
yazılabilir; bu hakkı yanlış hesap aldıysa konsoldan `kurulum/admin` düğümünü
silip kendi hesabınızla girin). Yönetici, **Kullanıcı Yönetimi** sayfasından
yeni kayıtları onaylar; onaylanmayan hesaplar salt okunur kalır.

Depoda `database.rules.json` olarak da durur; CLI ile: `firebase deploy --only database`

**Firestore'dan geçiş:** Excel Yükleme ekranının altındaki
**"Veri Taşıma: Firestore → Realtime Database"** kartı, tüm kayıtları ve
hedefleri tek tıkla RTDB'ye **kopyalar** (kaynak silinmez, geri dönüş mümkündür).

Farklı bir proje/bölge kullanıyorsanız `.env.local` içine
`NEXT_PUBLIC_FIREBASE_DATABASE_URL` yazın.

### Önemli: Vercel Alan Adını Yetkilendirin

Vercel'e dağıttıktan sonra panelin kendi alan adından giriş yapabilmesi için:

**Firebase Console** → Authentication → Settings → **Authorized domains** →
**Add domain** → Vercel alan adınızı ekleyin (örn. `yatsan-panel.vercel.app`).

Aksi halde Vercel adresinden girişte `auth/unauthorized-domain` hatası alırsınız.
(Demo modu bu ayardan etkilenmez.)

## Dağıtım

Uygulama **tamamen statiktir** (`output: 'export'` → `out/`). İki platform da desteklenir:

### 1) Vercel (önerilen)

1. Depoyu GitHub'a push edin (aşağıya bakın)
2. [vercel.com/new](https://vercel.com/new) → GitHub deposunu seçin → **Import**
3. Framework Preset otomatik **Next.js** olarak algılanır; ortam değişkeni gerekmez
   (gömülü proje kullanılıyorsa). Ayar yapmak isterseniz: `NEXT_PUBLIC_FIREBASE_*`
4. **Deploy** → hazır ✅

Vercel CLI ile:

```bash
npm i -g vercel
vercel          # ilk kez: giriş + proje bağlama
vercel --prod   # üretim dağıtımı
```

### 2) Firebase Hosting

```bash
bun run build                 # out/ klasörü üretilir
npm i -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc   # veya: firebase use <proje-id>
firebase deploy --only hosting
```

### GitHub'a Push

```bash
git remote add origin https://github.com/<kullanıcı-adı>/yatsan-panel.git
git push -u origin main
```

## Yapı

```
src/lib/sevkiyat/        # çekirdek mantık (Firebase, Excel, analitik, store, tipler)
src/components/sevkiyat/ # ECharts sarmalayıcı, kabuk, filtreler, görünümler, diyaloğlar
src/app/page.tsx         # tek sayfa uygulama iskeleti
firebase.json            # Firebase Hosting yapılandırması (statik, out/)
next.config.ts           # output: 'export' — Vercel + Firebase uyumlu tek çıktı
```
