import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SO Dashboard',
  description: 'Sales Order, Penjualan & Outstanding Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
