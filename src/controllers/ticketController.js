const db = require('../config/db');

// Mengambil seluruh tiket servis dengan informasi lengkap
async function getTickets(req, res) {
  try {
    const result = await db.query(`
      SELECT t.*,
             c.name as customer_name,
             c.phone_number as customer_phone,
             d.brand as device_brand,
             d.model_name as device_model,
             d.serial_number as device_serial,
             u_cs.full_name as cs_name,
             u_tech.full_name as technician_name,
             inv.invoice_number,
             inv.grand_total,
             inv.payment_status
      FROM service_tickets t
      JOIN customers c ON c.id = t.customer_id
      JOIN customer_devices d ON d.id = t.customer_device_id
      JOIN users u_cs ON u_cs.id = t.cs_id
      LEFT JOIN users u_tech ON u_tech.id = t.technician_id
      LEFT JOIN invoices inv ON inv.service_ticket_id = t.id
      ORDER BY t.entry_date DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Mengambil detail lengkap 1 tiket servis beserta riwayat dan entitas terkait
async function getTicketById(req, res) {
  const { id } = req.params;
  try {
    const ticketRes = await db.query(`
      SELECT t.*,
             c.name as customer_name,
             c.phone_number as customer_phone,
             c.email as customer_email,
             c.address as customer_address,
             d.brand as device_brand,
             d.model_name as device_model,
             d.serial_number as device_serial,
             d.physical_condition,
             d.accessories,
             u_cs.full_name as cs_name,
             u_tech.full_name as technician_name
      FROM service_tickets t
      JOIN customers c ON c.id = t.customer_id
      JOIN customer_devices d ON d.id = t.customer_device_id
      JOIN users u_cs ON u_cs.id = t.cs_id
      LEFT JOIN users u_tech ON u_tech.id = t.technician_id
      WHERE t.id = $1
    `, [id]);

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Tiket servis tidak ditemukan' });
    }

    const ticket = ticketRes.rows[0];

    // Ambil Quotation
    const quotesRes = await db.query(
      `SELECT * FROM service_quotations WHERE service_ticket_id = $1 ORDER BY created_at DESC`,
      [id]
    );

    // Ambil Spareparts yang digunakan
    const sparepartsRes = await db.query(`
      SELECT sp.*, p.part_code, p.name as part_name
      FROM service_spareparts sp
      JOIN spareparts p ON p.id = sp.sparepart_id
      WHERE sp.service_ticket_id = $1
    `, [id]);

    // Ambil QC Tests
    const qcRes = await db.query(
      `SELECT * FROM service_qc_tests WHERE service_ticket_id = $1 ORDER BY tested_at DESC`,
      [id]
    );

    // Ambil Invoice & Payments
    const invoiceRes = await db.query(
      `SELECT * FROM invoices WHERE service_ticket_id = $1`,
      [id]
    );

    let payments = [];
    if (invoiceRes.rows.length > 0) {
      const payRes = await db.query(
        `SELECT * FROM payments WHERE invoice_id = $1 ORDER BY paid_at ASC`,
        [invoiceRes.rows[0].id]
      );
      payments = payRes.rows;
    }

    // Ambil Garansi & Handover
    const warrantyRes = await db.query(`SELECT * FROM service_warranties WHERE service_ticket_id = $1`, [id]);
    const handoverRes = await db.query(`SELECT * FROM device_handovers WHERE service_ticket_id = $1`, [id]);

    // Ambil Status History
    const historyRes = await db.query(`
      SELECT h.*, u.full_name as changed_by_name
      FROM service_status_history h
      JOIN users u ON u.id = h.changed_by_user_id
      WHERE h.service_ticket_id = $1
      ORDER BY h.created_at ASC
    `, [id]);

    res.json({
      success: true,
      data: {
        ...ticket,
        quotations: quotesRes.rows,
        used_spareparts: sparepartsRes.rows,
        qc_tests: qcRes.rows,
        invoice: invoiceRes.rows[0] || null,
        payments,
        warranty: warrantyRes.rows[0] || null,
        handover: handoverRes.rows[0] || null,
        status_history: historyRes.rows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Menerbitkan tiket servis baru (UC-01 & UC-02)
async function createTicket(req, res) {
  const { customer_device_id, customer_id, cs_id, technician_id, initial_complaint } = req.body;
  if (!customer_device_id || !customer_id || !cs_id || !initial_complaint) {
    return res.status(400).json({ success: false, error: 'Data pendaftaran tiket tidak lengkap' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const ticketNumber = `SRV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const insertTicketQuery = `
      INSERT INTO service_tickets (ticket_number, customer_device_id, customer_id, cs_id, technician_id, initial_complaint, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'REGISTERED')
      RETURNING *
    `;
    const ticketRes = await client.query(insertTicketQuery, [
      ticketNumber,
      customer_device_id,
      customer_id,
      cs_id,
      technician_id || null,
      initial_complaint,
    ]);

    const ticket = ticketRes.rows[0];

    // Catat histori awal
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, NULL, 'REGISTERED', $2, 'Registrasi tiket servis baru di loket')`,
      [ticket.id, cs_id]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, data: ticket });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

// Teknisi melakukan diagnosis kerusakan (UC-03)
async function diagnoseTicket(req, res) {
  const { id } = req.params;
  const { technician_id, inspection_result, is_repairable, unrepairable_reason } = req.body;

  if (is_repairable === undefined || !inspection_result) {
    return res.status(400).json({ success: false, error: 'inspection_result dan is_repairable wajib diisi' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const newStatus = is_repairable ? 'QUOTATION_PENDING' : 'UNREPAIRABLE';
    const updateQuery = `
      UPDATE service_tickets
      SET technician_id = COALESCE($1, technician_id),
          inspection_result = $2,
          is_repairable = $3,
          unrepairable_reason = $4,
          status = $5,
          inspected_at = NOW(),
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;
    const result = await client.query(updateQuery, [
      technician_id || null,
      inspection_result,
      is_repairable,
      unrepairable_reason || null,
      newStatus,
      id,
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Tiket servis tidak ditemukan' });
    }

    // Catat audit trail status
    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'INSPECTION', $2, $3, $4)`,
      [id, newStatus, technician_id || 1, `Diagnosis: ${inspection_result}`]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  getTickets,
  getTicketById,
  createTicket,
  diagnoseTicket,
};
