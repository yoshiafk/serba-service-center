-- ==============================================================================
-- MIGRATION: 002_seed_data.sql
-- Proyek: Serba Service Center
-- Deskripsi: Data Master Awal (Categories, Users, Customers, Devices, Spareparts)
-- ==============================================================================

-- Staf Pengguna Sistem
INSERT INTO users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'System Administrator', 'ADMIN'),
('cs_maya', 'maya@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'Maya Kartika (CS)', 'CS'),
('tech_budi', 'budi@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'Budi Santoso (Teknisi Senior)', 'TECHNICIAN'),
('cashier_dina', 'dina@serbaservice.com', '$2a$12$e80yE3Q1z9fM2rTf3nC.uODZcOQkC6o/E9mI5Y5IqW7qE2X2p9v4y', 'Dina Lestari (Kasir)', 'CASHIER')
ON CONFLICT (username) DO NOTHING;

-- Kategori Perangkat Elektronik
INSERT INTO device_categories (category_code, name, description) VALUES
('LAPTOP', 'Laptop & Personal Computer', 'Perangkat komputer jinjing, PC desktop, dan workstation'),
('SMARTPHONE', 'Smartphone & Tablet', 'Telepon pintar Android, iOS, serta tablet grafis'),
('TV', 'Televisi & Display Monitor', 'Smart TV LED/OLED dan monitor gaming/kantor'),
('AUDIO', 'Audio & Sound System', 'Speaker aktif, ampli, headphone, soundbar, dan home theater'),
('APPLIANCE', 'Elektronik Rumah Tangga', 'Microwave, rice cooker, air purifier, dispenser, dan vacuum cleaner')
ON CONFLICT (category_code) DO NOTHING;

-- Master Pelanggan Awal
INSERT INTO customers (customer_code, name, phone_number, email, address) VALUES
('CST-202610-001', 'Ahmad Dani', '081234567890', 'ahmad.dani@example.com', 'Jl. Sudirman No. 45, Jakarta'),
('CST-202610-002', 'Siti Rahmawati', '085678901234', 'siti.rahma@example.com', 'Jl. Merdeka No. 12, Bandung')
ON CONFLICT (customer_code) DO NOTHING;

-- Master Suku Cadang (Sparepart Catalog)
INSERT INTO spareparts (part_code, name, category_id, unit_price, cost_price, stock_quantity, min_stock_alert, unit_of_measure) VALUES
('PRT-IC-PM8953', 'IC Power Qualcomm PM8953', 2, 125000.00, 75000.00, 15, 3, 'pcs'),
('PRT-LCD-ROG-14', 'Panel LCD 14 Inch 144Hz FHD Asus ROG', 1, 1450000.00, 1100000.00, 4, 1, 'pcs'),
('PRT-SSD-NVME-512', 'SSD NVMe M.2 512GB PCIe Gen4', 1, 650000.00, 500000.00, 10, 2, 'pcs'),
('PRT-CAP-450V', 'Kapasitor Elco 450V 100uF Power Supply TV', 3, 35000.00, 15000.00, 50, 10, 'pcs')
ON CONFLICT (part_code) DO NOTHING;

-- Perangkat Terdaftar Milik Pelanggan
INSERT INTO customer_devices (customer_id, category_id, brand, model_name, serial_number, color, physical_condition, accessories) VALUES
(1, 1, 'Asus', 'ROG Zephyrus G14', 'SN-ROG-99214A', 'Eclipse Gray', 'Baret halus pada cover bawah, layar normal', 'Charger bawaan 180W dan tas laptop'),
(2, 2, 'Samsung', 'Galaxy S22 Ultra', 'SN-SM-883921B', 'Phantom Black', 'Backdoor mulus, kaca kamera utuh, tidak mau nyala', 'Unit saja (tanpa charger)')
ON CONFLICT DO NOTHING;
