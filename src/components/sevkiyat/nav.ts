/* Navigasyon yapılandırması */
import {
  LayoutDashboard, BarChart3, CalendarRange, GitCompareArrows, Users, HeartPulse,
  Target, FileText, UploadCloud, Presentation, Contact, type LucideIcon,
} from 'lucide-react';
import type { ViewId } from '@/lib/sevkiyat/types';

export interface NavItem {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  desc: string;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  {
    title: 'Genel',
    items: [
      { id: 'overview', label: 'Genel Bakış', icon: LayoutDashboard, desc: 'KPI, uyarılar ve özet grafikler' },
    ],
  },
  {
    title: 'Analiz',
    items: [
      { id: 'genel', label: 'Genel Grafikler', icon: BarChart3, desc: 'Trendler, dağılımlar, bölüm×tip matrisi' },
      { id: 'aylik', label: 'Aylık & Trend', icon: CalendarRange, desc: 'Son 12 ay, ısı haritası, gün analizi' },
      { id: 'karsilastirma', label: 'Karşılaştırma', icon: GitCompareArrows, desc: 'Yıl-yıl kıyas, Pareto, KPI delta' },
      { id: 'mus', label: 'Müşteriler (ABC)', icon: Users, desc: 'ABC sınıflandırma ve Pareto' },
      { id: 'yasam', label: 'Yaşam Döngüsü', icon: HeartPulse, desc: 'Ritim, büyüme matrisi, yeni/kayıp' },
      { id: 'hedef', label: 'Hedefler', icon: Target, desc: 'Hedef vs gerçekleşen' },
      { id: 'rapor', label: 'Detay Tablolar', icon: FileText, desc: 'Haftalık, günlük ve tüm kayıtlar' },
      { id: 'yrapor', label: 'Yönetim Raporları', icon: Presentation, desc: 'Grafik ağırlıklı raporlar + PDF çıktı' },
      { id: 'mkart', label: 'Müşteri Kartları', icon: Contact, desc: 'Kart görünümü, filtre ve yıllık değişim' },
    ],
  },
  {
    title: 'Veri',
    items: [
      { id: 'veri', label: 'Excel Yükleme', icon: UploadCloud, desc: 'Sürükle-bırak, eşleştir, senkronla' },
    ],
  },
];

export const VIEW_TITLES: Record<ViewId, { title: string; sub: string }> = {
  overview: { title: 'Genel Bakış', sub: 'Tek bakışta operasyon özeti' },
  genel: { title: 'Genel Grafikler & Matris', sub: 'Bölüm, tip, günlük ve haftalık dağılımlar' },
  aylik: { title: 'Aylık Karşılaştırma & Trend', sub: 'MoM / YoY, ısı haritası ve gün analizi' },
  karsilastirma: { title: 'Karşılaştırma', sub: 'Yıl-yıl kıyas, Pareto ve KPI delta' },
  mus: { title: 'Müşteriler (ABC)', sub: 'm³ payına göre sınıflandırma' },
  yasam: { title: 'Müşteri Yaşam Döngüsü', sub: 'Ritim, büyüme ve kayıp analizi' },
  hedef: { title: 'Hedef vs Gerçekleşen', sub: 'Aylık araç ve m³ hedefleri' },
  rapor: { title: 'Detay Raporları', sub: 'Haftalık, günlük ve tüm kayıtlar' },
  yrapor: { title: 'Yönetim Raporları', sub: 'Grafik ağırlıklı yönetici raporları · PDF çıktılı' },
  mkart: { title: 'Müşteri Kartları', sub: 'Müşteri bazlı kartlar, filtre ve yıllık değişim' },
  veri: { title: 'Excel Yükleme & Veri Durumu', sub: 'Firebase senkron yönetimi' },
};
