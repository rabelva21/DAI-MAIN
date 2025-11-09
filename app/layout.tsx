import './globals.css';
import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import { Header } from '@/components/layout/header';
import { Toaster } from '@/components/ui/toaster';
import AuthProvider from './auth-provider';

const outfit = Outfit({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PT. DAI - Form Pengajuan Cuti',
  description: 'Sistem Manajemen Cuti Karyawan PT. DAI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={outfit.className}>
        {/* Bungkus semua dengan AuthProvider */}
        <AuthProvider>
          <Header />
          <main className="min-h-screen bg-gray-50">{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
