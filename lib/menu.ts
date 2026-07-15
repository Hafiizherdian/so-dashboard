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
  { id: 'kertas',        label: 'Stok Level',           shortLabel: 'Kertas',     roles: ['root', 'admin', 'user'] },
  { id: 'Plan',          label: 'Plan Produksi',        shortLabel: 'Plan',       roles: ['root', 'admin', 'user'] },
  { id: 'lhkp',          label: 'LHKP',                 shortLabel: 'LHKP',       roles: ['root', 'admin', 'user'] },
  { id: 'upload',        label: 'Upload Data',          shortLabel: 'Upload',     roles: ['root', 'admin'] },
  { id: 'kertas_upload', label: 'Upload Stok Kertas',   shortLabel: 'Up. Kertas', roles: ['root', 'admin'] },
  { id: 'Plan_upload',   label: 'Upload Plan Produksi', shortLabel: 'Up. Plan',   roles: ['root', 'admin'] },
  { id: 'lhkp_upload',   label: 'Upload LHKP',          shortLabel: 'Up. LHKP',   roles: ['root', 'admin'] },
  { id: 'users',         label: 'Manajemen User',       shortLabel: 'User',       roles: ['root'] },
];