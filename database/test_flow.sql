-- Test flow end-to-end transaksi servis
BEGIN;

-- 1. Buat tiket servis baru
INSERT INTO service_tickets (ticket_number, customer_device_id, customer_id, cs_id, technician_id, initial_complaint, status)
VALUES ('SRV-20261012-0001', 1, 1, 2, 3, 'Layar bergaris vertikal dan cepat panas', 'REGISTERED');

-- Catat audit log status
INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
VALUES (1, NULL, 'REGISTERED', 2, 'Pendaftaran unit di loket CS');

-- 2. Teknisi periksa & buat estimasi (Quotation)
UPDATE service_tickets 
SET status = 'INSPECTION', inspection_result = 'Panel LCD retak internal, fleksibel aus', is_repairable = TRUE, inspected_at = NOW()
WHERE id = 1;

INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
VALUES (1, 'REGISTERED', 'INSPECTION', 3, 'Pengecekan fisik dan tegangan');

INSERT INTO service_quotations (quotation_number, service_ticket_id, estimated_labor_cost, estimated_part_cost, total_estimated_cost, notes, approval_status, responded_at)
VALUES ('QOT-20261012-0001', 1, 150000.00, 1450000.00, 1600000.00, 'Perlu penggantian modul LCD 14 Inch 144Hz', 'APPROVED', NOW());

-- 3. Pelanggan setuju -> Proses pengerjaan & alokasikan sparepart
UPDATE service_tickets SET status = 'IN_PROGRESS' WHERE id = 1;

INSERT INTO service_spareparts (service_ticket_id, sparepart_id, quantity, unit_price, subtotal, usage_status, notes)
VALUES (1, 2, 1, 1450000.00, 1450000.00, 'INSTALLED', 'Pemasangan LCD panel baru');

UPDATE spareparts SET stock_quantity = stock_quantity - 1 WHERE id = 2;

-- 4. Pengujian Mutu (Quality Control)
UPDATE service_tickets SET status = 'TESTING_QC', repaired_at = NOW(), labor_cost = 150000.00 WHERE id = 1;

INSERT INTO service_qc_tests (service_ticket_id, tested_by_user_id, checklist_results, is_passed, notes)
VALUES (1, 3, '{"display_clarity": true, "refresh_rate": "144Hz", "thermal_stress_test": "PASSED"}'::jsonb, TRUE, 'Uji display dan suhu normal stabil');

UPDATE service_tickets SET status = 'READY_FOR_PICKUP' WHERE id = 1;

-- 5. Faktur Tagihan (Invoice)
INSERT INTO invoices (invoice_number, service_ticket_id, total_labor_cost, total_sparepart_cost, discount_amount, tax_amount, grand_total, amount_paid, balance_due, payment_status)
VALUES ('INV-20261012-0001', 1, 150000.00, 1450000.00, 0.00, 0.00, 1600000.00, 1600000.00, 0.00, 'PAID');

-- 6. Transaksi Pembayaran (Payment)
INSERT INTO payments (payment_number, invoice_id, cashier_id, payment_type, payment_method, amount_paid, reference_number)
VALUES ('PAY-20261012-0001', 1, 4, 'FINAL_PAYMENT', 'QRIS', 1600000.00, 'QRIS-TRX-99881122');

-- 7. Garansi Servis Purna Jual (Warranty)
INSERT INTO service_warranties (warranty_code, service_ticket_id, invoice_id, labor_warranty_days, part_warranty_days, start_date, labor_expiry_date, part_expiry_date, terms_and_conditions)
VALUES ('WRN-20261012-0001', 1, 1, 30, 90, CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 90, 'Segel garansi utuh, tidak terkena cairan atau benturan fisik');

-- 8. Berita Acara Serah Terima (Device Handover)
INSERT INTO device_handovers (handover_number, service_ticket_id, handed_by_user_id, received_by_name, receiver_phone, handover_type, notes)
VALUES ('HND-20261012-0001', 1, 2, 'Ahmad Dani', '081234567890', 'COMPLETED_PICKUP', 'Perangkat diserahkan dalam kondisi berfungsi normal');

-- Tutup tiket servis
UPDATE service_tickets SET status = 'CLOSED', completed_at = NOW() WHERE id = 1;

COMMIT;
