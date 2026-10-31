import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/sevkiyat/ThemeProvider';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'YATSAN · İhracat Yükleme Paneli',
  description:
    'İhracat yükleme analizi: araç, m³, müşteri ABC, yaşam döngüsü, kapasite doluluk, hedef takibi ve karşılaştırmalı raporlar.',
  keywords: ['ihracat', 'sevkiyat', 'yükleme', 'analiz', 'dashboard', 'YATSAN'],
  authors: [{ name: 'YATSAN' }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
