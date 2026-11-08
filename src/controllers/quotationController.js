const db = require('../config/db');

// Menyusun estimasi biaya pengerjaan (UC-04)
async function createQuotation(req, res) {
  const { service_ticket_id, estimated_labor_cost, estimated_part_cost, notes } = req.body;
  if (!service_ticket_id) {
    return res.status(400).json({ success: false, error: 'service_ticket_id wajib diisi' });
  }

  const laborCost = parseFloat(estimated_labor_cost || 0);
  const partCost = parseFloat(estimated_part_cost || 0);
  const totalCost = laborCost + partCost;
  const quoteNumber = `QOT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const result = await db.query(
      `INSERT INTO service_quotations (quotation_number, service_ticket_id, estimated_labor_cost, estimated_part_cost, total_estimated_cost, notes, approval_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING')
       RETURNING *`,
      [quoteNumber, service_ticket_id, laborCost, partCost, totalCost, notes || null]
    );

    await db.query(
      `UPDATE service_tickets SET status = 'QUOTATION_PENDING', updated_at = NOW() WHERE id = $1`,
      [service_ticket_id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

// Konfirmasi persetujuan estimasi oleh pelanggan (UC-05)
async function respondQuotation(req, res) {
  const { id } = req.params;
  const { approval_status, rejection_reason, user_id } = req.body;

  if (!['APPROVED', 'REJECTED'].includes(approval_status)) {
    return res.status(400).json({ success: false, error: 'approval_status harus APPROVED atau REJECTED' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const quoteRes = await client.query(
      `UPDATE service_quotations
       SET approval_status = $1, rejection_reason = $2, responded_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [approval_status, rejection_reason || null, id]
    );

    if (quoteRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Quotation tidak ditemukan' });
    }

    const quotation = quoteRes.rows[0];
    const ticketId = quotation.service_ticket_id;
    const newStatus = approval_status === 'APPROVED' ? 'IN_PROGRESS' : 'CANCELLED';

    await client.query(
      `UPDATE service_tickets
       SET status = $1, labor_cost = CASE WHEN $1 = 'IN_PROGRESS' THEN $2 ELSE labor_cost END, updated_at = NOW()
       WHERE id = $3`,
      [newStatus, quotation.estimated_labor_cost, ticketId]
    );

    await client.query(
      `INSERT INTO service_status_history (service_ticket_id, old_status, new_status, changed_by_user_id, notes)
       VALUES ($1, 'QUOTATION_PENDING', $2, $3, $4)`,
      [ticketId, newStatus, user_id || 1, `Quotation ${quotation.quotation_number}: ${approval_status}`]
    );

    await client.query('COMMIT');
    res.json({ success: true, data: quotation, ticket_status: newStatus });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  createQuotation,
  respondQuotation,
};
