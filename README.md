# Serba Service Center 🔧⚡

Sistem Informasi Manajemen Jasa Perbaikan Barang Elektronik (*Electronic Repair Service Center Management System*) berbasis **PostgreSQL 16** dan **Docker**.

Aplikasi ini mendigitalkan seluruh siklus hidup perbaikan barang elektronik mulai dari penerimaan barang, diagnosis teknisi, persetujuan estimasi biaya (*quotation*), manajemen inventaris suku cadang (*spareparts*), uji kendali mutu (*QC Testing*), faktur tagihan dan pembayaran bertahap (*invoicing & multi-payment*), sertifikasi garansi purna jual, hingga berita acara serah terima pengembalian perangkat.

---

## 📌 Fitur & Cakupan Alur Operasional

1. **Penerimaan & Registrasi (*Intake*)**: Pencatatan profil pelanggan, spesifikasi fisik perangkat, nomor seri, kelengkapan bawaan, dan catatan cacat fisik saat diterima guna mencegah sengketa.
2. **Diagnosis & Uji Kelayakan (*Inspection*)**: Pengecekan teknis oleh teknisi dan penentuan kelayakan servis (`is_repairable`).
3. **Persetujuan Estimasi Biaya (*Quotation Gate*)**: Transparansi penawaran estimasi biaya jasa dan komponen kepada pelanggan sebelum perbaikan fisik dimulai (`APPROVED` / `REJECTED`).
4. **Alokasi Suku Cadang (*Spareparts Inventory*)**: Pengurangan stok otomatis, penguncian harga satuan saat transaksi, dan dukungan status menunggu suku cadang (*indent*).
5. **Uji Kendali Mutu (*Quality Control / QC*)**: Verifikasi fungsi perangkat dengan checklist JSON sebelum perangkat dinyatakan siap diambil.
6. **Penagihan & Pembayaran Fleksibel (*Billing & Multi-payment*)**: Faktur otomatis dengan dukungan pembayaran Uang Muka (DP) dan Pelunasan via Tunai, Transfer Bank, atau QRIS.
7. **Garansi Servis Purna Jual (*Warranty Tracking*)**: Polis garansi jasa dan suku cadang otomatis dengan masa berlaku terhitung dari tanggal pelunasan.
8. **Serah Terima Formal (*Device Handover*)**: Pencatatan berita acara serah terima fisik barang baik untuk servis sukses, dibatalkan, maupun tidak dapat diservis.
9. **Audit Trail (*Status History*)**: Pencatatan riwayat perpindahan status tiket servis secara transparan dan akuntabel.

---

## 🗄️ Arsitektur Basis Data (PostgreSQL 3NF)

Basis data dinormalisasi hingga **Bentuk Normal Ketiga (3NF)** dengan 14 entitas modular:

```
[customers] 1 ──────────── <N> [customer_devices]
     │                                │
     │ 1                              │ 1
     ▼                                ▼
    <N>                              <N>
[service_tickets] ◄───────────────────┘
     │
     ├─ 1 ─── <N> [service_quotations]
     ├─ 1 ─── <N> [service_status_history]
     ├─ 1 ─── <N> [service_qc_tests]
     ├─ 1 ─── <N> [service_spareparts] ◄─── <N> ─── 1 [spareparts]
     ├─ 1 ───  1  [invoices] ─── 1 ─── <N> [payments]
     ├─ 1 ───  1  [service_warranties]
     └─ 1 ───  1  [device_handovers]
```

> 📖 **Dokumentasi Lengkap Desain Basis Data**:
> Kunjungi [docs/database-design.md](docs/database-design.md) untuk mempelajari:
> - Flowchart alur bisnis terperinci (Mermaid)
> - Narasi operasional menyeluruh
> - Identifikasi entitas dan justifikasi 3NF
> - Spesifikasi atribut dan kamus data PostgreSQL
> - Relasi kardinalitas dan aturan integritas
> - Entity Relationship Diagram (ERD Mermaid)

---

## 🚀 Memulai (Quick Start with Docker)

### Prasyarat
- [Docker Engine & Docker Compose](https://docs.docker.com/get-docker/)

### 1. Kloning Repositori & Setup Environment
```bash
git clone git@github.com:yoshiafk/serba-service-center.git
cd serba-service-center
cp .env.example .env
```

### 2. Menjalankan Container PostgreSQL
Jalankan container menggunakan Docker Compose:
```bash
docker compose up -d
```
Container akan otomatis:
- Menjalankan PostgreSQL 16 Alpine.
- Mengeksekusi skrip inisialisasi DDL [database/init/01_schema.sql](database/init/01_schema.sql).
- Menyiapkan 14 tabel, indeks performa, dan data master awal (*categories*, *users*, *customers*, *spareparts*).

### 3. Memeriksa Status & Koneksi Database
Periksa status container:
```bash
docker compose ps
```

Masuk ke terminal PostgreSQL (`psql`):
```bash
docker compose exec -it postgres psql -U postgres -d serba_service_db
```

Lihat daftar tabel:
```sql
\dt
```

### 4. Menjalankan Uji Alur Transaksi Servis (Test Flow)
Untuk menguji transaksi end-to-end seluruh alur perbaikan (tiket ➜ quotation ➜ sparepart ➜ QC ➜ invoice ➜ payment ➜ garansi ➜ handover):
```bash
docker compose exec -T postgres psql -U postgres -d serba_service_db < database/test_flow.sql
```

---

## 📁 Struktur Direktori

```text
serba-service-center/
├── .env.example              # Template variabel lingkungan
├── .gitignore                # Berkas konfigurasi git ignore
├── docker-compose.yml        # Konfigurasi container service PostgreSQL 16
├── README.md                 # Dokumentasi proyek utama
├── database/
│   ├── init/
│   │   └── 01_schema.sql     # Skrip DDL PostgreSQL (14 tabel, indeks, & seed)
│   └── test_flow.sql         # Skrip simulasi transaksi end-to-end
└── docs/
    ├── database-design.md    # Dokumentasi spesifikasi basis data komprehensif
    └── Alur Proses Jasa Perbaikan Barang Elektronik.pdf  # Dokumen acuan alur awal
```

---

## 📄 Lisensi
Hak Cipta © 2026 Serba Service Center. Dikembangkan untuk keperluan akademik dan implementasi sistem perbaikan barang elektronik.
