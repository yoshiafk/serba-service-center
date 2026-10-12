-- ==============================================================================
-- Schema DDL: Serba Service Center (Aplikasi Jasa Perbaikan Barang Elektronik)
-- Target DBMS: PostgreSQL 16+
-- ==============================================================================

-- Bersihkan tabel lama jika ada (Reverse Dependency Order)
DROP TABLE IF EXISTS device_handovers CASCADE;
DROP TABLE IF EXISTS service_warranties CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS service_qc_tests CASCADE;
DROP TABLE IF EXISTS service_status_history CASCADE;
DROP TABLE IF EXISTS service_spareparts CASCADE;
DROP TABLE IF EXISTS spareparts CASCADE;
DROP TABLE IF EXISTS service_quotations CASCADE;
DROP TABLE IF EXISTS service_tickets CASCADE;
DROP TABLE IF EXISTS customer_devices CASCADE;
DROP TABLE IF EXISTS device_categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ==============================================================================
-- 1. Tabel users (Akun Pengguna Internal Staf)
-- ==============================================================================
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    role VARCHAR(30) NOT NULL CHECK (role IN ('ADMIN', 'CS', 'TECHNICIAN', 'CASHIER', 'SUPERVISOR')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 2. Tabel customers (Data Master Pelanggan)
-- ==============================================================================
CREATE TABLE customers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_code VARCHAR(30) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(25) NOT NULL,
    email VARCHAR(100),
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone_number);

-- ==============================================================================
-- 3. Tabel device_categories (Kategori Perangkat Elektronik)
-- ==============================================================================
CREATE TABLE device_categories (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. Tabel customer_devices (Fisik Unit Barang Elektronik Pelanggan)
-- ==============================================================================
CREATE TABLE customer_devices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    category_id BIGINT NOT NULL REFERENCES device_categories(id) ON DELETE RESTRICT,
    brand VARCHAR(50) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    serial_number VARCHAR(100),
    color VARCHAR(30),
    physical_condition TEXT,
    accessories TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customer_devices_cust ON customer_devices(customer_id);
CREATE INDEX idx_customer_devices_cat ON customer_devices(category_id);
CREATE INDEX idx_customer_devices_sn ON customer_devices(serial_number);

-- ==============================================================================
-- 5. Tabel service_tickets (Tiket Transaksi Servis & Operasional Pengerjaan)
-- ==============================================================================
CREATE TABLE service_tickets (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    customer_device_id BIGINT NOT NULL REFERENCES customer_devices(id) ON DELETE RESTRICT,
    customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    cs_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    technician_id BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    initial_complaint TEXT NOT NULL,
    inspection_result TEXT,
    is_repairable BOOLEAN,
    unrepairable_reason TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'REGISTERED' CHECK (
        status IN (
            'REGISTERED',
            'INSPECTION',
            'QUOTATION_PENDING',
            'QUOTATION_APPROVED',
            'QUOTATION_REJECTED',
            'WAITING_SPAREPART',
            'IN_PROGRESS',
            'TESTING_QC',
            'READY_FOR_PICKUP',
            'CLOSED',
            'CANCELLED',
            'UNREPAIRABLE'
        )
    ),
    labor_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (labor_cost >= 0),
    entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inspected_at TIMESTAMPTZ,
    repaired_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_tickets_status ON service_tickets(status);
CREATE INDEX idx_service_tickets_cust ON service_tickets(customer_id);
CREATE INDEX idx_service_tickets_dev ON service_tickets(customer_device_id);
CREATE INDEX idx_service_tickets_tech ON service_tickets(technician_id);

-- ==============================================================================
-- 6. Tabel service_quotations (Estimasi Biaya & Persetujuan Pelanggan)
-- ==============================================================================
CREATE TABLE service_quotations (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    quotation_number VARCHAR(50) NOT NULL UNIQUE,
    service_ticket_id BIGINT NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    estimated_labor_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_labor_cost >= 0),
    estimated_part_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_part_cost >= 0),
    total_estimated_cost NUMERIC(12, 2) NOT NULL CHECK (total_estimated_cost >= 0),
    notes TEXT,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (approval_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    rejection_reason TEXT,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_quotations_ticket ON service_quotations(service_ticket_id);

-- ==============================================================================
-- 7. Tabel spareparts (Master Inventaris Suku Cadang)
-- ==============================================================================
CREATE TABLE spareparts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    part_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category_id BIGINT REFERENCES device_categories(id) ON DELETE SET NULL,
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price NUMERIC(12, 2) NOT NULL CHECK (cost_price >= 0),
    stock_quantity INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_alert INT NOT NULL DEFAULT 2 CHECK (min_stock_alert >= 0),
    unit_of_measure VARCHAR(20) NOT NULL DEFAULT 'pcs',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_spareparts_code ON spareparts(part_code);
CREATE INDEX idx_spareparts_cat ON spareparts(category_id);

-- ==============================================================================
-- 8. Tabel service_spareparts (Rincian Pemakaian Suku Cadang per Tiket Servis)
-- ==============================================================================
CREATE TABLE service_spareparts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_ticket_id BIGINT NOT NULL REFERENCES service_tickets(id) ON DELETE RESTRICT,
    sparepart_id BIGINT NOT NULL REFERENCES spareparts(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    usage_status VARCHAR(20) NOT NULL DEFAULT 'INSTALLED' CHECK (usage_status IN ('RESERVED', 'INSTALLED', 'RETURNED')),
    notes VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_spareparts_ticket ON service_spareparts(service_ticket_id);
CREATE INDEX idx_service_spareparts_part ON service_spareparts(sparepart_id);

-- ==============================================================================
-- 9. Tabel service_status_history (Audit Trail Histori Status)
-- ==============================================================================
CREATE TABLE service_status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_ticket_id BIGINT NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_status_hist_ticket ON service_status_history(service_ticket_id);

-- ==============================================================================
-- 10. Tabel service_qc_tests (Pengujian Kendali Mutu & Uji Kelayakan)
-- ==============================================================================
CREATE TABLE service_qc_tests (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    service_ticket_id BIGINT NOT NULL REFERENCES service_tickets(id) ON DELETE CASCADE,
    tested_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    checklist_results JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_passed BOOLEAN NOT NULL,
    notes TEXT,
    tested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_service_qc_ticket ON service_qc_tests(service_ticket_id);

-- ==============================================================================
-- 11. Tabel invoices (Faktur Tagihan Biaya Servis)
-- ==============================================================================
CREATE TABLE invoices (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    service_ticket_id BIGINT NOT NULL UNIQUE REFERENCES service_tickets(id) ON DELETE RESTRICT,
    total_labor_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_labor_cost >= 0),
    total_sparepart_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_sparepart_cost >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    grand_total NUMERIC(12, 2) NOT NULL CHECK (grand_total >= 0),
    amount_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (amount_paid >= 0),
    balance_due NUMERIC(12, 2) NOT NULL CHECK (balance_due >= 0),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_status ON invoices(payment_status);

-- ==============================================================================
-- 12. Tabel payments (Transaksi Pembayaran Tagihan: DP & Pelunasan)
-- ==============================================================================
CREATE TABLE payments (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    payment_number VARCHAR(50) NOT NULL UNIQUE,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    cashier_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_type VARCHAR(20) NOT NULL CHECK (payment_type IN ('DOWN_PAYMENT', 'FINAL_PAYMENT')),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'BANK_TRANSFER', 'QRIS')),
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    reference_number VARCHAR(100),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_payments_invoice ON payments(invoice_id);

-- ==============================================================================
-- 13. Tabel service_warranties (Garansi Servis Purna Jual)
-- ==============================================================================
CREATE TABLE service_warranties (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    warranty_code VARCHAR(50) NOT NULL UNIQUE,
    service_ticket_id BIGINT NOT NULL REFERENCES service_tickets(id) ON DELETE RESTRICT,
    invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
    labor_warranty_days INT NOT NULL DEFAULT 30 CHECK (labor_warranty_days >= 0),
    part_warranty_days INT NOT NULL DEFAULT 90 CHECK (part_warranty_days >= 0),
    start_date DATE NOT NULL,
    labor_expiry_date DATE NOT NULL,
    part_expiry_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'EXPIRED', 'CLAIMED')),
    terms_and_conditions TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_warranties_ticket ON service_warranties(service_ticket_id);
CREATE INDEX idx_warranties_status ON service_warranties(status);

-- ==============================================================================
-- 14. Tabel device_handovers (Berita Acara Serah Terima Pengembalian Barang)
-- ==============================================================================
CREATE TABLE device_handovers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    handover_number VARCHAR(50) NOT NULL UNIQUE,
    service_ticket_id BIGINT NOT NULL UNIQUE REFERENCES service_tickets(id) ON DELETE RESTRICT,
    handed_by_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    received_by_name VARCHAR(100) NOT NULL,
    receiver_phone VARCHAR(25),
    handover_type VARCHAR(30) NOT NULL CHECK (handover_type IN ('COMPLETED_PICKUP', 'UNREPAIRABLE_RETURN', 'CANCELLED_RETURN')),
    handover_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX idx_handovers_ticket ON device_handovers(service_ticket_id);

-- ==============================================================================
-- DATA AWAL (SEED MASTER DATA)
-- ==============================================================================

-- Staf Pengguna Sistem
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'System Administrator', 'ADMIN'),
('cs_maya', 'maya@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'Maya Kartika (CS)', 'CS'),
('tech_budi', 'budi@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'Budi Santoso (Teknisi Senior)', 'TECHNICIAN'),
('cashier_dina', 'dina@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'Dina Lestari (Kasir)', 'CASHIER');

-- Kategori Perangkat Elektronik
INSERT INTO device_categories (category_code, name, description) VALUES
('LAPTOP', 'Laptop & Personal Computer', 'Perangkat komputer jinjing, PC desktop, dan workstation'),
('SMARTPHONE', 'Smartphone & Tablet', 'Telepon pintar Android, iOS, serta tablet grafis'),
('TV', 'Televisi & Display Monitor', 'Smart TV LED/OLED dan monitor gaming/kantor'),
('AUDIO', 'Audio & Sound System', 'Speaker aktif, ampli, headphone, soundbar, dan home theater'),
('APPLIANCE', 'Elektronik Rumah Tangga', 'Microwave, rice cooker, air purifier, dispenser, dan vacuum cleaner');

-- Master Pelanggan Awal
INSERT INTO customers (customer_code, name, phone_number, email, address) VALUES
('CST-202610-001', 'Ahmad Dani', '081234567890', 'ahmad.dani@example.com', 'Jl. Sudirman No. 45, Jakarta'),
('CST-202610-002', 'Siti Rahmawati', '085678901234', 'siti.rahma@example.com', 'Jl. Merdeka No. 12, Bandung');

-- Master Suku Cadang (Sparepart Catalog)
INSERT INTO spareparts (part_code, name, category_id, unit_price, cost_price, stock_quantity, min_stock_alert, unit_of_measure) VALUES
('PRT-IC-PM8953', 'IC Power Qualcomm PM8953', 2, 125000.00, 75000.00, 15, 3, 'pcs'),
('PRT-LCD-ROG-14', 'Panel LCD 14 Inch 144Hz FHD Asus ROG', 1, 1450000.00, 1100000.00, 4, 1, 'pcs'),
('PRT-SSD-NVME-512', 'SSD NVMe M.2 512GB PCIe Gen4', 1, 650000.00, 500000.00, 10, 2, 'pcs'),
('PRT-CAP-450V', 'Kapasitor Elco 450V 100uF Power Supply TV', 3, 35000.00, 15000.00, 50, 10, 'pcs');

-- Perangkat Terdaftar Milik Pelanggan
INSERT INTO customer_devices (customer_id, category_id, brand, model_name, serial_number, color, physical_condition, accessories) VALUES
(1, 1, 'Asus', 'ROG Zephyrus G14', 'SN-ROG-99214A', 'Eclipse Gray', 'Baret halus pada cover bawah, layar normal', 'Charger bawaan 180W dan tas laptop'),
(2, 2, 'Samsung', 'Galaxy S22 Ultra', 'SN-SM-883921B', 'Phantom Black', 'Backdoor mulus, kaca kamera utuh, tidak mau nyala', 'Unit saja (tanpa charger)');
