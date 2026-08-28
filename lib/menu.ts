export type Role = 'root' | 'admin' | 'user';

export interface MenuDef {
  id: string;
  label: string;
  shortLabel: string;
  roles: Role[];
}

export const ALL_MENUS: MenuDef[] = [
  { id: 'overview',      label: 'Ringkasan',            shortLabel: 'Ringkasan',  roles: ['root', 'admin', 'user'] },
  { id: 'penjualan',     label: 'Penjualan',            shortLabel: 'Jual',       roles: ['root', 'admin', 'user'] },
  { id: 'so',            label: 'Sales Order',          shortLabel: 'SO',         roles: ['root', 'admin', 'user'] },
  { id: 'outstanding',   label: 'Outstanding',          shortLabel: 'Out.',       roles: ['root', 'admin', 'user'] },
  { id: 'kertas',        label: 'Stock Kertas',         shortLabel: 'Kertas',     roles: ['root', 'admin', 'user'] },
  { id: 'Plan',          label: 'Plan Produksi',        shortLabel: 'Plan',       roles: ['root', 'admin', 'user'] },
  { id: 'lhkp',          label: 'LHKP',                 shortLabel: 'LHKP',       roles: ['root', 'admin', 'user'] },
  { id: 'StockLevel',    label: 'Stock Level',          shortLabel: 'SL',         roles: ['root', 'admin', 'user'] },
  { id: 'upload',        label: 'Upload Data',          shortLabel: 'Upload',     roles: ['root', 'admin'] },
  { id: 'kertas_upload', label: 'Upload Stock Kertas',  shortLabel: 'Up. Kertas', roles: ['root', 'admin'] },
  { id: 'Plan_upload',   label: 'Upload Plan Produksi', shortLabel: 'Up. Plan',   roles: ['root', 'admin'] },
  { id: 'lhkp_upload',   label: 'Upload LHKP',          shortLabel: 'Up. LHKP',   roles: ['root', 'admin'] },
  { id: 'produk_upload', label: 'Upload MSMR',          shortLabel: 'Up. MSMR',   roles: ['root', 'admin'] },
  { id: 'upload_stock',  label: 'Upload Stock Level',   shortLabel: 'Up. Stock',  roles: ['root', 'admin'] },
  { id: 'master_produk', label: 'Master Produk',        shortLabel: 'Maspro',     roles: ['root', 'admin'] },
  { id: 'users',         label: 'Manajemen User',       shortLabel: 'User',       roles: ['root'] },
];

// ══════════════════════════════════════════════════════════
// Kolom Stock Level — pembatasan granular per kolom tabel,
// disimpan di ARRAY yang sama dengan allowed_menus (di DB / user.allowed_menus),
// dibedakan pakai prefix "col:" supaya tidak perlu ALTER TABLE terpisah.
// Contoh isi allowed_menus: ['overview', 'StockLevel', 'col:produk', 'col:stok_aktual']
// ══════════════════════════════════════════════════════════

export interface StockColumnDef {
  id: string;    // dipakai sebagai `col:${id}` saat disimpan di allowed_menus
  label: string;
  roles: Role[]; // default akses per role kalau user tidak punya override (allowedMenus === null)
}

export const STOCK_LEVEL_COLUMNS: StockColumnDef[] = [
  { id: 'produk',             label: 'Produk',                   roles: ['root', 'admin', 'user'] },
  { id: 'jenis_etiket',       label: 'Jenis Etiket',             roles: ['root', 'admin', 'user'] },
  { id: 'tipe',               label: 'Tipe',                     roles: ['root', 'admin', 'user'] },
  { id: 'stok_pabrik',        label: 'Stok Pabrik',              roles: ['root', 'admin', 'user'] },
  { id: 'pengiriman',         label: 'Pengiriman SSS',           roles: ['root', 'admin', 'user'] },
  { id: 'estimasi_kebutuhan', label: 'Estimasi Kebutuhan',       roles: ['root', 'admin', 'user'] },
  { id: 'estimasi_stok',      label: 'Estimasi Stok',            roles: ['root', 'admin', 'user'] },
  { id: 'stok_aktual',        label: 'Stok Aktual',              roles: ['root', 'admin', 'user'] },
  { id: 'pemakaian_bulan',    label: 'Pemakaian/Bulan',          roles: ['root', 'admin', 'user'] },
  { id: 'pemakaian_minggu',   label: 'Pemakaian/Minggu',         roles: ['root', 'admin', 'user'] },
  { id: 'pemakaian_hari',     label: 'Pemakaian/Hari',           roles: ['root', 'admin', 'user'] },
  { id: 'level_pabrik',       label: 'Stock Level Pabrik',       roles: ['root', 'admin', 'user'] },
  { id: 'level_wip_bj',       label: 'Stock Level +WIP+BJ',      roles: ['root', 'admin', 'user'] },
  { id: 'level_wip_bj_plan',  label: 'Stock Level +WIP+BJ+Plan', roles: ['root', 'admin', 'user'] },
  { id: 'up',                 label: 'Up',                       roles: ['root', 'admin', 'user'] },
  { id: 'wip',                label: 'WIP',                      roles: ['root', 'admin', 'user'] },
  { id: 'bj',                 label: 'BJ',                       roles: ['root', 'admin', 'user'] },
  { id: 'kiriman',            label: 'Kiriman',                  roles: ['root', 'admin', 'user'] },
  { id: 'plan_produksi',      label: 'Plan Produksi',            roles: ['root', 'admin', 'user'] },
  { id: 'keterangan',         label: 'Keterangan',               roles: ['root', 'admin', 'user'] },
];

export const STOCK_COLUMN_PREFIX = 'col:';
export const stockColId = (id: string) => `${STOCK_COLUMN_PREFIX}${id}`;
export const isStockColId = (id: string) => id.startsWith(STOCK_COLUMN_PREFIX);
export const stripStockColPrefix = (id: string) => id.slice(STOCK_COLUMN_PREFIX.length);