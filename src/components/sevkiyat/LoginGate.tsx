'use client';

/* E-posta/şifre giriş kapısı + demo önizleme modu.
   Üyelik tamamen onaylıdır: giriş yapan kullanıcı:
   - admin / onaylı        → panel
   - bekliyor / reddedildi → tam ekran "Onay Kapısı" (hiçbir veri gösterilmez/indirilmez)
   Onay geldiğinde kapı canlı dinleyici sayesinde kendiliğinden panele döner. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Ship, BarChart3, Database, ShieldCheck, PlayCircle, UserCheck, Clock, ShieldX, LogOut } from 'lucide-react';
import { useSevkiyat } from '@/lib/sevkiyat/store';
import { authErrorTr } from '@/lib/sevkiyat/firebase';
import type { Yetki } from '@/lib/sevkiyat/types';

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { authReady, user, demoMode, yetki, signIn, signUp, enterDemo, initAuth, signOutUser } = useSevkiyat();
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Demo modu örnek veriyle açılır (gerçek Firebase verisine dokunmaz)
  if (demoMode) return <>{children}</>;

  // Oturum açık — yetkiye göre kapı ya da panel
  if (user) {
    if (yetki === 'bekliyor' || yetki === 'reddedildi') {
      return <OnayKapisi durum={yetki} email={user} cikis={() => void signOutUser()} />;
    }
    if (yetki !== 'admin' && yetki !== 'onayli') {
      // 'yukleniyor' — yetki çözümleniyor
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="w-4 h-4 animate-spin" /> Yetkiniz kontrol ediliyor…
          </div>
        </div>
      );
    }
    return <>{children}</>;
  }

  const doAuth = async (mode: 'in' | 'up') => {
    setErr('');
    if (!email.trim() || !pass) {
      setErr('E-posta ve şifre girin.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') await signIn(email.trim(), pass);
      else await signUp(email.trim(), pass);
    } catch (e) {
      const code = (e as { code?: string })?.code || '';
      setErr(authErrorTr(code));
    } finally {
      setBusy(false);
    }
  };

  const onDemo = () => {
    setErr('');
    enterDemo();
    // auth dinleyicisi henüz başlamadıysa arka planda başlat
    initAuth();
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Sol — marka paneli */}
      <div className="relative lg:w-[46%] flex flex-col justify-between p-8 lg:p-12 text-white overflow-hidden bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, #38bdf8 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-sky-500/20 ring-1 ring-sky-400/40 flex items-center justify-center">
            <Ship className="w-6 h-6 text-sky-300" />
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight">YATSAN</div>
            <div className="text-xs text-sky-200/80">İhracat Yükleme Paneli</div>
          </div>
        </div>
        <div className="relative max-w-md space-y-8 my-12">
          <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight">
            Yükleme operasyonunuz,
            <span className="text-sky-300"> tek bakışta.</span>
          </h1>
          <p className="text-sky-100/70 text-sm leading-relaxed">
            Excel'den Firebase'e akan sevkiyat verinizi araç, m³, müşteri ve bölüm
            kırılımında analiz edin; uyarılarla ritim kaymalarını yakalayın.
          </p>
          <ul className="space-y-4 text-sm">
            {[
              { icon: BarChart3, t: 'Üst düzey grafikler', d: 'ECharts ile trend, ısı haritası, Pareto ve tahmin' },
              { icon: Database, t: 'Firebase bulut senkronu', d: 'Delta yazım, önbellekli açılış, kota dostu' },
              { icon: ShieldCheck, t: 'Hesap bazlı erişim', d: 'E-posta/şifre ile güvenli oturum' },
              { icon: UserCheck, t: 'Yönetici onaylı üyelik', d: 'Onaylı hesaplar dışında veri gösterilmez' },
            ].map((f) => (
              <li key={f.t} className="flex gap-3">
                <span className="mt-0.5 w-8 h-8 rounded-lg bg-white/10 ring-1 ring-white/15 flex items-center justify-center shrink-0">
                  <f.icon className="w-4 h-4 text-sky-300" />
                </span>
                <span>
                  <b className="block text-white/95">{f.t}</b>
                  <span className="text-sky-100/60 text-xs">{f.d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="relative text-[11px] text-sky-200/50">© {new Date().getFullYear()} YATSAN · Sevkiyat Analitik</div>
      </div>

      {/* Sağ — giriş formu */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold tracking-tight">Panele Giriş</h2>
            <p className="text-sm text-muted-foreground">
              Firebase hesabınızla oturum açın veya ilk kez kayıt oluşturun.
            </p>
          </div>

          {!authReady ? (
            <div className="flex items-center gap-2 py-10 justify-center text-muted-foreground text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Bağlanıyor…
            </div>
          ) : (
            <>
              <Tabs defaultValue="giris">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="giris">Giriş yap</TabsTrigger>
                  <TabsTrigger value="kayit">Kayıt ol</TabsTrigger>
                </TabsList>
                <TabsContent value="giris" className="space-y-3 pt-3">
                  <CredentialFields email={email} pass={pass} setEmail={setEmail} setPass={setPass} busy={busy} onSubmit={() => doAuth('in')} submitLabel="Giriş yap" />
                </TabsContent>
                <TabsContent value="kayit" className="space-y-3 pt-3">
                  <p className="text-xs text-muted-foreground">
                    İlk kaydı siz oluşturun; Firebase konsolunda &quot;E-posta/Şifre&quot; yöntemi etkin olmalıdır.
                    Kaydınız <b>yönetici onayına</b> düşer — onaylanana kadar <b>hiçbir veri gösterilmez</b>.
                    Onaydan sonra aynı e-posta ile giriş yapabilirsiniz.
                  </p>
                  <CredentialFields email={email} pass={pass} setEmail={setEmail} setPass={setPass} busy={busy} onSubmit={() => doAuth('up')} submitLabel="Kayıt oluştur" />
                </TabsContent>
              </Tabs>

              {err && (
                <Alert variant="destructive">
                  <AlertDescription>{err}</AlertDescription>
                </Alert>
              )}

              <Button variant="ghost" className="w-full h-10 text-muted-foreground" onClick={onDemo}>
                <PlayCircle className="w-4 h-4 mr-2" />
                Demo veriyle önizle
              </Button>
              <p className="text-[10.5px] text-muted-foreground/70 text-center leading-relaxed">
                Demo modunda gerçek Firebase'e yazılmaz ve gerçek veriler indirilmez; örnek veriyle tüm analizleri denersiniz.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============ Onay Kapısı — bekleyen/reddedilen üyelerin gördüğü tam ekran ============ */

function OnayKapisi({ durum, email, cikis }: { durum: Extract<Yetki, 'bekliyor' | 'reddedildi'>; email: string; cikis: () => void }) {
  const bekliyor = durum === 'bekliyor';
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-900 via-sky-950 to-sky-900">
      <div className="w-full max-w-md rounded-2xl bg-card shadow-2xl ring-1 ring-black/10 dark:ring-white/10 p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/20 ring-1 ring-sky-400/40 flex items-center justify-center">
            <Ship className="w-5 h-5 text-sky-300" />
          </div>
          <div>
            <div className="text-sm font-extrabold tracking-tight text-foreground">YATSAN</div>
            <div className="text-[11px] text-muted-foreground">İhracat Yükleme Paneli</div>
          </div>
        </div>

        <div className="space-y-3">
          <div className={'mx-auto w-14 h-14 rounded-2xl flex items-center justify-center ' +
            (bekliyor
              ? 'bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/30'
              : 'bg-red-500/15 text-red-500 ring-1 ring-red-500/30')}>
            {bekliyor ? <Clock className="w-7 h-7" /> : <ShieldX className="w-7 h-7" />}
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-lg font-extrabold tracking-tight">
              {bekliyor ? 'Hesabınız yönetici onayı bekliyor' : 'Hesabınız onaylanmadı'}
            </h1>
            <p className="text-xs text-muted-foreground">
              Oturum: <b className="text-foreground/80">{email}</b>
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-muted/40 px-4 py-3.5 text-[12.5px] leading-relaxed text-muted-foreground space-y-2">
          {bekliyor ? (
            <>
              <p><b className="text-foreground">Kaydınız başarıyla alındı.</b> Panel verileri yalnızca onaylı üyelere açıktır — onaylanana kadar hiçbir veri gösterilmez ve indirilmez.</p>
              <p>Yönetici onayladığında bu ekran <b className="text-foreground">kendiliğinden panele dönüşür</b>; sayfayı yenilemeniz gerekmez.</p>
            </>
          ) : (
            <>
              <p><b className="text-foreground">Bu hesaba veri erişimi verilmedi.</b> Yetki talebi için yöneticiyle iletişime geçin.</p>
              <p>Yönetici hesabınızı onaylarsa bu ekran kendiliğinden panele dönüşür.</p>
            </>
          )}
        </div>

        <Button variant="outline" className="w-full h-10" onClick={cikis}>
          <LogOut className="w-4 h-4 mr-2" /> Çıkış yap
        </Button>
        <p className="text-[10.5px] text-muted-foreground/70 text-center">
          Bu ekranda Firebase&#39;den veri indirilmez; yalnızca onay durumunuz canlı dinlenir.
        </p>
      </div>
    </div>
  );
}

function CredentialFields(props: {
  email: string;
  pass: string;
  setEmail: (v: string) => void;
  setPass: (v: string) => void;
  busy: boolean;
  onSubmit: () => void;
  submitLabel: string;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="lg-email">E-posta</Label>
        <Input
          id="lg-email"
          type="email"
          placeholder="ad@sirket.com"
          autoComplete="email"
          value={props.email}
          onChange={(e) => props.setEmail(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && props.onSubmit()}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lg-pass">Şifre</Label>
        <Input
          id="lg-pass"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={props.pass}
          onChange={(e) => props.setPass(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && props.onSubmit()}
        />
      </div>
      <Button className="w-full h-11" disabled={props.busy} onClick={props.onSubmit}>
        {props.busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        {props.submitLabel}
      </Button>
    </>
  );
}
