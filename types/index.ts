export interface UploadedFile {
  id: string;
  original_name: string;
  file_size: number;
  record_count: number;
  status: 'processing' | 'completed' | 'error';
  area: string;
  error_message?: string;
  created_at: string;
}

export interface DbStats {
  total_records: number;
  total_penjualan: number;
  total_so: number;
  total_outstanding: number;
  total_files: number;
}

export interface SalesSummary {
  tahun: number;
  bulan: number;
  minggu: number;
  total_penjualan: number;
  total_so: number;
  total_outstanding: number;
  qty_penjualan: number;
  qty_so: number;
  transaksi: number;
}

export interface TopCustomer {
  pelanggan: string;
  type_customer: string;
  total_penjualan: number;
  total_so: number;
  transaksi: number;
}

export interface TopProduct {
  produk: string;
  kategori: string;
  total_penjualan: number;
  qty_penjualan: number;
}

export interface CategoryBreakdown {
  kategori: string;
  total_penjualan: number;
  total_so: number;
  pct: number;
}

export interface MonthlyTrend {
  bulan: number;
  label: string;
  penjualan: number;
  so: number;
  outstanding: number;
}

export interface WeeklyTrend {
  minggu: number;
  penjualan: number;
  so: number;
}

export interface FilterOptions {
  years: number[];
  months: number[];
  areas: string[];
  typeCustomers: string[];
  kategoris: string[];
  keterangans: string[];
}

export interface DashboardData {
  summary: {
    total_penjualan: number;
    total_so: number;
    total_outstanding: number;
    qty_penjualan: number;
    qty_so: number;
    transaksi: number;
    pct_outstanding: number;
  };
  monthly: MonthlyTrend[];
  weekly: WeeklyTrend[];
  categories: CategoryBreakdown[];
  topCustomers: TopCustomer[];
  topProducts: TopProduct[];
  typeCustomerBreakdown: { type_customer: string; penjualan: number; pct: number }[];
  keteranganBreakdown: { keterangan: string; penjualan: number; count: number }[];
}

// Interface khusus untuk baris data di tabel so_outstanding
export interface SoOutstandingRow {
  id: string | number;
  file_id: string;
  week: string | number;            // Contoh: "W1", "W2"
  tanggal: string;         // Format: YYYY-MM-DD
  ref_po: string;          // Referensi PO dari Customer
  nomor_so: string;           // Nomor Sales Order (Key untuk JOIN)
  pelanggan: string;
  produk: string;          // Deskripsi produk
  
  // Spesifikasi Fisik
  panjang: number;
  lebar: number;
  tinggi: number;
  berat: number;
  
  // Metrik Transaksi
  harga: number;
  uom: string;             // Unit of Measurement (Pcs, Set, dll)
  qty_order: number;       // Total yang dipesan
  qty_delivered: number;   // Yang sudah terkirim (realisasi)
  qty_sisa: number;        // Outstanding (qty_order - qty_delivered)
  
  created_at: string;
}

// Interface untuk Detail Gabungan (biasanya dipakai di tabel laporan/monitoring)
export interface SoDetailRow {
  nomor_so: string;
  tanggal: string;
  customer: string;
  produk: string;
  
  // Perbandingan Data
  qty_order: number;       // Dari table so_outstanding
  qty_delivered: number;   // Dari table sales_transactions
  qty_sisa: number;        // Kalkulasi sisa
  
  // Tambahan informasi pengiriman terakhir
  last_delivery_date?: string;
  nomor_penjualan?: string; // No Invoice terakhir jika sudah ada pengiriman
}
