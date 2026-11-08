const db = require('../config/db');

// Menerbitkan faktur tagihan servis (UC-10)
async function createInvoice(req, res) {
  const { service_ticket_id, discount_amount, tax_amount } = req.body;
  if (!service_ticket_id) {
    return res.status(400).json({ success: false, error: 'service_ticket_id wajib diisi' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Cek apakah invoice sudah ada
    const existing = await client.query(`SELECT * FROM invoices WHERE service_ticket_id = $1`, [service_ticket_id]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Invoice untuk tiket ini sudah pernah dibuat' });
    }

    // Ambil data tiket dan biaya jasa
    const ticketRes = await client.query(`SELECT * FROM service_tickets WHERE id = $1`, [service_ticket_id]);
    if (ticketRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Tiket servis tidak ditemukan' });
    }
    const laborCost = parseFloat(ticketRes.rows[0].labor_cost || 0);

    // Ambil akumulasi suku cadang
    const partsRes = await client.query(
      `SELECT COALESCE(SUM(subtotal), 0) as total_part_cost FROM service_spareparts WHERE service_ticket_id = $1`,
      [service_ticket_id]
    );
    const totalPartCost = parseFloat(partsRes.rows[0].total_part_cost || 0);

    const discount = parseFloat(discount_amount || 0);
    const tax = parseFloat(tax_amount || 0);
    const grandTotal = laborCost + totalPartCost - discount + tax;

    const invoiceNumber = `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const insertRes = await client.query(
      `INSERT INTO invoices (invoice_number, service_ticket_id, total_labor_cost, total_sparepart_cost, discount_amount, tax_amount, grand_total, amount_paid, balance_due, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0.00, $7, 'UNPAID')
       RETURNING *`,
      [invoiceNumber, service_ticket_id, laborCost, totalPartCost, discount, tax, grandTotal]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: insertRes.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

// Mencatat pembayaran tagihan servis (UC-11) dan auto-aktifasi garansi (UC-12)
async function recordPayment(req, res) {
  const { invoice_id, cashier_id, payment_type, payment_method, amount_paid, reference_number, notes } = req.body;
  if (!invoice_id || !cashier_id || !payment_type || !payment_method || !amount_paid) {
    return res.status(400).json({ success: false, error: 'Data pembayaran tidak lengkap' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const invRes = await client.query(`SELECT * FROM invoices WHERE id = $1 FOR UPDATE`, [invoice_id]);
    if (invRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Invoice tidak ditemukan' });
    }

    const invoice = invRes.rows[0];
    const paidAmount = parseFloat(amount_paid);
    const currentPaid = parseFloat(invoice.amount_paid) + paidAmount;
    const grandTotal = parseFloat(invoice.grand_total);
    const newBalance = Math.max(0, grandTotal - currentPaid);
    const newStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';

    const payNumber = `PAY-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    // Catat baris transaksi pembayaran
    const payInsert = await client.query(
      `INSERT INTO payments (payment_number, invoice_id, cashier_id, payment_type, payment_method, amount_paid, reference_number, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [payNumber, invoice_id, cashier_id, payment_type, payment_method, paidAmount, reference_number || null, notes || null]
    );

    // Update status invoice
    await client.query(
      `UPDATE invoices
       SET amount_paid = $1, balance_due = $2, payment_status = $3, updated_at = NOW()
       WHERE id = $4`,
      [currentPaid, newBalance, newStatus, invoice_id]
    );

    let warranty = null;
    // Jika tagihan lunas, otomatis aktifkan polis garansi purna jual (UC-12)
    if (newStatus === 'PAID') {
      const warrantyCode = `WRN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
      const warnInsert = await client.query(
        `INSERT INTO service_warranties (warranty_code, service_ticket_id, invoice_id, labor_warranty_days, part_warranty_days, start_date, labor_expiry_date, part_expiry_date, terms_and_conditions)
         VALUES ($1, $2, $3, 30, 90, CURRENT_DATE, CURRENT_DATE + 30, CURRENT_DATE + 90, 'Segel utuh, tidak terkena cairan atau benturan')
         RETURNING *`,
        [warrantyCode, invoice.service_ticket_id, invoice_id]
      );
      warranty = warnInsert.rows[0];
    }

    await client.query('COMMIT');
    res.status(201).json({
      success: true,
      data: {
        payment: payInsert.rows[0],
        invoice_status: newStatus,
        balance_due: newBalance,
        warranty,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  createInvoice,
  recordPayment,
};
