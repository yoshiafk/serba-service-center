/**
 * scripts/demo-flow.js
 * Skrip demonstrasi eksekusi siklus hidup perbaikan barang elektronik secara menyeluruh
 * menggunakan JavaScript (Node.js) & PostgreSQL Driver (pg).
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'serba_service_db',
});

function logStep(stepNum, title, detail) {
  console.log(`\n\x1b[36m▶ [LANGKAH ${stepNum}]: ${title}\x1b[0m`);
  if (detail) {
    console.log(`  └─ \x1b[32m${detail}\x1b[0m`);
  }
}

async function runDemonstration() {
  console.log(`\x1b[33m===============================================================`);
  console.log(`   SIMULASI WORKFLOW JASA PERBAIKAN BARANG ELEKTRONIK (JS DEMO)`);
  console.log(`   Sistem Informasi: Serba Service Center`);
  console.log(`===============================================================\x1b[0m`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Registrasi Pelanggan Baru (UC-01)
    logStep(1, 'Registrasi Pelanggan Baru di Loket CS', 'Mencatat profil pelanggan Bpk. Hendra Gunawan');
    const custCode = `CST-DEMO-${Date.now().toString().slice(-4)}`;
    const custRes = await client.query(
      `INSERT INTO customers (customer_code, name, phone_number, email, address)
       VALUES ($1, 'Hendra Gunawan', '081299887766', 'hendra.gunawan@example.com', 'Jl. Kebon Jeruk No. 18, Jakarta')
       RETURNING id, customer_code, name`,
      [custCode]
    );
    const customer = custRes.rows[0];
    console.log(`     ID: ${customer.id} | Kode: ${customer.customer_code} | Nama: ${customer.name}`);

    // 2. Registrasi Unit Perangkat Pelanggan
    logStep(2, 'Pencatatan Fisik Unit Barang Elektronik', 'Laptop Lenovo Legion 5 Pro (Mati Total)');
    const devRes = await client.query(
      `INSERT INTO customer_devices (customer_id, category_id, brand, model_name, serial_number, color, physical_condition, accessories)
       VALUES ($1, 1, 'Lenovo', 'Legion 5 Pro 16ACH6H', 'SN-LEGION-99120', 'Storm Grey', 'Mulus, segel pabrik sudah terbuka', 'Charger adaptor 300W dan dus bawaan')
       RETURNING id, brand, model_name, serial_number`,
      [customer.id]
    );
    const device = devRes.rows[0];
    console.log(`     Perangkat ID: ${device.id} | Unit: ${device.brand} ${device.model_name} (SN: ${device.serial_number})`);

    // 3. Penerbitan Tiket Servis Masuk (UC-02)
    logStep(3, 'Penerbitan Tiket Servis Resmi', 'Status Awal: REGISTERED');
    const ticketNo = `SRV-JS-${Date.now().toString().slice(-6)}`;
    const ticketRes = await client.query(
      `INSERT INTO service_tickets (ticket_number, customer_device_id, customer_id, cs_id, technician_id, initial_complaint, status)
       VALUES ($1, $2, $3, 2, 3, 'Tiba-tiba mati total saat bermain game, lampu indikator power padam', 'REGISTERED')
       RETURNING id, ticket_number, status`,
      [ticketNo, device.id, customer.id]
    );
    const ticket = ticketRes.rows[0];
    console.log(`     Nomor Tiket: ${ticket.ticket_number} | Status: ${ticket.status}`);

    // Catat histori awal
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, NULL, 'REGISTERED', 2, 'Pendaftaran unit di loket CS')`,
      [ticket.id]
    );

    // 4. Teknisi Melakukan Diagnosis Kerusakan (UC-03)
    logStep(4, 'Diagnosis Kerusakan oleh Teknisi Senior (Budi Santoso)', 'Ditemukan IC Power short circuit, dapat diperbaiki');
    await client.query(
      `UPDATE service_tickets
       SET status = 'INSPECTION', inspection_result = 'Short pada jalur VDD_MAIN, kapasitor filter bocor dan IC Power PMIC rusak', is_repairable = TRUE, inspected_at = NOW()
       WHERE id = $1`,
      [ticket.id]
    );
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'REGISTERED', 'INSPECTION', 3, 'Pemeriksaan skema jalur daya')`,
      [ticket.id]
    );

    // 5. Penyusunan & Persetujuan Estimasi Biaya / Quotation (UC-04 & UC-05)
    logStep(5, 'Gerbang Persetujuan Estimasi Biaya (Quotation Gate)', 'Jasa: Rp 200.000 | Suku Cadang: Rp 125.000');
    const quoteNo = `QOT-JS-${Date.now().toString().slice(-4)}`;
    const quoteRes = await client.query(
      `INSERT INTO service_quotations (quotation_number, service_ticket_id, estimated_labor_cost, estimated_part_cost, total_estimated_cost, notes, approval_status, responded_at)
       VALUES ($1, $2, 200000.00, 125000.00, 325000.00, 'Penggantian IC Power & re-soldering jalur VDD', 'APPROVED', NOW())
       RETURNING *`,
      [quoteNo, ticket.id]
    );
    const quote = quoteRes.rows[0];
    console.log(`     Quotation: ${quote.quotation_number} | Total: Rp ${parseFloat(quote.total_estimated_cost).toLocaleString()} | Status: ${quote.approval_status}`);

    // Update status tiket ke IN_PROGRESS
    await client.query(
      `UPDATE service_tickets SET status = 'IN_PROGRESS', labor_cost = 200000.00 WHERE id = $1`,
      [ticket.id]
    );
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'QUOTATION_PENDING', 'IN_PROGRESS', 2, 'Pelanggan menyetujui penawaran biaya via telepon')`,
      [ticket.id]
    );

    // 6. Alokasi Suku Cadang & Pengerjaan Reparasi Fisik (UC-06 & UC-07)
    logStep(6, 'Pengambilan Suku Cadang dari Gudang Inventaris', 'Mengalokasikan IC Power Qualcomm PM8953 (1 pcs)');
    const partUsageRes = await client.query(
      `INSERT INTO service_spareparts (service_ticket_id, sparepart_id, quantity, unit_price, subtotal, usage_status, notes)
       VALUES ($1, 1, 1, 125000.00, 125000.00, 'INSTALLED', 'Pemasangan IC Power baru & thermal paste')
       RETURNING *`,
      [ticket.id]
    );
    await client.query(`UPDATE spareparts SET stock_quantity = stock_quantity - 1 WHERE id = 1`);
    console.log(`     Part Terpasang: ID ${partUsageRes.rows[0].sparepart_id} | Subtotal: Rp ${parseFloat(partUsageRes.rows[0].subtotal).toLocaleString()}`);

    // 7. Pengujian Kendali Mutu / QC Testing (UC-09)
    logStep(7, 'Pengujian Kendali Mutu (Quality Control Testing)', 'Uji tegangan DC-in, stress test CPU/GPU, charging test');
    const qcChecklist = {
      power_on: true,
      charging_300w: 'PASSED',
      stress_test_duration: '30_minutes',
      temperatures: 'STABLE_68C',
      display_keyboard_audio: 'NORMAL',
    };
    await client.query(
      `INSERT INTO service_qc_tests (service_ticket_id, tested_by_user_id, checklist_results, is_passed, notes)
       VALUES ($1, 3, $2, TRUE, 'Semua fungsi daya dan performa normal sempurna')`,
      [ticket.id, JSON.stringify(qcChecklist)]
    );
    await client.query(
      `UPDATE service_tickets SET status = 'READY_FOR_PICKUP', repaired_at = NOW() WHERE id = $1`,
      [ticket.id]
    );
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'TESTING_QC', 'READY_FOR_PICKUP', 3, 'QC Lulus 100%, siap diserahkan')`,
      [ticket.id]
    );

    // 8. Penerbitan Faktur Tagihan / Invoicing (UC-10)
    logStep(8, 'Penerbitan Faktur Tagihan Servis (Invoice)', 'Jasa: Rp 200.000 + Part: Rp 125.000 = Grand Total: Rp 325.000');
    const invNo = `INV-JS-${Date.now().toString().slice(-4)}`;
    const invRes = await client.query(
      `INSERT INTO invoices (invoice_number, service_ticket_id, total_labor_cost, total_sparepart_cost, discount_amount, tax_amount, grand_total, amount_paid, balance_due, payment_status)
       VALUES ($1, $2, 200000.00, 125000.00, 0.00, 0.00, 325000.00, 325000.00, 0.00, 'PAID')
       RETURNING *`,
      [invNo, ticket.id]
    );
    const invoice = invRes.rows[0];
    console.log(`     Invoice: ${invoice.invoice_number} | Grand Total: Rp ${parseFloat(invoice.grand_total).toLocaleString()} | Status: ${invoice.payment_status}`);

    // 9. Transaksi Pembayaran oleh Kasir (UC-11)
    logStep(9, 'Pembayaran Lunas via Kasir', 'Metode: QRIS Dinamis (Ref: QRIS-BCA-889911)');
    const payNo = `PAY-JS-${Date.now().toString().slice(-4)}`;
    await client.query(
      `INSERT INTO payments (payment_number, invoice_id, cashier_id, payment_type, payment_method, amount_paid, reference_number, notes)
       VALUES ($1, $2, 4, 'FINAL_PAYMENT', 'QRIS', 325000.00, 'QRIS-BCA-889911', 'Pembayaran lunas saat pengambilan')`,
      [payNo, invoice.id]
    );

    // 10. Penerbitan Sertifikat Garansi Servis Purna Jual (UC-12)
    logStep(10, 'Aktivasi Garansi Purna Jual Resmi', 'Garansi Jasa: 30 Hari | Garansi Sparepart: 90 Hari');
    const warnCode = `WRN-JS-${Date.now().toString().slice(-4)}`;
    const warnRes = await client.query(
      `INSERT INTO service_warranties (warranty_code, service_ticket_id, invoice_id, labor_warranty_days, part_warranty_days, start_date, labor_expiry_date, part_expiry_date, terms_and_conditions)
       VALUES ($1, $2, $3, 30, 90, CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 90, 'Segel garansi utuh, bebas cairan dan korsleting eksternal')
       RETURNING warranty_code, labor_expiry_date, part_expiry_date`,
      [warnCode, ticket.id, invoice.id]
    );
    console.log(`     Polis Garansi: ${warnRes.rows[0].warranty_code} (Exp Jasa: ${warnRes.rows[0].labor_expiry_date.toISOString().slice(0, 10)})`);

    // 11. Berita Acara Serah Terima Barang & Penutupan Tiket (UC-13)
    logStep(11, 'Serah Terima Fisik Barang & Penutupan Tiket Servis', 'Diserahkan oleh CS Maya Kartika kepada Bpk. Hendra Gunawan');
    const handNo = `HND-JS-${Date.now().toString().slice(-4)}`;
    await client.query(
      `INSERT INTO device_handovers (handover_number, service_ticket_id, handed_by_user_id, received_by_name, receiver_phone, handover_type, notes)
       VALUES ($1, $2, 2, 'Hendra Gunawan', '081299887766', 'COMPLETED_PICKUP', 'Unit dites hidup di depan pelanggan, berfungsi prima')`,
      [handNo, ticket.id]
    );
    await client.query(
      `UPDATE service_tickets SET status = 'CLOSED', completed_at = NOW() WHERE id = $1`,
      [ticket.id]
    );
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'READY_FOR_PICKUP', 'CLOSED', 2, 'Barang diserahkan ke pelanggan, tiket resmi ditutup')`,
      [ticket.id]
    );

    await client.query('COMMIT');

    // 12. Rekap Validasi Join Multi-Tabel
    console.log(`\n\x1b[32m✔ SUKSES! Seluruh alur pengerjaan servis telah dieksekusi sempurna di PostgreSQL.\x1b[0m`);
    const summaryRes = await pool.query(`
      SELECT t.ticket_number, t.status, 
             c.name as customer, d.model_name as device,
             q.quotation_number, q.approval_status as quote_status,
             inv.invoice_number, inv.grand_total,
             pay.payment_method, w.warranty_code, h.handover_number
      FROM service_tickets t
      JOIN customers c ON c.id = t.customer_id
      JOIN customer_devices d ON d.id = t.customer_device_id
      JOIN service_quotations q ON q.service_ticket_id = t.id
      JOIN invoices inv ON inv.service_ticket_id = t.id
      JOIN payments pay ON pay.invoice_id = inv.id
      JOIN service_warranties w ON w.service_ticket_id = t.id
      JOIN device_handovers h ON h.service_ticket_id = t.id
      WHERE t.id = $1
    `, [ticket.id]);

    console.log('\n\x1b[35m=== RINGKASAN DATA TRANSAKSI LENGKAP (POSTGRESQL RECORD) ===\x1b[0m');
    console.table(summaryRes.rows);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\x1b[31m[Gagal Eksekusi Demo]:\x1b[0m', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

runDemonstration();
