import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SSS Dashboard',
  description: 'Sales Order, Penjualan & Outstanding Dashboard',
  // Tambahkan konfigurasi icon di bawah ini
  icons: {
    icon: '/icon-192x192.png',         // Shortcut icon standar untuk browser desktop/android
    apple: '/icon-192x192.png',        // Khusus untuk Apple (iOS Home Screen)
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}