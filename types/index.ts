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
    total_penjualan:   number;
    total_so:          number;
    total_outstanding: number; // FIX: tambah field ini — SUM(qty_sisa) dari so_outstanding
    total_terkirim:    number; // SUM(qty_terkirim) dari sales_transactions
    qty_penjualan:     number; // alias total_terkirim (qty terkirim dari sales_transactions)
    qty_so:            number; // alias total_so (qty order dari so_outstanding)
    transaksi:         number;
    pct_outstanding:   number; // (qty_sisa / qty_order) * 100
  };
  monthly: MonthlyTrend[];
  weekly: WeeklyTrend[];
  categories: CategoryBreakdown[];
  topCustomers: TopCustomer[];
  topProducts: TopProduct[];
  typeCustomerBreakdown: { type_customer: string; penjualan: number; pct: number; transaksi: number }[];
  keteranganBreakdown: { keterangan: string; penjualan: number; count: number }[];
  topOutstanding?: {
    nomor_so: string;
    pelanggan: string;
    qty_sisa: number;
  }[];
  allYears?: number[];
}

// Interface khusus untuk baris data di tabel so_outstanding
export interface SoOutstandingRow {
  id: string | number;
  file_id: string;
  week: string | number;
  tanggal: string;
  ref_po: string;
  nomor_so: string;
  pelanggan: string;
  produk: string;

  // Spesifikasi Fisik
  panjang: number;
  lebar: number;
  tinggi: number;
  berat: number;

  // Metrik Transaksi
  harga: number;
  uom: string;
  qty_order: number;
  qty_delivered: number;
  qty_sisa: number;

  created_at: string;
}

// Interface untuk Detail Gabungan
export interface SoDetailRow {
  nomor_so: string;
  tanggal: string;
  customer: string;
  produk: string;

  qty_order: number;
  qty_delivered: number;
  qty_sisa: number;

  last_delivery_date?: string;
  nomor_penjualan?: string;
}